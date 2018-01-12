[![Circle CI Build: Status](https://img.shields.io/circleci/project/raccoongang/azure-video-pipeline/master.svg)](https://circleci.com/gh/raccoongang/azure-video-pipeline/tree/master)
[![Coverage Status](https://img.shields.io/codecov/c/github/raccoongang/azure-video-pipeline/master.svg)](https://codecov.io/gh/raccoongang/azure-video-pipeline)


# azure-video-pipeline
Provides ability to use MS Azure services as OpenEdx video upload, processing and delivery backend.

Azure Video Pipeline (AVP) is a Django application that aims to extend existent edx-platform course video upload
functionality - adds ability to use Azure service as alter backend for video storage, processing (encoding, encrypting)
and delivery (streaming, downloading).

Azure services that are involved:
- Azure Active Directory - API app authorization;
- Azure Blob Service - content storage;
- Azure Media Service - processing, delivery

AVP relies on the [edx-organizations](https://github.com/edx/edx-organizations) to make it possible to attach
Azure profile to certain Edx Organization, but global (installation-wide) settings also may be configured as
fallback.

# Configuration

The configuration process include two steps:
- OpenEdx platform configuration;
- Azure portal (dashboard) configuration.

## OpenEdx configuration

### Enabling Video Uploads

To enable video upload feature for Azure provide following settings:
```
# cms.env.json
FEATURES["ENABLE_VIDEO_UPLOAD_PIPELINE"] = true
VIDEO_UPLOAD_PIPELINE = {
    "CLOUD": "azure"        # <-- it is "aws" as default alternative
}
```
This setting opens extra Content menu item `Video Uploads` and video uploads page accordingly.

![Video Upload page](doc/img/menu-content-videoupload.png)

### Attaching Azure account to Organization

In order to configure Azure backend for Organization one should create AzureOrgProfile within Studio (aka CMS) admin site:

```
NOTE: migration should be performed in order to make available azure-video-pipeline application's AzureOrgProfile model.

/admin/azureorgprofile/
```
Azure organization profile contains all needed information to make it possible to:
- upload videos and transcripts to Azure;
- encode uploaded video (make a bulk of video files 'with different quality' - aka `bitrate ladder`);
- encrypt encoded video (optional);
- stream encoded \[encrypted\] video to be consumed by Azure Media Player;

Please, refer to fields' informative help text.

![Azure organization profile](doc/img/azure-org-profile.png)

## Azure configuration

### AD (Active Directory)

To be able to communicate with Azure services AD application (with `Web app / API` type) must be created and configured
which ID and key secret are used in AzureOrgProfile as `Client ID` and `Client secret` respectively.
Data for `Tenant` setting may be found in AD/Properties/Directory ID.

### Blob service

Storage account must be created and configured. Account name and key are used in AzureOrgProfile
as `Storage account name` and `Storage key` respectively.

#### CORS

`CORS` should be configured to allow: OPTIONS, HEAD, GET, POST, PUT for all origins.

### Media service

Media service account must be created and configured.
Streaming endpoint should be in `running` status (it is stopped by default).
API access utilises `service principal` type.

# Usage

## Transcripts

This application also provides new feature for video uploads page - ability to add transcripts for video.
Transcript files are stored next to its video files on Azure.

To attach transcript file to certain video file:
- click `Add trancripts` button under the video's name (if there are no transcripts yet)
 or `plus` button in transcripts section (if at least one transcript already attached);
- in modal window: pick appropriate language for transcript file to be uploaded and click `next`;
- choose transcript file from local file system (only `.vtt` transcript files are allowed).

See screenshots for clarity:

![New transcripts feature](doc/img/transcripts.png)

![Modal window](doc/img/transcripts-modal.png)

## Video content protection

After video file is uploaded to Azure service via Video Uploads page it can be protected.
To protect certain video from the list one may click 'lock' icon in `Encrypt` column (icon changes to `locked` state):

![Video protection](doc/img/video_upload_encrypt.png)

In order to `unlock` already protected video click 'lock' icon again.

```
NOTE: Ideally, a decision about Video protection should be made right after its uploading.
Due to the way how dynamic encryption works all video's usages (via xblock) in the course
will become broken if lock enabled afterward.
Those videos may be picked up again with new manifests published.
```

Currently, the `AES-128 clear key` protection type is supported.
For more information about content protection, please, refer to the [Azure Media Services documentation](https://docs.microsoft.com/en-us/azure/media-services/media-services-content-protection-overview)

## Course introduction video enhancements

While course initial setup it is possible to add introduction video via Studio's main menu > Settings > Schedule & Details:

![Introduction video](doc/img/course_details.png)

Standard OpenEdx platform has ability to set course introduction video from YouTube service.
Provided enhancements add ability to use videos uploaded via Video Uploads page as course introduction video.
New dropdown switch appears in `Course Introduction Video` section if platform is configured to store videos on Azure.

![Standard introduction video](doc/img/intro_video_youtube.png)

To use Azure uploaded file as introduction video one should switch to `Azure` and choose video from automatically listed course videos.

![Azure introduction video](doc/img/intro_video_azure.png)

As soon as video is chosen it renders in Azure Media Player above.
Video's subtitles can be optionally enabled.

![Azure introduction video subtitles](doc/img/intro_video_azure_subtitles.png)

After changes are saved the new branded Azure introduction video is available from the LMS course `About` page:

![Lms introduction video view](doc/img/lms_intro_video_azure.png)
