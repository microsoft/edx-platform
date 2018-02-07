define(
    ['underscore',
     'backbone',
     'js/views/baseview',
     'edx-ui-toolkit/js/utils/html-utils',
     'js/models/active_video_upload',
     'js/views/popup_upload_transcript',
     'text!templates/previous-transcripts-video-upload-list.underscore',
     'text!templates/previous-transcripts-video-upload.underscore',
     'jquery.fileupload'],

    function(_, Backbone, BaseView, HtmlUtils, ActiveTranscriptUpload, PopupUploadTranscriptView,
             previousTranscriptsVideoUploadListTemplate, previousTranscriptsVideoUploadTemplate) {
        'use strict';

        var TranscriptView = BaseView.extend({
            tagName: 'div',
            className: 'transcript-view',

            initialize: function(options) {  // eslint-disable-line no-unused-vars
                this.template = HtmlUtils.template(previousTranscriptsVideoUploadTemplate);
                this.clientVideoId = options.clientVideoId;
            },

            render: function() {
                var data = this.model.attributes;
                data.clientVideoId = this.clientVideoId;
                data.viewId = this.cid;
                HtmlUtils.setHtml(
                    this.$el,
                    this.template(data)
                );
                return this;
            }
        });

        var PreviousTranscriptsVideoUploadView = BaseView.extend({
            tagName: 'tr',
            className: 'is-hidden',
            defaultFailureMessage: gettext(
                'This may be happening because of an error with our server or your internet connection.' +
                'Try refreshing the page or making sure you are online.'
            ),
            events: {
                'click .js-add-transcript': 'showPopupUploadTranscript'
            },

            initialize: function(options) {
                this.transcriptHandlerUrl = options.transcriptHandlerUrl;
                this.edxVideoId = options.edxVideoId;
                this.clientVideoId = options.clientVideoId;
                this.supportedFileFormats = ['.vtt'];
                this.maxFileSize = 10000000;
                this.template = HtmlUtils.template(previousTranscriptsVideoUploadListTemplate);
                this.itemViews = this.collection.map(function(model) {
                    return new TranscriptView({
                        model: model,
                        clientVideoId: options.clientVideoId
                    });
                });

                this.listenTo(this.collection, 'add', this.renderItem);
            },

            render: function() {
                var $transcriptContainer;
                HtmlUtils.setHtml(
                    this.$el,
                    this.template({clientVideoId: this.clientVideoId})
                );

                $transcriptContainer = this.$el.find('.js-transcript-container');
                _.each(this.itemViews, function(view) {
                    $transcriptContainer.append(view.render().$el);
                });

                this.$uploadForm = this.$('.file-transcript-upload-form');
                this.$uploadForm.fileupload({
                    type: 'POST',
                    url: this.transcriptHandlerUrl + '/' + this.edxVideoId,
                    global: false,
                    add: this.fileUploadAdd.bind(this),
                    send: this.fileUploadSend.bind(this),
                    progress: this.fileUploadProgress.bind(this),
                    done: this.fileUploadDone.bind(this),
                    fail: this.fileUploadFail.bind(this)
                });

                return this;
            },

            renderItem: function(model) {
                var $transcriptContainer = this.$el.find('.js-transcript-container');
                var transcriptView = new TranscriptView({
                    model: model
                });
                $transcriptContainer.append(transcriptView.render().$el);
                this.itemViews.push(transcriptView);
            },

            uploadTranscript: function() {
                this.$uploadForm.find('.js-file-transcript-input').click();
            },

            showPopupUploadTranscript: function(event) {
                event.preventDefault();
                this.popupUploadTranscriptView = new PopupUploadTranscriptView({
                    setLanguageTranscript: this.setLanguageTranscript.bind(this),
                    uploadTranscript: this.uploadTranscript.bind(this)
                });
                $('body').append(this.popupUploadTranscriptView.render().$el);
                this.popupUploadTranscriptView.$('.modal-transcript').first().focus();
            },

            fileUploadAdd: function(event, uploadData) {
                var model;
                var errorMessage;
                this.popupUploadTranscriptView.remove();
                model = new ActiveTranscriptUpload({
                    fileName: uploadData.files[0].name
                });
                errorMessage = this.validateFile(uploadData.files[0]);
                Backbone.trigger('activeUpload:add', model);

                if (errorMessage) {
                    Backbone.trigger(
                        'activeUpload:setStatus', model.cid, ActiveTranscriptUpload.STATUS_FAILED, errorMessage
                    );
                } else {
                    uploadData.cid = model.cid; // eslint-disable-line no-param-reassign
                    uploadData.submit();
                }
            },

            fileUploadSend: function(event, data) {
                Backbone.trigger('activeUpload:setStatus', data.cid, ActiveTranscriptUpload.STATUS_UPLOADING);
            },

            fileUploadProgress: function(event, data) {
                Backbone.trigger('activeUpload:setProgress', data.cid, data.loaded / data.total);
            },

            fileUploadDone: function(event, data) {
                Backbone.trigger('activeUpload:setStatus', data.cid, ActiveTranscriptUpload.STATUS_COMPLETED);
                Backbone.trigger('activeUpload:setProgress', data.cid, 1);
                Backbone.trigger('activeUpload:clearSuccessful');

                if (this.collection.length) {
                    this.collection.add(data.result.transcript);
                } else {
                    this.collection.reset([data.result.transcript]);
                }
            },

            fileUploadFail: function(event, data) {
                var message;

                try {
                    message = data.jqXHR.responseJSON.error;
                } catch (error) {
                    message = this.defaultFailureMessage;
                }

                Backbone.trigger('activeUpload:setStatus', data.cid, ActiveTranscriptUpload.STATUS_FAILED, message);
            },

            validateFile: function(file) {
                var error = null,
                    fileName,
                    fileType;

                fileName = file.name;
                fileType = fileName.substr(fileName.lastIndexOf('.'));
                // validate file type
                if (!_.contains(this.supportedFileFormats, fileType)) {
                    error = gettext(
                        '{filename} is not in a supported file format. ' +
                        'Supported file formats are {supportedFileFormats}.'
                    )
                    .replace('{filename}', fileName)
                    .replace('{supportedFileFormats}', this.supportedFileFormats.join(' and '));
                } else if (file.size > this.maxFileSize) {
                    error = gettext(
                        '{filename} exceeds maximum size of {maxFileSize} MB.'
                    )
                    .replace('{filename}', fileName)
                    .replace('{maxFileSize}', self.MB / 1000 / 1000);
                }
                return error;
            },

            setLanguageTranscript: function(value) {
                this.$el.find('.js-language-input').val(value);
            }
        });

        return PreviousTranscriptsVideoUploadView;
    }
);
