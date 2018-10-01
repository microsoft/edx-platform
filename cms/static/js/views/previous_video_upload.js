define(
    ['underscore', 'gettext', 'js/utils/date_utils', 'js/views/baseview', 'common/js/components/views/feedback_prompt',
        'common/js/components/views/feedback_notification', 'js/views/video_thumbnail', 'js/views/video_transcripts',
        'common/js/components/utils/view_utils', 'edx-ui-toolkit/js/utils/html-utils',
        'text!templates/previous-video-upload.underscore'],
    function(_, gettext, DateUtils, BaseView, PromptView, NotificationView, VideoThumbnailView, VideoTranscriptsView,
            ViewUtils, HtmlUtils, previousVideoUploadTemplate) {
        'use strict';

        var PreviousVideoUploadView = BaseView.extend({
            tagName: 'div',

            className: 'video-row',

            events: {
                'click .remove-video-button.action-button': 'removeVideo',
                'click .js-lock-unlock-file': 'lockUnlockfile'
            },

            initialize: function(options) {
                this.template = HtmlUtils.template(previousVideoUploadTemplate);
                this.videoHandlerUrl = options.videoHandlerUrl;
                this.videoImageUploadEnabled = options.videoImageSettings.video_image_upload_enabled;
                this.isVideoTranscriptEnabled = options.isVideoTranscriptEnabled;
                this.availableStorageService = options.availableStorageService;

                if (this.videoImageUploadEnabled) {
                    this.videoThumbnailView = new VideoThumbnailView({
                        model: this.model,
                        imageUploadURL: options.videoImageUploadURL,
                        defaultVideoImageURL: options.defaultVideoImageURL,
                        videoImageSettings: options.videoImageSettings
                    });
                }
                if (this.isVideoTranscriptEnabled) {
                    this.videoTranscriptsView = new VideoTranscriptsView({
                        transcripts: this.model.get('transcripts'),
                        edxVideoID: this.model.get('edx_video_id'),
                        clientVideoID: this.model.get('client_video_id'),
                        transcriptionStatus: this.model.get('transcription_status'),
                        transcriptAvailableLanguages: options.transcriptAvailableLanguages,
                        videoSupportedFileFormats: options.videoSupportedFileFormats,
                        videoTranscriptSettings: options.videoTranscriptSettings,
                        availableStorageService: options.availableStorageService
                    });
                }
            },

            render: function() {
                var renderedAttributes = {
                    videoImageUploadEnabled: this.videoImageUploadEnabled,
                    created: DateUtils.renderDate(this.model.get('created')),
                    status: this.model.get('status'),
                    availableStorageService: this.availableStorageService,
                };
                HtmlUtils.setHtml(
                    this.$el,
                    this.template(
                        _.extend({}, this.model.attributes, renderedAttributes)
                    )
                );

                if (this.videoImageUploadEnabled) {
                    this.videoThumbnailView.setElement(this.$('.thumbnail-col')).render();
                }
                if (this.isVideoTranscriptEnabled && this.availableStorageService !== 'azure') {
                    this.videoTranscriptsView.setElement(this.$('.transcripts-col')).render();
                }

                if (this.availableStorageService === 'azure') {
                    if ($.inArray(this.model.get('status_value'),
                            ['upload_completed', 'upload', 'ingest', 'transcode_queue', 'transcode_active']) !== -1) {
                        this.checkStatusVideo();
                    } else if (this.isVideoTranscriptEnabled) {
                        this.videoTranscriptsView.setElement(this.$('.transcripts-col')).render();
                    }
                }
                return this;
            },

            removeVideo: function(event) {
                var videoView = this,
                    message = gettext('Removing a video from this list does not affect course content. Any content that uses a previously uploaded video ID continues to display in the course.');  // eslint-disable-line max-len

                event.preventDefault();

                if (this.availableStorageService === 'azure') {
                    message = gettext('Removing a video from this list does not affect course content. This will not delete the video file from Azure storage and it will continue to play if included in a course unit. You can update the video or remove the URL link from the course if needed.');  // eslint-disable-line max-len
                }

                ViewUtils.confirmThenRunOperation(
                    gettext('Are you sure you want to remove this video from the list?'),
                    message,
                    gettext('Remove'),
                    function() {
                        ViewUtils.runOperationShowingMessage(
                            gettext('Removing'),
                            function() {
                                return $.ajax({
                                    url: videoView.videoHandlerUrl + '/' + videoView.model.get('edx_video_id'),
                                    type: 'DELETE'
                                }).done(function() {
                                    clearInterval(videoView.intervalID);
                                    videoView.remove();
                                });
                            }
                        );
                    }
                );
            },

            lockUnlockfile: function(event) {
                var videoView = this,
                    postData,
                    title,
                    runMessage;

                event.preventDefault();

                if (this.model.get('status_value') === 'file_complete') {
                    title = gettext('Are you sure you want to add encryption to this video file?');
                    runMessage = gettext('Adding encryption');
                    postData = {encrypt: true};
                } else {
                    title = gettext('Are you sure you want to remove encryption from this video file?');
                    runMessage = gettext('Removing encryption');
                    postData = {encrypt: false};
                }

                ViewUtils.confirmThenRunOperation(
                    title,
                    gettext('If the current video file is used in "Azure-media-service" xBlock, please go to the xBlock and redefine the video file.'), // eslint-disable-line max-len,
                    gettext('OK'),
                    function() {
                        ViewUtils.runOperationShowingMessage(
                            runMessage,
                            function() {
                                return $.ajax({
                                    url: videoView.videoHandlerUrl + '/encrypt/' + videoView.model.get('edx_video_id'),
                                    type: 'POST',
                                    data: JSON.stringify(postData),
                                    contentType: 'application/json',
                                    dataType: 'json'
                                }).done(function(data) {
                                    videoView.model.set('status_value', data.status_value);
                                    videoView.$('.js-lock-unlock-file').toggleClass(
                                        'encrypted',
                                        data.status_value === 'file_encrypted'
                                    );
                                });
                            }
                        );
                    }
                );
            },

            checkStatusVideo: function() {
                var view = this,
                    video;

                view.intervalID = setInterval(function() {
                    $.ajax({
                        url: view.videoHandlerUrl + '/' + view.model.get('edx_video_id'),
                        contentType: 'application/json',
                        dataType: 'json',
                        type: 'GET'
                    }).done(function(responseData) {
                        video = _.find(responseData.videos, function(v) {
                            return v.edx_video_id === view.model.get('edx_video_id');
                        });

                        if (video && video.status_value !== view.model.get('status_value')) {
                            clearInterval(view.intervalID);
                            view.model.set(video);
                            view.render();
                        }
                    }).fail(function() {
                        clearInterval(view.intervalID);
                    });
                }, 20000);
            }
        });

        return PreviousVideoUploadView;
    }
);
