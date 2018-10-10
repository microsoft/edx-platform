define(
    [
        'jquery',
        'underscore',
        'backbone',
        'js/views/previous_video_upload',
        'common/js/spec_helpers/template_helpers',
        'common/js/spec_helpers/view_helpers',
        'edx-ui-toolkit/js/utils/spec-helpers/ajax-helpers',
        'mock-ajax'
    ],
    function($, _, Backbone, PreviousVideoUploadView, TemplateHelpers, ViewHelpers, AjaxHelpers) {
        'use strict';
        describe('PreviousVideoUploadView', function() {
            var previousVideoUploadView = function(modelData) {
                var defaultData = {
                        client_video_id: 'foo.mp4',
                        duration: 42,
                        created: '2014-11-25T23:13:05',
                        edx_video_id: 'dummy_id',
                        status: 'uploading',
                        transcripts: [],
                        status_value: ''
                    },
                    viewItem = new PreviousVideoUploadView({
                        model: new Backbone.Model($.extend({}, defaultData, modelData)),
                        videoHandlerUrl: '/videos/course-v1:org.0+course_0+Run_0',
                        transcriptAvailableLanguages: [],
                        videoSupportedFileFormats: [],
                        videoTranscriptSettings: {},
                        videoImageSettings: {}
                    });
                return viewItem;
            };
            var render = function(modelData) {
                var view = previousVideoUploadView(modelData);
                return view.render().$el;
            };

            beforeEach(function() {
                setFixtures('<div id="page-prompt"></div><div id="page-notification"></div>');
                TemplateHelpers.installTemplate('previous-video-upload', false);
                jasmine.Ajax.install();
            });

            afterEach(function() {
                jasmine.Ajax.uninstall();
            });

            it('should render video name correctly', function() {
                var testName = 'test name';
                var $el = render({client_video_id: testName});
                expect($el.find('.name-col').text()).toEqual(testName);
            });

            it('should render created timestamp correctly', function() {
                var fakeDate = 'fake formatted date';
                spyOn(Date.prototype, 'toLocaleString').and.callFake(
                    function(locales, options) {
                        expect(locales).toEqual([]);
                        expect(options.timeZone).toEqual('UTC');
                        expect(options.timeZoneName).toEqual('short');
                        return fakeDate;
                    }
                );
                var $el = render({});
                expect($el.find('.date-col').text()).toEqual(fakeDate);
            });

            it('should render video id correctly', function() {
                var testId = 'test_id';
                var $el = render({edx_video_id: testId});
                expect($el.find('.video-id-col').text()).toEqual(testId);
            });

            it('should render status correctly', function() {
                var testStatus = 'Test Status';
                var $el = render({status: testStatus});
                expect($el.find('.status-col').text()).toEqual(testStatus);
            });

            it('called checkStatusVideo if video status is in_progress and storage is equal to azure',
                function() {
                    var view = previousVideoUploadView({status_value: 'transcode_active'});
                    view.availableStorageService = 'azure';
                    view.checkStatusVideo = jasmine.createSpy();

                    view.render();

                    expect(view.checkStatusVideo).toHaveBeenCalled();
                }
            );

            it('should render correct new video status',
                function() {
                    var requests,
                        view = previousVideoUploadView({status_value: 'transcode_active'});
                    view.availableStorageService = 'azure';
                    view.render();

                    jasmine.Ajax.uninstall();
                    jasmine.clock().install();

                    requests = AjaxHelpers.requests(this);
                    view.checkStatusVideo();

                    jasmine.clock().tick(20000);

                    AjaxHelpers.respond(requests, {
                        status: 200,
                        body: {
                            videos: [
                                {
                                    status: 'Ready',
                                    created: '2018-02-06T11:03:22.421Z',
                                    client_video_id: 'video.mp4',
                                    status_value: 'file_complete',
                                    duration: 10.0,
                                    edx_video_id: 'dummy_id_1'
                                },
                                {
                                    status: 'Test status',
                                    created: '2018-02-06T10:57:20.997Z',
                                    client_video_id: 'TEST.mp4',
                                    status_value: 'test_status',
                                    duration: 20.0,
                                    edx_video_id: 'dummy_id'
                                }
                            ]
                        }
                    });

                    expect(view.$('.status-col').text().trim()).toEqual('Test status');
                    jasmine.clock().uninstall();
                    jasmine.Ajax.install();
                }
            );


            it('should render remove button correctly', function() {
                var $el = render(),
                    removeButton = $el.find('.actions-list .action-remove a.remove-video-button');

                expect(removeButton.data('tooltip')).toEqual('Remove this video');
                expect(removeButton.find('.sr').text()).toEqual('Remove foo.mp4 video');
            });

            it('shows a confirmation popup when the remove button is clicked', function() {
                var $el = render();
                $el.find('a.remove-video-button').click();
                expect($('.prompt.warning .title').text()).toEqual('Are you sure you want to remove this video from the list?');  // eslint-disable-line max-len
                expect(
                    $('.prompt.warning .message').text()
                ).toEqual(
                    'Removing a video from this list does not affect course content. Any content that uses a previously uploaded video ID continues to display in the course.'  // eslint-disable-line max-len
                );
                expect($('.prompt.warning .action-primary').text()).toEqual('Remove');
                expect($('.prompt.warning .action-secondary').text()).toEqual('Cancel');
            });

            it('shows a notification when the remove button is clicked', function() {
                var notificationSpy = ViewHelpers.createNotificationSpy(),
                    $el = render();
                $el.find('a.remove-video-button').click();
                $('.action-primary').click();
                ViewHelpers.verifyNotificationShowing(notificationSpy, /Removing/);
            });

            it('should render encrypt button correctly', function() {
                var view, $el, lockButton;
                view = previousVideoUploadView();
                view.availableStorageService = 'azure';
                $el = view.render().$el;
                lockButton = $el.find('.js-lock-unlock-file');
                expect(lockButton.length).toEqual(0);

                view = previousVideoUploadView({status_value: 'file_complete'});
                view.availableStorageService = 'azure';
                $el = view.render().$el;
                lockButton = $el.find('.js-lock-unlock-file');
                expect(lockButton.length).toEqual(1);
                expect(lockButton.hasClass('encrypted')).toBe(false);

                view = previousVideoUploadView({status_value: 'file_encrypted'});
                view.availableStorageService = 'azure';
                $el = view.render().$el;
                lockButton = $el.find('.js-lock-unlock-file');
                expect(lockButton.length).toEqual(1);
                expect(lockButton.hasClass('encrypted')).toBe(true);
            });

            it('shows a confirmation popup when the encrypt button is clicked', function() {
                var view, $el;
                view = previousVideoUploadView({status_value: 'file_complete'});
                view.availableStorageService = 'azure';
                $el = view.render().$el;
                $el.find('.js-lock-unlock-file').click();

                expect($('.prompt.warning .title').text()).toEqual('Are you sure you want to add encryption to this video file?');  // eslint-disable-line max-len
                expect(
                    $('.prompt.warning .message').text()
                ).toEqual(
                    'If the current video file is used in "Azure-media-service" xBlock, please go to the xBlock and redefine the video file.'  // eslint-disable-line max-len
                );
                expect($('.prompt.warning .action-primary').text()).toEqual('OK');
                expect($('.prompt.warning .action-secondary').text()).toEqual('Cancel');
            });
        });
    }
);
