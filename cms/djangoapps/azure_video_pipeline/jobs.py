import logging

from celery.utils.log import get_task_logger
from edxval.api import update_video_status
from opaque_keys import InvalidKeyError
from opaque_keys.edx.keys import CourseKey
from requests import RequestException
from xmodule.modulestore.django import modulestore

from .media_service import MediaServiceClient
from .utils import get_azure_config
from .tasks import run_job_monitoring_task

LOGGER = logging.getLogger(__name__)
TASK_LOGGER = get_task_logger(__name__)


def signal_video_status_update_callback(sender, **kwargs):  # pylint: disable=unused-argument
    """
    Listen to video status updates and set processing job.
    """
    # process video after it is successfully uploaded:
    if not kwargs['created']:
        video = kwargs['instance']
        if video.status == 'upload_completed':
            course_video = video.courses.first()
            course_id = course_video.course_id
            azure_config = {}
            try:
                course_key = CourseKey.from_string(course_id)
                # course = courses.get_course(course_key)
                course = modulestore().get_course(course_key)
                azure_config = get_azure_config(course.org)
            except (InvalidKeyError, ValueError):
                # need to update video status to 'failed' here:
                update_video_status(video.edx_video_id, 'upload_failed')
                LOGGER.exception("Couldn't recognize Organization Azure storage profile.")

            ams_api = MediaServiceClient(azure_config)

            # create AzureMS video encode Job:
            video_status = 'transcode_failed'
            try:
                video_id = video.edx_video_id
                asset_data = ams_api.get_input_asset_by_video_id(video_id)

                input_asset_id = asset_data and asset_data[u'Id']
                if input_asset_id:
                    LOGGER.info('Creating video encode Job on Azure...')
                    job_info = ams_api.create_job(input_asset_id, video_id)
                    job_data = job_info['d']
                    # Once Job is fired - update Edx video's status and start monitor the Job state:
                    if u'Created' in job_data.keys():
                        video_status = 'transcode_active'
                        run_job_monitoring_task.apply_async([job_data['Id'], azure_config])
            except RequestException:
                LOGGER.exception("Something went wrong during AzureMS encode Job creation.")
            except ValueError:
                LOGGER.exception("Can't read AzureMS Job API response.")
            finally:
                update_video_status(video.edx_video_id, video_status)
