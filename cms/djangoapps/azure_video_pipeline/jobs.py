import logging
import time

from celery.task import task
from celery.utils.log import get_task_logger
from courseware import courses
from django.db import models
from django.dispatch import receiver
from edxval.api import update_video_status
from edxval.models import Video
from opaque_keys import InvalidKeyError
from opaque_keys.edx.keys import CourseKey
from requests import RequestException

from .media_service import AccessPolicyPermissions, LocatorTypes, MediaServiceClient
from .utils import get_azure_config

LOGGER = logging.getLogger(__name__)
TASK_LOGGER = get_task_logger(__name__)


class JobStatus(object):
    """
    Azure Job entity status code enum.

    ref: https://docs.microsoft.com/en-us/rest/api/media/operations/job#list_jobs
    """

    QUEUED = 0
    SCHEDULED = 1
    PROCESSING = 2
    FINISHED = 3
    ERROR = 4
    CANCELED = 5
    CANCELING = 6


@receiver(models.signals.post_save, sender=Video)
def video_status_update_callback(sender, **kwargs):  # pylint: disable=unused-argument
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
                course = courses.get_course(course_key)
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


@task()
def run_job_monitoring_task(job_id, azure_config):
    """
    Monitor completed Azure encode jobs.

    Fetches all jobs, finds all completed, looks for relevant videos with `in progress` status and updates them.
    :param job_id: monitored Job ID
    :param azure_config: Organization's Azure profile
    """
    TASK_LOGGER.info('Starting job monitoring [{}]'.format(job_id))
    ams_api = MediaServiceClient(azure_config)

    def get_video_id_for_job(job_id, api_client):
        output_media_asset = api_client.get_output_media_asset(job_id)
        video_id = output_media_asset['Name'].split('::')[1]
        return output_media_asset, video_id

    while True:
        job_info = ams_api.get_job(job_id)
        state = job_info['State']
        TASK_LOGGER.info('Got state[{}] for Job[{}]'.format(state, job_id))

        if int(state) == JobStatus.FINISHED:
            try:
                output_media_asset, video_id = get_video_id_for_job(job_id, ams_api)
                TASK_LOGGER.info('Starting output Asset publishing [video ID:{}]...'.format(video_id))

                TASK_LOGGER.info('Creating AccessPolicy...')
                policy_name = u'OpenEdxVideoPipelineAccessPolicy'
                access_policy = ams_api.create_access_policy(
                    policy_name,
                    duration_in_minutes=60 * 24 * 365 * 10,
                    permissions=AccessPolicyPermissions.READ
                )
                TASK_LOGGER.info('Creating streaming locator...')
                ams_api.create_locator(
                    access_policy['Id'],
                    output_media_asset['Id'],
                    locator_type=LocatorTypes.OnDemandOrigin
                )
                TASK_LOGGER.info('Creating progressive locator...')
                ams_api.create_locator(
                    access_policy['Id'],
                    output_media_asset['Id'],
                    locator_type=LocatorTypes.SAS
                )
                # Job is finished and processed asset is published:
                update_video_status(video_id, 'file_complete')

            except RequestException:
                TASK_LOGGER.exception("Something went wrong during AzureMS completed Job processing.")
            else:
                break

        if int(state) == JobStatus.ERROR:
            TASK_LOGGER.error("AzureMS video processing Job failed.")

        # Job canceled:
        if int(state) > JobStatus.ERROR:
            output_media_asset, video_id = get_video_id_for_job(job_id, ams_api)
            TASK_LOGGER.warn("AzureMS video processing Job canceled [Output Media Asset:{}, video ID:{}]".format(
                output_media_asset['Name'], video_id
            ))
            update_video_status(video_id, 'transcode_cancelled')
            break

        # # check for Job status every 30 sec:
        time.sleep(30)
