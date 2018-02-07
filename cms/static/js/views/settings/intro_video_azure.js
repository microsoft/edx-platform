define([
    'js/views/baseview',
    'underscore',
    'text!templates/settings-intro-video-azure.underscore'
], function(BaseView, _, introVideoTemplate) {
    'use strict';
    var IntroVideoView = BaseView.extend({
        defaultFailureMessage: gettext('This may be happening because of an error with our server or your internet connection. Try refreshing the page or making sure you are online.'),  // eslint-disable-line max-len

        initialize: function(options) {
            this.introVideoData = options.introVideoData;
            this.parent = options.parent;
            this.courseVideos = options.courseVideos;
            this.captions = '';
            this.videoDataHandlerUrl = options.videoDataHandlerUrl;
        },

        render: function() {
            var videoInfo = true,
                captionEnabled;

            if (!this.captions) {
                this.getIntroVideoData(this.model.get('intro_video_id'));
                videoInfo = false;
            }

            // helper to use in template
            captionEnabled = function(caption) {
                var result = _.filter(JSON.parse(this.model.intro_video_captions), function(parsedCaption) {
                    return parsedCaption.lang === caption.language;
                });
                return !!result.length;
            };

            this.$el.html(_.template(introVideoTemplate)({
                model: this.model.attributes,
                courseVideos: this.courseVideos,
                videoInfo: videoInfo,
                captions: this.captions,
                captionEnabled: captionEnabled
            }));
            return this;
        },

        getIntroVideoData: function(edxVideoId) {
            if (!edxVideoId) return;
            this.captions = '';
            $.ajax({
                type: 'GET',
                url: this.videoDataHandlerUrl + '/' + edxVideoId,
                contentType: 'application/json',
                context: this
            }).done(function(responseData) {
                this.model.set('intro_video_manifest', responseData.video_info.smooth_streaming_url);
                this.captions = responseData.captions;
                this.render();
            });
        },

        reset: function() {
            this.model.set('intro_video_id', '');
            this.model.set('intro_video_manifest', '');
            this.model.set('intro_video_captions', '[]');
            this.captions = '';
        }

    });
    return IntroVideoView;
});
