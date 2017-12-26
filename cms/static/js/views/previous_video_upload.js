/* global Backbone */
define(
    ['underscore', 'gettext', 'js/utils/date_utils', 'js/views/baseview', 'common/js/components/views/feedback_prompt',
     'common/js/components/views/feedback_notification', 'common/js/components/utils/view_utils',
     'edx-ui-toolkit/js/utils/html-utils', 'js/views/previous_transcripts_video_upload',
     'text!templates/previous-video-upload.underscore'],
    function(_, gettext, DateUtils, BaseView, PromptView, NotificationView, ViewUtils, HtmlUtils,
             PreviousTranscriptsVideoUploadView,
             previousVideoUploadTemplate) {
        'use strict';

        var PreviousVideoUploadView = BaseView.extend({
            tagName: 'tr',

            events: {
                'click .remove-video-button.action-button': 'removeVideo',
                'click .js-toggle-transcripts': 'toggleTranscripts',
                'click .js-add-transcript': 'addTranscripts',
                'click .js-lock-unlock-file': 'lockUnlockfile'
            },

            initialize: function(options) {
                this.template = HtmlUtils.template(previousVideoUploadTemplate);
                this.videoHandlerUrl = options.videoHandlerUrl;
                this.transcriptHandlerUrl = options.transcriptHandlerUrl;
                this.storageService = options.storageService;
                this.transcriptsCollection = new Backbone.Collection();

                this.transcriptsCollection.on('reset', this.render);

                this.getTranscripts();
            },

            renderDuration: function(seconds) {
                var minutes = Math.floor(seconds / 60);
                var seconds = Math.floor(seconds - minutes * 60);

                return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
            },

            render: function() {
                var duration = this.model.get('duration');
                var renderedAttributes = {
                    // Translators: This is listed as the duration for a video
                    // that has not yet reached the point in its processing by
                    // the servers where its duration is determined.
                    duration: duration > 0 ? this.renderDuration(duration) : gettext('Pending'),
                    created: DateUtils.renderDate(this.model.get('created')),
                    status: this.model.get('status'),
                    storageService: this.storageService,
                    countTranscripts: this.transcriptsCollection.length
                };
                HtmlUtils.setHtml(
                    this.$el,
                    this.template(
                        _.extend({}, this.model.attributes, renderedAttributes)
                    )
                );

                if (this.storageService === 'azure' &&
                    $.inArray(this.model.get('status_value'), ['file_complete', 'file_encrypted']) !== -1) {
                    this.renderTranscripts();
                }

                return this;
            },

            renderTranscripts: function() {
                if (this.transcriptsView) {
                    this.transcriptsView.remove();
                }
                this.transcriptsView = new PreviousTranscriptsVideoUploadView({
                    collection: this.transcriptsCollection,
                    transcriptHandlerUrl: this.transcriptHandlerUrl,
                    edxVideoId: this.model.get('edx_video_id')
                });
                this.$el.after(this.transcriptsView.render().$el);
            },

            removeVideo: function(event) {
                var videoView = this;

                event.preventDefault();

                ViewUtils.confirmThenRunOperation(
                    gettext('Are you sure you want to remove this video from the list?'),
                    gettext('Removing a video from this list does not affect course content. Any content that uses a previously uploaded video ID continues to display in the course.'),  // eslint-disable-line max-len
                    gettext('Remove'),
                    function() {
                        ViewUtils.runOperationShowingMessage(
                            gettext('Removing'),
                            function() {
                                return $.ajax({
                                    url: videoView.videoHandlerUrl + '/' + videoView.model.get('edx_video_id'),
                                    type: 'DELETE'
                                }).done(function() {
                                    videoView.remove();
                                });
                            }
                        );
                    }
                );
            },

            getTranscripts: function() {
                var view = this;
                if (this.storageService === 'azure' &&
                    $.inArray(this.model.get('status_value'), ['file_complete', 'file_encrypted']) !== -1) {
                    $.ajax({
                        url: this.transcriptHandlerUrl + '/' + this.model.get('edx_video_id'),
                        contentType: 'application/json',
                        dataType: 'json',
                        type: 'GET'
                    }).done(function(responseData) {
                        view.transcriptsCollection.reset(responseData.transcripts);
                    });
                }
            },

            toggleTranscripts: function(event) {
                var isHidden = this.transcriptsView.$el.find('.fa-plus').attr('aria-hidden');
                this.transcriptsView.$el.find('.fa-plus').attr('aria-hidden', !isHidden);
                event.preventDefault();
                this.transcriptsView.$el.toggleClass('is-hidden');

                $(event.currentTarget).toggleClass('active-transcripts');
            },

            addTranscripts: function(event) {
                event.preventDefault();
                this.transcriptsView.$el.find('.js-add-transcript').click();
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
            }
        });

        return PreviousVideoUploadView;
    }
);
