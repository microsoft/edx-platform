import logging
import time

from celery.task import task
from celery.utils.log import get_task_logger
from edxval.api import update_video_status
from requests import RequestException

from .media_service import AccessPolicyPermissions, LocatorTypes, MediaServiceClient


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
