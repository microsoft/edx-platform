define([
    'js/views/baseview',
    'underscore',
    'text!templates/settings-intro-video-youtube.underscore'
], function(BaseView, _, introVideoTemplate) {
    'use strict';
    var defaultIntroVideoData = {};

    var IntroVideoView = BaseView.extend({
        events: {
            'click .remove-course-introduction-video': 'removeVideo'
        },

        initialize: function(options) {
            this.introVideoData = options.introVideoData || defaultIntroVideoData;
            this.parent = options.parent;
        },

        render: function() {
            this.$el.html(_.template(introVideoTemplate)({
                model: this.model.attributes
            }));
            this.$el.find('.current-course-introduction-video iframe').attr('src', this.model.videosourceSample());
            this.$el.find('#course-introduction-video').val(this.model.get('intro_video') || '');
            return this;
        },

        removeVideo: function(event) {
            event.preventDefault();
            if (this.model.has('intro_video')) {
                this.model.set_videosource(null);
                this.render();
            }
        },

        reset: function() {
            this.model.set('intro_video', '');
        }

    });
    return IntroVideoView;
});
