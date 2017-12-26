define(
    ['underscore',
     'backbone',
     'js/views/baseview',
     'edx-ui-toolkit/js/utils/html-utils',
     'text!templates/popup_upload_transcript.underscore'],

    function(_, Backbone, BaseView, HtmlUtils, popupUploadTranscriptTemplate) {
        'use strict';

        var PopupUploadTranscriptView = BaseView.extend({
            tagName: 'div',
            className: 'modal-cover-transcript',

            events: {
                'change .js-select-language': 'setLanguage',
                'click .js-upload-transcript': 'trigerUploadTranscript',
                'click .js-close-popup': 'closePopup'
            },

            initialize: function(options) {
                this.template = HtmlUtils.template(popupUploadTranscriptTemplate);
                this.setLanguageTranscript = options.setLanguageTranscript;
                this.uploadTranscript = options.uploadTranscript;
            },

            render: function() {
                var languages = $('.content-primary').data('all-languages');
                HtmlUtils.setHtml(
                    this.$el,
                    this.template({languages: languages})
                );
                return this;
            },

            setLanguage: function(event) {
                var val = $(event.currentTarget).val();
                this.setLanguageTranscript(val);
                this.$el.find('.js-upload-transcript').prop('disabled', val === '').attr('aria-disabled', false);
            },

            trigerUploadTranscript: function(event) {
                event.preventDefault();
                this.uploadTranscript();
            },

            closePopup: function(event) {
                event.preventDefault();
                this.remove();
            }
        });

        return PopupUploadTranscriptView;
    }
);
