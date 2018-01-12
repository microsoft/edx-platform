// Copyright (c) Microsoft Corporation. All Rights Reserved.
// Licensed under the MIT license. See LICENSE file on the project webpage for details.

/* global WebVTT _ amp gettext runtime */


var events = {
    played: 'edx.video.played',
    paused: 'edx.video.paused',
    stopped: 'edx.video.stopped',
    positionChanged: 'edx.video.position.changed',
    transcriptShown: 'edx.video.transcript.show',
    transcriptsHidden: 'edx.video.transcript.hidden',
    videoLoaded: 'edx.video.loaded',
    captionsShown: 'edx.video.closed_captions.shown',
    captionsHidden: 'edx.video.closed_captions.hidden'
};


/**
 * Build actual URI based on current page protocol context.
 * @param src: source URI part w/o leading protocol
 */
function buildUrl(src) {
    'use strict';
    return window.location.protocol + src;
}


/**
 * xBlock handler (frontend part).
 * @param handlerUrl
 * @param data
 */
function handleData(handlerUrl, data) {
    'use strict';
    return $.ajax({
        type: 'POST',
        url: handlerUrl,
        dataType: 'json',
        data: JSON.stringify(data)
    });
}


/**
 * Send events back to server-side xBlock
 * @param eventPostUrl
 * @param name
 * @param data
 */
function sendPlayerEvent(eventPostUrl, name, data) {
    'use strict';
    data.event_type = name;  // eslint-disable-line no-param-reassign
    $.ajax({
        type: 'POST',
        url: eventPostUrl,
        data: JSON.stringify(data)
    });
}


/**
 * This is called regularly while the video plays
 * so that we can correctly highlight the transcript elements
 * based on the current position of the video playback
 * @param player
 * @param transcriptCues
 * @param $transcriptElement
 * @private
 */
function syncTimer(player, transcriptCues, $transcriptElement) {
    'use strict';
    // Gather each transcript phrase (each pseudo-hyperlink in transcript).
    var cue;
    var isActive;
    var $targetElement;
    var $transcriptItems = $transcriptElement.find('.azure-media-xblock-transcript-element');
    var currentTime = player.currentTime();

    if (transcriptCues === null || !$transcriptElement.length) {
        // no transcript - quick exit
        return;
    }

    // Simple linear search.
    for (var i = 0; i < transcriptCues.length; i++) {  // eslint-disable-line vars-on-top
        cue = transcriptCues[i];

        if (currentTime >= cue.startTime && currentTime < cue.endTime) {
            $targetElement = $transcriptItems.eq(i);

            isActive = $targetElement.hasClass('current');
            if (!isActive) {
                // Highlight the correct one
                $transcriptItems.removeClass('current');
                $targetElement.addClass('current');

                // Autoscroll.
                // TODO: this formula is brittle. It uses "magic numbers." It should instead use
                //    information from the layout like: $transcriptElement's height,
                //    $transcriptElement's scroll-position, $targetElement's location, etc.
                $transcriptElement.scrollTo((i + 1) * 29.5, 1000);
            }
            return;
        }
    }
}

/**
 * Transcripts creating.
 * @param player
 * @param transcript
 * @param $transcriptElement
 * @returns {Array}
 */
function initTranscript(player, transcript, $transcriptElement) {
    'use strict';
    var parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
    var cue;
    var html;
    var cues = [];
    var regions = [];
    var startTime;
    var $transcriptItems;

    $transcriptElement.empty();

    parser.oncue = function(cue) { // eslint-disable-line no-shadow
        cues.push(cue);
    };
    parser.onregion = function(region) {
        regions.push(region);
    };
    parser.onparsingerror = function(error) {
        console.log(error); // eslint-disable-line no-console
    };

    try {
        parser.parse(transcript);
    } catch (error) {
        // TODO: remove when vtt bug is fixed.
        $transcriptElement.append(
            '<span><p>It appears there was a problem loading the transcript. ' +
            'Please see the support link located at the bottom of this page for additional help ' +
            'and information about browser compatibility. We apologize for the inconvenience.</p></span>'
        );
    }
    parser.flush();

    // Creates transcript markup.
    // TODO: use Backbone's client-side templating view (underscore)
    html = '<ol class="subtitles-menu" style="list-style:none; padding:5em 0;">';
    for (var i = 0; i < cues.length; i++) { // eslint-disable-line vars-on-top
        cue = cues[i];

        html += '<li role="link" tabindex="0"'
            + 'data-transcript-element-start-time="' + _.escape(cue.startTime)
            + '" class="azure-media-xblock-transcript-element" >'
            + _.escape(cue.text) + '</li>';
    }
    html += '</ol>';
    $transcriptElement.append(html);

    // Gather each transcript phrase (each pseudo-hyperlink in transcript).
    $transcriptItems = $transcriptElement.find('.azure-media-xblock-transcript-element');

    // Handle events when user clicks on transcripts
    $transcriptItems.on('click keypress', function(evt) {
        var KeyCode = (evt.type === 'keydown' && evt.keyCode ? evt.keyCode : evt.which);
        if (evt.type !== 'click' && (KeyCode !== 32 && KeyCode !== 13)) {
            return;
        }
        if (KeyCode === 32) {
            evt.preventDefault();
        }

        // Clear all active
        $transcriptItems.removeClass('current');

        // Highlight the one the user clicked.
        $(evt.target).addClass('current');

        // Set the player to match the transcript time
        startTime = parseFloat($(evt.target).data('transcript-element-start-time'));
        player.currentTime(startTime);
    });

    return cues;
}


/**
 * Main xBlock initializer which interface is defined by xBlock API.
 * @param runtime
 * @param container
 * @constructor
 */
function AzureMediaServicesBlock(runtime, container) {
    'use strict';
    // IMPORTANT: We pass the <video> DOM element instead of its class or id. This mitigates
    //  a bug when switching units. Changing units triggers a "partial navigation" which
    //  entirely removes the xblock markup from the DOM.
    var player = amp($(container).find('video')[0], null, function() { // eslint-disable-line no-unused-vars
        // Preserve
        var self = this;

        var subtitleEls;
        var languageName;
        var eventPostUrl;
        var fetchTranscriptUrl;
        var timeHandler;

        // Fyi, container contains all of player.html so it is an ancestor of $vidAndTranscript
        //      $vidAndTranscript is an ancestor of BOTH $vidParent AND $transcriptElement
        //      $vidParent is the direct parent of <video> tag
        var $vidAndTranscript = $(container).find('.video').first();
        var $vidParent = $(self.el_);  // eslint-disable-line no-underscore-dangle
        var $transcriptElement = $vidAndTranscript.find('.subtitles').first();

        // This will get filled in by the transcript processor
        var transcriptCues = null;
        // Clear fixed width to support responsive UX.
        $vidParent.css('width', '');

        // Add event handlers
        eventPostUrl = runtime.handlerUrl(container, 'publish_event');
        fetchTranscriptUrl = runtime.handlerUrl(container, 'fetch_transcript');

        // This will be updated as the video plays.
        timeHandler = null;

        this.addEventListener(amp.eventName.pause,
            function(evt) { // eslint-disable-line no-unused-vars
                sendPlayerEvent(eventPostUrl, events.paused, {});

                if (timeHandler !== null) {
                    clearInterval(timeHandler);
                }
            }
        );

        this.addEventListener(amp.eventName.play,
            function(evt) { // eslint-disable-line no-unused-vars
                sendPlayerEvent(eventPostUrl, events.played, {});

                timeHandler = setInterval(
                    function() {
                        syncTimer(self, transcriptCues, $transcriptElement);
                    },
                    100
                );
            }
        );

        this.addEventListener(amp.eventName.loadeddata,
            function() { // eslint-disable-line no-unused-vars
                var $transcriptButton;
                var $transcriptButtonMenu;
                var reportEvent;
                if ($transcriptElement.length) {
                    // Find and re-position button markup. This must be done
                    // after AMP initializes built-in player controls.
                    $transcriptButton = $transcriptElement.find('.toggleTranscript').first();
                    $vidParent.find('.amp-controlbaricons-right').first().append($transcriptButton);

                    $transcriptButtonMenu = $transcriptButton.find('.vjs-menu').first();
                    $transcriptButtonMenu.css({right: '0px', left: 'inherit'});
                    $transcriptButton.on('mouseenter mouseleave', (function() {
                        $transcriptButtonMenu.toggle();
                    }));

                    $transcriptButtonMenu.on('click', function(evt) {
                        var $target = $(evt.target);
                        $transcriptButtonMenu.find('.vjs-menu-item')
                            .removeClass('vjs-selected')
                            .attr('aria-selected', false);
                        $target
                            .addClass('vjs-selected')
                            .attr('aria-selected', true);

                        if ($.trim($target.html()) === 'Off') {
                            $vidAndTranscript.addClass('closed');
                            reportEvent = events.transcriptsHidden;
                        } else {
                            if ($transcriptElement.length) {
                                handleData(fetchTranscriptUrl, {
                                    srcUrl: buildUrl($target.data('src')),
                                    srcLang: $target.data('srclang')
                                }).success(function(responseData) {
                                    if (responseData.result === 'error') {
                                        $transcriptElement.text(responseData.message);
                                    } else {
                                        transcriptCues = initTranscript(
                                            self, responseData.content, $transcriptElement
                                        );
                                    }
                                });
                            }
                            $vidAndTranscript.removeClass('closed');
                            reportEvent = events.transcriptShown;
                        }
                        sendPlayerEvent(eventPostUrl, reportEvent, {});
                    });
                }
                sendPlayerEvent(eventPostUrl, events.videoLoaded, {});
            }
        );

        this.addEventListener(amp.eventName.seeked,
            function(evt) { // eslint-disable-line no-unused-vars
                sendPlayerEvent(eventPostUrl, events.positionChanged, {});
            }
        );

        this.addEventListener(amp.eventName.ended,
            function(evt) { // eslint-disable-line no-unused-vars
                sendPlayerEvent(eventPostUrl, events.stopped, {});

                if (timeHandler !== null) {
                    clearInterval(timeHandler);
                }
            }
        );

        // Log when closed captions (subtitles) are toggled.
        // NOTE we use classes from Azure Media Player which may change.
        subtitleEls = $(container).find('.vjs-subtitles-button .vjs-menu-item');

        subtitleEls.mousedown(function(evt) {
            var reportEvent = events.captionsShown;
            // TODO: we should attach to a different event. For example, this can also be toggled via keyboard.
            languageName = $(evt.target).html();
            if (languageName === 'Off') {
                reportEvent = events.captionsHidden;
                languageName = '';
            }

            sendPlayerEvent(eventPostUrl, reportEvent, {language_name: languageName});
        });
    });
}
