from django.test import SimpleTestCase
from mock import Mock, PropertyMock, patch
from opaque_keys import InvalidKeyError
from requests import RequestException

from azure_video_pipeline.jobs import signal_video_status_update_callback


class JobsTests(SimpleTestCase):
    """
    Celery jobs module unit tests.
    """

    def setUp(self):
        video = Mock()
        type(video).status = PropertyMock(return_value='upload_completed')
        type(video).edx_video_id = PropertyMock(return_value='test_video_id')
        self.course_video = Mock()
        type(self.course_video).course_id = PropertyMock(return_value='test_course_id')
        video.courses.first = self.first_mock = Mock(return_value=self.course_video)
        self.test_kwargs = {
            'created': None,
            'instance': video
        }

    def test_job_created(self):
        # arrange
        with patch.dict(self.test_kwargs, {'created': True}):
            # act
            signal_video_status_update_callback('test_sender', **self.test_kwargs)
        # assert
        assert not self.first_mock.called

    @patch('azure_video_pipeline.jobs.update_video_status')
    @patch('azure_video_pipeline.jobs.run_job_monitoring_task')
    @patch('azure_video_pipeline.jobs.MediaServiceClient')
    @patch('azure_video_pipeline.jobs.get_azure_config')
    @patch('azure_video_pipeline.jobs.modulestore')
    @patch('azure_video_pipeline.jobs.CourseKey')
    def test_video_upload_course_key_fetch_failed(self, course_key_mock, modulestore_mock,
                                                  get_azure_config_mock, ms_client_mock,
                                                  run_job_monitoring_task_mock, update_video_status_mock):
        # arrange
        key_class_mock, serialized_mock = Mock(), Mock()
        course_key_mock.from_string.side_effect = InvalidKeyError(key_class_mock, serialized_mock)
        course_mock = Mock(org=PropertyMock(return_value='test_org'))
        modulestore_mock.return_value = store_mock = Mock(get_course=Mock(return_value=course_mock))
        get_azure_config_mock.return_value = test_azure_config = {}
        ms_client_mock.return_value = ams_api_mock = Mock()
        ams_api_mock.get_input_asset_by_video_id.return_value = {u'Id': 'test_input_asset_id'}
        test_job_data = {u'Created': True, 'Id': 'test_job_id'}
        ams_api_mock.create_job.return_value = {'d': test_job_data}
        # act
        signal_video_status_update_callback('test_sender', **self.test_kwargs)
        # assert
        course_key_mock.from_string.assert_called_ones_with('test_course_id')
        self.assertFalse(store_mock.get_course.called)
        self.assertFalse(get_azure_config_mock.get_course.called)
        ms_client_mock.assert_called_ones_with({})
        ams_api_mock.create_job.assert_called_ones_with('test_input_asset_id', 'test_video_id')
        run_job_monitoring_task_mock.apply_async.assert_called_ones_with('test_input_asset_id', test_azure_config)
        update_video_status_mock.assert_called_ones_with('test_job_id', 'transcode_active')

    @patch('azure_video_pipeline.jobs.update_video_status')
    @patch('azure_video_pipeline.jobs.run_job_monitoring_task')
    @patch('azure_video_pipeline.jobs.MediaServiceClient')
    @patch('azure_video_pipeline.jobs.get_azure_config')
    @patch('azure_video_pipeline.jobs.modulestore')
    @patch('azure_video_pipeline.jobs.CourseKey')
    def test_video_upload_ms_api_error(self, course_key_mock, modulestore_mock, get_azure_config_mock,
                                       ms_client_mock, run_job_monitoring_task_mock, update_video_status_mock):
        # arrange
        key_class_mock, serialized_mock = Mock(), Mock()
        course_key_mock.from_string.side_effect = InvalidKeyError(key_class_mock, serialized_mock)
        course_mock = Mock(org=PropertyMock(return_value='test_org'))
        modulestore_mock.return_value = store_mock = Mock(get_course=Mock(return_value=course_mock))
        get_azure_config_mock.return_value = test_azure_config = {}
        ms_client_mock.return_value = ams_api_mock = Mock()
        ams_api_mock.get_input_asset_by_video_id.side_effect = RequestException
        test_job_data = {u'Created': True, 'Id': 'test_job_id'}
        ams_api_mock.create_job.return_value = {'d': test_job_data}
        # act
        signal_video_status_update_callback('test_sender', **self.test_kwargs)
        # assert
        course_key_mock.from_string.assert_called_ones_with('test_course_id')
        self.assertFalse(store_mock.get_course.called)
        self.assertFalse(get_azure_config_mock.get_course.called)
        ms_client_mock.assert_called_ones_with({})
        self.assertFalse(ams_api_mock.create_job.called)
        self.assertFalse(run_job_monitoring_task_mock.apply_async.called)
        update_video_status_mock.assert_called_ones_with('test_job_id', 'transcode_active')

    @patch('azure_video_pipeline.jobs.update_video_status')
    @patch('azure_video_pipeline.jobs.run_job_monitoring_task')
    @patch('azure_video_pipeline.jobs.MediaServiceClient')
    @patch('azure_video_pipeline.jobs.get_azure_config')
    @patch('azure_video_pipeline.jobs.modulestore')
    @patch('azure_video_pipeline.jobs.CourseKey')
    def test_video_upload_ms_api_parsing_error(self, course_key_mock, modulestore_mock, get_azure_config_mock,
                                               ms_client_mock, run_job_monitoring_task_mock, update_video_status_mock):
        # arrange
        key_class_mock, serialized_mock = Mock(), Mock()
        course_key_mock.from_string.side_effect = InvalidKeyError(key_class_mock, serialized_mock)
        course_mock = Mock(org=PropertyMock(return_value='test_org'))
        modulestore_mock.return_value = store_mock = Mock(get_course=Mock(return_value=course_mock))
        get_azure_config_mock.return_value = test_azure_config = {}
        ms_client_mock.return_value = ams_api_mock = Mock()
        ams_api_mock.get_input_asset_by_video_id.side_effect = ValueError
        test_job_data = {u'Created': True, 'Id': 'test_job_id'}
        ams_api_mock.create_job.return_value = {'d': test_job_data}
        # act
        signal_video_status_update_callback('test_sender', **self.test_kwargs)
        # assert
        course_key_mock.from_string.assert_called_ones_with('test_course_id')
        self.assertFalse(store_mock.get_course.called)
        self.assertFalse(get_azure_config_mock.get_course.called)
        ms_client_mock.assert_called_ones_with({})
        self.assertFalse(ams_api_mock.create_job.called)
        self.assertFalse(run_job_monitoring_task_mock.apply_async.called)
        update_video_status_mock.assert_called_ones_with('test_job_id', 'transcode_active')

    @patch('azure_video_pipeline.jobs.update_video_status')
    @patch('azure_video_pipeline.jobs.run_job_monitoring_task')
    @patch('azure_video_pipeline.jobs.MediaServiceClient')
    @patch('azure_video_pipeline.jobs.get_azure_config')
    @patch('azure_video_pipeline.jobs.modulestore')
    @patch('azure_video_pipeline.jobs.CourseKey')
    def test_video_upload_and_transcode_success(self, course_key_mock, modulestore_mock,
                                                get_azure_config_mock, ms_client_mock,
                                                run_job_monitoring_task_mock, update_video_status_mock):
        # arrange
        course_key_mock.from_string.return_value = 'test_course_key'
        course_mock = Mock(org=PropertyMock(return_value='test_org'))
        modulestore_mock.return_value = store_mock = Mock(get_course=Mock(return_value=course_mock))
        get_azure_config_mock.return_value = test_azure_config = {}
        ms_client_mock.return_value = ams_api_mock = Mock()
        ams_api_mock.get_input_asset_by_video_id.return_value = {u'Id': 'test_input_asset_id'}
        test_job_data = {u'Created': True, 'Id': 'test_job_id'}
        ams_api_mock.create_job.return_value = {'d': test_job_data}
        # act
        signal_video_status_update_callback('test_sender', **self.test_kwargs)
        # assert
        self.assertTrue(self.first_mock.called)
        course_key_mock.from_string.assert_called_ones_with('test_course_id')
        store_mock.get_course.assert_called_ones_with('test_course_key')
        get_azure_config_mock.assert_called_ones_with('test_org')
        ms_client_mock.assert_called_ones_with(test_azure_config)
        ams_api_mock.create_job.assert_called_ones_with('test_input_asset_id', 'test_video_id')
        run_job_monitoring_task_mock.apply_async.assert_called_ones_with('test_input_asset_id', test_azure_config)
        update_video_status_mock.assert_called_ones_with('test_job_id', 'transcode_active')
