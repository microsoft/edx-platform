require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

var AzureStorage = window.AzureStorage || {};

AzureStorage.generateDevelopmentStorageCredentials = function (proxyUri) {
  var devStore = 'UseDevelopmentStorage=true;';
  if(proxyUri){
    devStore += 'DevelopmentStorageProxyUri=' + proxyUri;
  }

  return devStore;
};

var BlobService = require('../lib/services/blob/blobservice.browser');

AzureStorage.BlobService = BlobService;
AzureStorage.BlobUtilities = require('../lib/services/blob/blobutilities');

AzureStorage.createBlobService = function (storageAccountOrConnectionString, storageAccessKey, host) {
  return new BlobService(storageAccountOrConnectionString, storageAccessKey, host, null);
};

AzureStorage.createBlobServiceWithSas = function (host, sasToken) {
  return new BlobService(null, null, host, sasToken);
};

AzureStorage.createBlobServiceAnonymous = function (host) {
  return new BlobService(null, null, host, null);
};

var azureCommon = require('../lib/common/common.browser');
var StorageServiceClient = azureCommon.StorageServiceClient;
var SharedKey = azureCommon.SharedKey;

AzureStorage.generateAccountSharedAccessSignature = function(storageAccountOrConnectionString, storageAccessKey, sharedAccessAccountPolicy)
{
  var storageSettings = StorageServiceClient.getStorageSettings(storageAccountOrConnectionString, storageAccessKey);
  var sharedKey = new SharedKey(storageSettings._name, storageSettings._key);

  return sharedKey.generateAccountSignedQueryString(sharedAccessAccountPolicy);
};

AzureStorage.Constants = azureCommon.Constants;
AzureStorage.StorageUtilities = azureCommon.StorageUtilities;
AzureStorage.AccessCondition = azureCommon.AccessCondition;

AzureStorage.SR = azureCommon.SR;
AzureStorage.StorageServiceClient = StorageServiceClient;
AzureStorage.Logger = azureCommon.Logger;
AzureStorage.WebResource = azureCommon.WebResource;
AzureStorage.Validate = azureCommon.validate;
AzureStorage.date = azureCommon.date;

// Other filters
AzureStorage.LinearRetryPolicyFilter = azureCommon.LinearRetryPolicyFilter;
AzureStorage.ExponentialRetryPolicyFilter = azureCommon.ExponentialRetryPolicyFilter;
AzureStorage.RetryPolicyFilter = azureCommon.RetryPolicyFilter;

window.AzureStorage = AzureStorage;
},{"../lib/common/common.browser":5,"../lib/services/blob/blobservice.browser":41,"../lib/services/blob/blobutilities":43}],41:[function(require,module,exports){
//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

var BlobService = require('./blobservice.core');
var azureCommon = require('./../../common/common.browser');
var extend = require('extend');
var mime = require('browserify-mime');

var Constants = azureCommon.Constants;
var azureutil = azureCommon.util;
var BlobConstants = Constants.BlobConstants;
var BrowserFileReadStream = azureCommon.BrowserFileReadStream;
var SpeedSummary = azureCommon.SpeedSummary;
var validate = azureCommon.validate;

/**
* Creates a new block blob. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
* (Only available in the JavaScript Client Library for Browsers)
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {File}               browserFile                                   The File object to be uploaded created by HTML File API.
* @param {object}             [options]                                     The request options.
* @param {int}                [options.blockSize]                           The size of each block. Maximum is 100MB.
* @param {string}             [options.blockIdPrefix]                       The prefix to be used to generate the block id.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
* @return {SpeedSummary}
*/
BlobService.prototype.createBlockBlobFromBrowserFile = function (container, blob, browserFile, optionsOrCallback, callback) {
  return this._createBlobFromBrowserFile(container, blob, BlobConstants.BlobTypes.BLOCK, browserFile, optionsOrCallback, callback);
};

/**
* Uploads a page blob from an HTML file. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
* (Only available in the JavaScript Client Library for Browsers)
*
* @this {BlobService}
* @param {string}             container                                           The container name.
* @param {string}             blob                                                The blob name.
* @param {File}               browserFile                                         The File object to be uploaded created by HTML File API.
* @param {object}             [options]                                           The request options.
* @param {SpeedSummary}       [options.speedSummary]                              The upload tracker objects.
* @param {int}                [options.parallelOperationThreadCount]              The number of parallel operations that may be performed when uploading.
* @param {string}             [options.leaseId]                                   The lease identifier.
* @param {string}             [options.transactionalContentMD5]                   An MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                                  The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                       Specifies whether the blob's ContentMD5 header should be set on uploads.
*                                                                                 The default value is false for page blobs.
* @param {bool}               [options.useTransactionalMD5]                       Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                           The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]               The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]           The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]           The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]              The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]        The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]                The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                          The access conditions.
* @param {LocationMode}       [options.locationMode]                              Specifies the location mode used to decide which location the request should be sent to.
*                                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]                  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]                  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                                 The default value is false.
* @param {errorOrResult}      callback                                            `error` will contain information
*                                                                                 if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                                 the blob information.
*                                                                                 `response` will contain information related to this operation.
* @return {SpeedSummary}
*/
BlobService.prototype.createPageBlobFromBrowserFile = function (container, blob, browserFile, optionsOrCallback, callback) {
  return this._createBlobFromBrowserFile(container, blob, BlobConstants.BlobTypes.PAGE, browserFile, optionsOrCallback, callback);
};

/**
* Creates a new append blob from an HTML File object. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
* This API should be used strictly in a single writer scenario because the API internally uses the append-offset conditional header to avoid duplicate blocks.
* If you are guaranteed to have a single writer scenario, please look at options.absorbConditionalErrorsOnRetry and see if setting this flag to true is acceptable for you.
* If you want to append data to an already existing blob, please look at appendFromBrowserFile.
* (Only available in the JavaScript Client Library for Browsers)
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {File}               browserFile                                   The File object to be uploaded created by HTML File API.
* @param {object}             [options]                                     The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 ahash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
* @return {SpeedSummary}
*/
BlobService.prototype.createAppendBlobFromBrowserFile = function (container, blob, browserFile, optionsOrCallback, callback) {
  return this._createBlobFromBrowserFile(container, blob, BlobConstants.BlobTypes.APPEND, browserFile, optionsOrCallback, callback);
};

/**
* Appends to an append blob from an HTML File object. Assumes the blob already exists on the service.
* This API should be used strictly in a single writer scenario because the API internally uses the append-offset conditional header to avoid duplicate blocks.
* If you are guaranteed to have a single writer scenario, please look at options.absorbConditionalErrorsOnRetry and see if setting this flag to true is acceptable for you.
* (Only available in the JavaScript Client Library for Browsers)
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {File}               browserFile                                   The File object to be uploaded created by HTML File API.
* @param {object}             [options]                                     The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
* @return {SpeedSummary}
*/
BlobService.prototype.appendFromBrowserFile = function (container, blob, browserFile, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('appendFromBrowserFile', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.browserFileIsValid(browserFile);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  options.speedSummary = options.speedSummary || new SpeedSummary(blob);

  var stream = new BrowserFileReadStream(browserFile);
  var streamCallback = function (appendError, blob, response) {
    if (azureutil.objectIsFunction(stream.destroy)) {
        stream.destroy();
    }
    callback(appendError, blob, response);
  };
  this._uploadBlobFromStream(false, container, blob, BlobConstants.BlobTypes.APPEND, stream, browserFile.size, options, streamCallback);

  return options.speedSummary;
};

// Private methods

/**
* Creates a new blob (Block/Page/Append). If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
* (Only available in the JavaScript Client Library for Browsers)
*
* @ignore
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {BlobType}           blobType                                      The blob type.
* @param {File}               browserFile                                   The File object to be uploaded created by HTML File API.
* @param {object}             [options]                                     The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry. (For append blob only)
* @param {int}                [options.blockSize]                           The size of each block. Maximum is 100MB.
* @param {string}             [options.blockIdPrefix]                       The prefix to be used to generate the block id. (For block blob only)
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             An MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The MD5 hash of the blob content.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      The callback function.
*
* @return {SpeedSummary}
*
*/
BlobService.prototype._createBlobFromBrowserFile = function (container, blob, blobType, browserFile, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('_createBlobFromBrowserFile', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.blobTypeIsValid(blobType);
    v.browserFileIsValid(browserFile);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  options.speedSummary = options.speedSummary || new SpeedSummary(blob);

  var self = this;
  var creationCallback = function (createError, createBlob, createResponse) {
    if (createError) {
      callback(createError, createBlob, createResponse);
    } else {
      // Automatically detect the mime type
      if(azureutil.tryGetValueChain(options, ['contentSettings','contentType'], undefined) === undefined) {
        azureutil.setObjectInnerPropertyValue(options, ['contentSettings','contentType'], mime.lookup(browserFile.name));
      }

      var stream = new BrowserFileReadStream(browserFile);
      var streamCallback = function (createError, createBlob, createResponse) {
        if (azureutil.objectIsFunction(stream.destroy)) {
          stream.destroy();
        }
        callback(createError, createBlob, createResponse);
      };
      self._uploadBlobFromStream(true, container, blob, blobType, stream, browserFile.size, options, streamCallback);
    }
  };

  this._createBlob(container, blob, blobType, browserFile.size, options, creationCallback);

  return options.speedSummary;
};

module.exports = BlobService;
},{"./../../common/common.browser":5,"./blobservice.core":42,"browserify-mime":111,"extend":158}],111:[function(require,module,exports){
//this file was generated
"use strict"
var mime = module.exports = {
    lookup: function (path, fallback) {
  var ext = path.replace(/.*[\.\/]/, '').toLowerCase();

  return this.types[ext] || fallback || this.default_type;
}
  , default_type: "application/octet-stream"
  , types: {
  "123": "application/vnd.lotus-1-2-3",
  "ez": "application/andrew-inset",
  "aw": "application/applixware",
  "atom": "application/atom+xml",
  "atomcat": "application/atomcat+xml",
  "atomsvc": "application/atomsvc+xml",
  "ccxml": "application/ccxml+xml",
  "cdmia": "application/cdmi-capability",
  "cdmic": "application/cdmi-container",
  "cdmid": "application/cdmi-domain",
  "cdmio": "application/cdmi-object",
  "cdmiq": "application/cdmi-queue",
  "cu": "application/cu-seeme",
  "davmount": "application/davmount+xml",
  "dbk": "application/docbook+xml",
  "dssc": "application/dssc+der",
  "xdssc": "application/dssc+xml",
  "ecma": "application/ecmascript",
  "emma": "application/emma+xml",
  "epub": "application/epub+zip",
  "exi": "application/exi",
  "pfr": "application/font-tdpfr",
  "gml": "application/gml+xml",
  "gpx": "application/gpx+xml",
  "gxf": "application/gxf",
  "stk": "application/hyperstudio",
  "ink": "application/inkml+xml",
  "inkml": "application/inkml+xml",
  "ipfix": "application/ipfix",
  "jar": "application/java-archive",
  "ser": "application/java-serialized-object",
  "class": "application/java-vm",
  "js": "application/javascript",
  "json": "application/json",
  "jsonml": "application/jsonml+json",
  "lostxml": "application/lost+xml",
  "hqx": "application/mac-binhex40",
  "cpt": "application/mac-compactpro",
  "mads": "application/mads+xml",
  "mrc": "application/marc",
  "mrcx": "application/marcxml+xml",
  "ma": "application/mathematica",
  "nb": "application/mathematica",
  "mb": "application/mathematica",
  "mathml": "application/mathml+xml",
  "mbox": "application/mbox",
  "mscml": "application/mediaservercontrol+xml",
  "metalink": "application/metalink+xml",
  "meta4": "application/metalink4+xml",
  "mets": "application/mets+xml",
  "mods": "application/mods+xml",
  "m21": "application/mp21",
  "mp21": "application/mp21",
  "mp4s": "application/mp4",
  "doc": "application/msword",
  "dot": "application/msword",
  "mxf": "application/mxf",
  "bin": "application/octet-stream",
  "dms": "application/octet-stream",
  "lrf": "application/octet-stream",
  "mar": "application/octet-stream",
  "so": "application/octet-stream",
  "dist": "application/octet-stream",
  "distz": "application/octet-stream",
  "pkg": "application/octet-stream",
  "bpk": "application/octet-stream",
  "dump": "application/octet-stream",
  "elc": "application/octet-stream",
  "deploy": "application/octet-stream",
  "oda": "application/oda",
  "opf": "application/oebps-package+xml",
  "ogx": "application/ogg",
  "omdoc": "application/omdoc+xml",
  "onetoc": "application/onenote",
  "onetoc2": "application/onenote",
  "onetmp": "application/onenote",
  "onepkg": "application/onenote",
  "oxps": "application/oxps",
  "xer": "application/patch-ops-error+xml",
  "pdf": "application/pdf",
  "pgp": "application/pgp-encrypted",
  "asc": "application/pgp-signature",
  "sig": "application/pgp-signature",
  "prf": "application/pics-rules",
  "p10": "application/pkcs10",
  "p7m": "application/pkcs7-mime",
  "p7c": "application/pkcs7-mime",
  "p7s": "application/pkcs7-signature",
  "p8": "application/pkcs8",
  "ac": "application/pkix-attr-cert",
  "cer": "application/pkix-cert",
  "crl": "application/pkix-crl",
  "pkipath": "application/pkix-pkipath",
  "pki": "application/pkixcmp",
  "pls": "application/pls+xml",
  "ai": "application/postscript",
  "eps": "application/postscript",
  "ps": "application/postscript",
  "cww": "application/prs.cww",
  "pskcxml": "application/pskc+xml",
  "rdf": "application/rdf+xml",
  "rif": "application/reginfo+xml",
  "rnc": "application/relax-ng-compact-syntax",
  "rl": "application/resource-lists+xml",
  "rld": "application/resource-lists-diff+xml",
  "rs": "application/rls-services+xml",
  "gbr": "application/rpki-ghostbusters",
  "mft": "application/rpki-manifest",
  "roa": "application/rpki-roa",
  "rsd": "application/rsd+xml",
  "rss": "application/rss+xml",
  "rtf": "application/rtf",
  "sbml": "application/sbml+xml",
  "scq": "application/scvp-cv-request",
  "scs": "application/scvp-cv-response",
  "spq": "application/scvp-vp-request",
  "spp": "application/scvp-vp-response",
  "sdp": "application/sdp",
  "setpay": "application/set-payment-initiation",
  "setreg": "application/set-registration-initiation",
  "shf": "application/shf+xml",
  "smi": "application/smil+xml",
  "smil": "application/smil+xml",
  "rq": "application/sparql-query",
  "srx": "application/sparql-results+xml",
  "gram": "application/srgs",
  "grxml": "application/srgs+xml",
  "sru": "application/sru+xml",
  "ssdl": "application/ssdl+xml",
  "ssml": "application/ssml+xml",
  "tei": "application/tei+xml",
  "teicorpus": "application/tei+xml",
  "tfi": "application/thraud+xml",
  "tsd": "application/timestamped-data",
  "plb": "application/vnd.3gpp.pic-bw-large",
  "psb": "application/vnd.3gpp.pic-bw-small",
  "pvb": "application/vnd.3gpp.pic-bw-var",
  "tcap": "application/vnd.3gpp2.tcap",
  "pwn": "application/vnd.3m.post-it-notes",
  "aso": "application/vnd.accpac.simply.aso",
  "imp": "application/vnd.accpac.simply.imp",
  "acu": "application/vnd.acucobol",
  "atc": "application/vnd.acucorp",
  "acutc": "application/vnd.acucorp",
  "air": "application/vnd.adobe.air-application-installer-package+zip",
  "fcdt": "application/vnd.adobe.formscentral.fcdt",
  "fxp": "application/vnd.adobe.fxp",
  "fxpl": "application/vnd.adobe.fxp",
  "xdp": "application/vnd.adobe.xdp+xml",
  "xfdf": "application/vnd.adobe.xfdf",
  "ahead": "application/vnd.ahead.space",
  "azf": "application/vnd.airzip.filesecure.azf",
  "azs": "application/vnd.airzip.filesecure.azs",
  "azw": "application/vnd.amazon.ebook",
  "acc": "application/vnd.americandynamics.acc",
  "ami": "application/vnd.amiga.ami",
  "apk": "application/vnd.android.package-archive",
  "cii": "application/vnd.anser-web-certificate-issue-initiation",
  "fti": "application/vnd.anser-web-funds-transfer-initiation",
  "atx": "application/vnd.antix.game-component",
  "mpkg": "application/vnd.apple.installer+xml",
  "m3u8": "application/vnd.apple.mpegurl",
  "swi": "application/vnd.aristanetworks.swi",
  "iota": "application/vnd.astraea-software.iota",
  "aep": "application/vnd.audiograph",
  "mpm": "application/vnd.blueice.multipass",
  "bmi": "application/vnd.bmi",
  "rep": "application/vnd.businessobjects",
  "cdxml": "application/vnd.chemdraw+xml",
  "mmd": "application/vnd.chipnuts.karaoke-mmd",
  "cdy": "application/vnd.cinderella",
  "cla": "application/vnd.claymore",
  "rp9": "application/vnd.cloanto.rp9",
  "c4g": "application/vnd.clonk.c4group",
  "c4d": "application/vnd.clonk.c4group",
  "c4f": "application/vnd.clonk.c4group",
  "c4p": "application/vnd.clonk.c4group",
  "c4u": "application/vnd.clonk.c4group",
  "c11amc": "application/vnd.cluetrust.cartomobile-config",
  "c11amz": "application/vnd.cluetrust.cartomobile-config-pkg",
  "csp": "application/vnd.commonspace",
  "cdbcmsg": "application/vnd.contact.cmsg",
  "cmc": "application/vnd.cosmocaller",
  "clkx": "application/vnd.crick.clicker",
  "clkk": "application/vnd.crick.clicker.keyboard",
  "clkp": "application/vnd.crick.clicker.palette",
  "clkt": "application/vnd.crick.clicker.template",
  "clkw": "application/vnd.crick.clicker.wordbank",
  "wbs": "application/vnd.criticaltools.wbs+xml",
  "pml": "application/vnd.ctc-posml",
  "ppd": "application/vnd.cups-ppd",
  "car": "application/vnd.curl.car",
  "pcurl": "application/vnd.curl.pcurl",
  "dart": "application/vnd.dart",
  "rdz": "application/vnd.data-vision.rdz",
  "uvf": "application/vnd.dece.data",
  "uvvf": "application/vnd.dece.data",
  "uvd": "application/vnd.dece.data",
  "uvvd": "application/vnd.dece.data",
  "uvt": "application/vnd.dece.ttml+xml",
  "uvvt": "application/vnd.dece.ttml+xml",
  "uvx": "application/vnd.dece.unspecified",
  "uvvx": "application/vnd.dece.unspecified",
  "uvz": "application/vnd.dece.zip",
  "uvvz": "application/vnd.dece.zip",
  "fe_launch": "application/vnd.denovo.fcselayout-link",
  "dna": "application/vnd.dna",
  "mlp": "application/vnd.dolby.mlp",
  "dpg": "application/vnd.dpgraph",
  "dfac": "application/vnd.dreamfactory",
  "kpxx": "application/vnd.ds-keypoint",
  "ait": "application/vnd.dvb.ait",
  "svc": "application/vnd.dvb.service",
  "geo": "application/vnd.dynageo",
  "mag": "application/vnd.ecowin.chart",
  "nml": "application/vnd.enliven",
  "esf": "application/vnd.epson.esf",
  "msf": "application/vnd.epson.msf",
  "qam": "application/vnd.epson.quickanime",
  "slt": "application/vnd.epson.salt",
  "ssf": "application/vnd.epson.ssf",
  "es3": "application/vnd.eszigno3+xml",
  "et3": "application/vnd.eszigno3+xml",
  "ez2": "application/vnd.ezpix-album",
  "ez3": "application/vnd.ezpix-package",
  "fdf": "application/vnd.fdf",
  "mseed": "application/vnd.fdsn.mseed",
  "seed": "application/vnd.fdsn.seed",
  "dataless": "application/vnd.fdsn.seed",
  "gph": "application/vnd.flographit",
  "ftc": "application/vnd.fluxtime.clip",
  "fm": "application/vnd.framemaker",
  "frame": "application/vnd.framemaker",
  "maker": "application/vnd.framemaker",
  "book": "application/vnd.framemaker",
  "fnc": "application/vnd.frogans.fnc",
  "ltf": "application/vnd.frogans.ltf",
  "fsc": "application/vnd.fsc.weblaunch",
  "oas": "application/vnd.fujitsu.oasys",
  "oa2": "application/vnd.fujitsu.oasys2",
  "oa3": "application/vnd.fujitsu.oasys3",
  "fg5": "application/vnd.fujitsu.oasysgp",
  "bh2": "application/vnd.fujitsu.oasysprs",
  "ddd": "application/vnd.fujixerox.ddd",
  "xdw": "application/vnd.fujixerox.docuworks",
  "xbd": "application/vnd.fujixerox.docuworks.binder",
  "fzs": "application/vnd.fuzzysheet",
  "txd": "application/vnd.genomatix.tuxedo",
  "ggb": "application/vnd.geogebra.file",
  "ggt": "application/vnd.geogebra.tool",
  "gex": "application/vnd.geometry-explorer",
  "gre": "application/vnd.geometry-explorer",
  "gxt": "application/vnd.geonext",
  "g2w": "application/vnd.geoplan",
  "g3w": "application/vnd.geospace",
  "gmx": "application/vnd.gmx",
  "kml": "application/vnd.google-earth.kml+xml",
  "kmz": "application/vnd.google-earth.kmz",
  "gqf": "application/vnd.grafeq",
  "gqs": "application/vnd.grafeq",
  "gac": "application/vnd.groove-account",
  "ghf": "application/vnd.groove-help",
  "gim": "application/vnd.groove-identity-message",
  "grv": "application/vnd.groove-injector",
  "gtm": "application/vnd.groove-tool-message",
  "tpl": "application/vnd.groove-tool-template",
  "vcg": "application/vnd.groove-vcard",
  "hal": "application/vnd.hal+xml",
  "zmm": "application/vnd.handheld-entertainment+xml",
  "hbci": "application/vnd.hbci",
  "les": "application/vnd.hhe.lesson-player",
  "hpgl": "application/vnd.hp-hpgl",
  "hpid": "application/vnd.hp-hpid",
  "hps": "application/vnd.hp-hps",
  "jlt": "application/vnd.hp-jlyt",
  "pcl": "application/vnd.hp-pcl",
  "pclxl": "application/vnd.hp-pclxl",
  "sfd-hdstx": "application/vnd.hydrostatix.sof-data",
  "mpy": "application/vnd.ibm.minipay",
  "afp": "application/vnd.ibm.modcap",
  "listafp": "application/vnd.ibm.modcap",
  "list3820": "application/vnd.ibm.modcap",
  "irm": "application/vnd.ibm.rights-management",
  "sc": "application/vnd.ibm.secure-container",
  "icc": "application/vnd.iccprofile",
  "icm": "application/vnd.iccprofile",
  "igl": "application/vnd.igloader",
  "ivp": "application/vnd.immervision-ivp",
  "ivu": "application/vnd.immervision-ivu",
  "igm": "application/vnd.insors.igm",
  "xpw": "application/vnd.intercon.formnet",
  "xpx": "application/vnd.intercon.formnet",
  "i2g": "application/vnd.intergeo",
  "qbo": "application/vnd.intu.qbo",
  "qfx": "application/vnd.intu.qfx",
  "rcprofile": "application/vnd.ipunplugged.rcprofile",
  "irp": "application/vnd.irepository.package+xml",
  "xpr": "application/vnd.is-xpr",
  "fcs": "application/vnd.isac.fcs",
  "jam": "application/vnd.jam",
  "rms": "application/vnd.jcp.javame.midlet-rms",
  "jisp": "application/vnd.jisp",
  "joda": "application/vnd.joost.joda-archive",
  "ktz": "application/vnd.kahootz",
  "ktr": "application/vnd.kahootz",
  "karbon": "application/vnd.kde.karbon",
  "chrt": "application/vnd.kde.kchart",
  "kfo": "application/vnd.kde.kformula",
  "flw": "application/vnd.kde.kivio",
  "kon": "application/vnd.kde.kontour",
  "kpr": "application/vnd.kde.kpresenter",
  "kpt": "application/vnd.kde.kpresenter",
  "ksp": "application/vnd.kde.kspread",
  "kwd": "application/vnd.kde.kword",
  "kwt": "application/vnd.kde.kword",
  "htke": "application/vnd.kenameaapp",
  "kia": "application/vnd.kidspiration",
  "kne": "application/vnd.kinar",
  "knp": "application/vnd.kinar",
  "skp": "application/vnd.koan",
  "skd": "application/vnd.koan",
  "skt": "application/vnd.koan",
  "skm": "application/vnd.koan",
  "sse": "application/vnd.kodak-descriptor",
  "lasxml": "application/vnd.las.las+xml",
  "lbd": "application/vnd.llamagraphics.life-balance.desktop",
  "lbe": "application/vnd.llamagraphics.life-balance.exchange+xml",
  "apr": "application/vnd.lotus-approach",
  "pre": "application/vnd.lotus-freelance",
  "nsf": "application/vnd.lotus-notes",
  "org": "application/vnd.lotus-organizer",
  "scm": "application/vnd.lotus-screencam",
  "lwp": "application/vnd.lotus-wordpro",
  "portpkg": "application/vnd.macports.portpkg",
  "mcd": "application/vnd.mcd",
  "mc1": "application/vnd.medcalcdata",
  "cdkey": "application/vnd.mediastation.cdkey",
  "mwf": "application/vnd.mfer",
  "mfm": "application/vnd.mfmp",
  "flo": "application/vnd.micrografx.flo",
  "igx": "application/vnd.micrografx.igx",
  "mif": "application/vnd.mif",
  "daf": "application/vnd.mobius.daf",
  "dis": "application/vnd.mobius.dis",
  "mbk": "application/vnd.mobius.mbk",
  "mqy": "application/vnd.mobius.mqy",
  "msl": "application/vnd.mobius.msl",
  "plc": "application/vnd.mobius.plc",
  "txf": "application/vnd.mobius.txf",
  "mpn": "application/vnd.mophun.application",
  "mpc": "application/vnd.mophun.certificate",
  "xul": "application/vnd.mozilla.xul+xml",
  "cil": "application/vnd.ms-artgalry",
  "cab": "application/vnd.ms-cab-compressed",
  "xls": "application/vnd.ms-excel",
  "xlm": "application/vnd.ms-excel",
  "xla": "application/vnd.ms-excel",
  "xlc": "application/vnd.ms-excel",
  "xlt": "application/vnd.ms-excel",
  "xlw": "application/vnd.ms-excel",
  "xlam": "application/vnd.ms-excel.addin.macroenabled.12",
  "xlsb": "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  "xlsm": "application/vnd.ms-excel.sheet.macroenabled.12",
  "xltm": "application/vnd.ms-excel.template.macroenabled.12",
  "eot": "application/vnd.ms-fontobject",
  "chm": "application/vnd.ms-htmlhelp",
  "ims": "application/vnd.ms-ims",
  "lrm": "application/vnd.ms-lrm",
  "thmx": "application/vnd.ms-officetheme",
  "cat": "application/vnd.ms-pki.seccat",
  "stl": "application/vnd.ms-pki.stl",
  "ppt": "application/vnd.ms-powerpoint",
  "pps": "application/vnd.ms-powerpoint",
  "pot": "application/vnd.ms-powerpoint",
  "ppam": "application/vnd.ms-powerpoint.addin.macroenabled.12",
  "pptm": "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  "sldm": "application/vnd.ms-powerpoint.slide.macroenabled.12",
  "ppsm": "application/vnd.ms-powerpoint.slideshow.macroenabled.12",
  "potm": "application/vnd.ms-powerpoint.template.macroenabled.12",
  "mpp": "application/vnd.ms-project",
  "mpt": "application/vnd.ms-project",
  "docm": "application/vnd.ms-word.document.macroenabled.12",
  "dotm": "application/vnd.ms-word.template.macroenabled.12",
  "wps": "application/vnd.ms-works",
  "wks": "application/vnd.ms-works",
  "wcm": "application/vnd.ms-works",
  "wdb": "application/vnd.ms-works",
  "wpl": "application/vnd.ms-wpl",
  "xps": "application/vnd.ms-xpsdocument",
  "mseq": "application/vnd.mseq",
  "mus": "application/vnd.musician",
  "msty": "application/vnd.muvee.style",
  "taglet": "application/vnd.mynfc",
  "nlu": "application/vnd.neurolanguage.nlu",
  "ntf": "application/vnd.nitf",
  "nitf": "application/vnd.nitf",
  "nnd": "application/vnd.noblenet-directory",
  "nns": "application/vnd.noblenet-sealer",
  "nnw": "application/vnd.noblenet-web",
  "ngdat": "application/vnd.nokia.n-gage.data",
  "n-gage": "application/vnd.nokia.n-gage.symbian.install",
  "rpst": "application/vnd.nokia.radio-preset",
  "rpss": "application/vnd.nokia.radio-presets",
  "edm": "application/vnd.novadigm.edm",
  "edx": "application/vnd.novadigm.edx",
  "ext": "application/vnd.novadigm.ext",
  "odc": "application/vnd.oasis.opendocument.chart",
  "otc": "application/vnd.oasis.opendocument.chart-template",
  "odb": "application/vnd.oasis.opendocument.database",
  "odf": "application/vnd.oasis.opendocument.formula",
  "odft": "application/vnd.oasis.opendocument.formula-template",
  "odg": "application/vnd.oasis.opendocument.graphics",
  "otg": "application/vnd.oasis.opendocument.graphics-template",
  "odi": "application/vnd.oasis.opendocument.image",
  "oti": "application/vnd.oasis.opendocument.image-template",
  "odp": "application/vnd.oasis.opendocument.presentation",
  "otp": "application/vnd.oasis.opendocument.presentation-template",
  "ods": "application/vnd.oasis.opendocument.spreadsheet",
  "ots": "application/vnd.oasis.opendocument.spreadsheet-template",
  "odt": "application/vnd.oasis.opendocument.text",
  "odm": "application/vnd.oasis.opendocument.text-master",
  "ott": "application/vnd.oasis.opendocument.text-template",
  "oth": "application/vnd.oasis.opendocument.text-web",
  "xo": "application/vnd.olpc-sugar",
  "dd2": "application/vnd.oma.dd2+xml",
  "oxt": "application/vnd.openofficeorg.extension",
  "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "sldx": "application/vnd.openxmlformats-officedocument.presentationml.slide",
  "ppsx": "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  "potx": "application/vnd.openxmlformats-officedocument.presentationml.template",
  "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "xltx": "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "dotx": "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  "mgp": "application/vnd.osgeo.mapguide.package",
  "dp": "application/vnd.osgi.dp",
  "esa": "application/vnd.osgi.subsystem",
  "pdb": "application/vnd.palm",
  "pqa": "application/vnd.palm",
  "oprc": "application/vnd.palm",
  "paw": "application/vnd.pawaafile",
  "str": "application/vnd.pg.format",
  "ei6": "application/vnd.pg.osasli",
  "efif": "application/vnd.picsel",
  "wg": "application/vnd.pmi.widget",
  "plf": "application/vnd.pocketlearn",
  "pbd": "application/vnd.powerbuilder6",
  "box": "application/vnd.previewsystems.box",
  "mgz": "application/vnd.proteus.magazine",
  "qps": "application/vnd.publishare-delta-tree",
  "ptid": "application/vnd.pvi.ptid1",
  "qxd": "application/vnd.quark.quarkxpress",
  "qxt": "application/vnd.quark.quarkxpress",
  "qwd": "application/vnd.quark.quarkxpress",
  "qwt": "application/vnd.quark.quarkxpress",
  "qxl": "application/vnd.quark.quarkxpress",
  "qxb": "application/vnd.quark.quarkxpress",
  "bed": "application/vnd.realvnc.bed",
  "mxl": "application/vnd.recordare.musicxml",
  "musicxml": "application/vnd.recordare.musicxml+xml",
  "cryptonote": "application/vnd.rig.cryptonote",
  "cod": "application/vnd.rim.cod",
  "rm": "application/vnd.rn-realmedia",
  "rmvb": "application/vnd.rn-realmedia-vbr",
  "link66": "application/vnd.route66.link66+xml",
  "st": "application/vnd.sailingtracker.track",
  "see": "application/vnd.seemail",
  "sema": "application/vnd.sema",
  "semd": "application/vnd.semd",
  "semf": "application/vnd.semf",
  "ifm": "application/vnd.shana.informed.formdata",
  "itp": "application/vnd.shana.informed.formtemplate",
  "iif": "application/vnd.shana.informed.interchange",
  "ipk": "application/vnd.shana.informed.package",
  "twd": "application/vnd.simtech-mindmapper",
  "twds": "application/vnd.simtech-mindmapper",
  "mmf": "application/vnd.smaf",
  "teacher": "application/vnd.smart.teacher",
  "sdkm": "application/vnd.solent.sdkm+xml",
  "sdkd": "application/vnd.solent.sdkm+xml",
  "dxp": "application/vnd.spotfire.dxp",
  "sfs": "application/vnd.spotfire.sfs",
  "sdc": "application/vnd.stardivision.calc",
  "sda": "application/vnd.stardivision.draw",
  "sdd": "application/vnd.stardivision.impress",
  "smf": "application/vnd.stardivision.math",
  "sdw": "application/vnd.stardivision.writer",
  "vor": "application/vnd.stardivision.writer",
  "sgl": "application/vnd.stardivision.writer-global",
  "smzip": "application/vnd.stepmania.package",
  "sm": "application/vnd.stepmania.stepchart",
  "sxc": "application/vnd.sun.xml.calc",
  "stc": "application/vnd.sun.xml.calc.template",
  "sxd": "application/vnd.sun.xml.draw",
  "std": "application/vnd.sun.xml.draw.template",
  "sxi": "application/vnd.sun.xml.impress",
  "sti": "application/vnd.sun.xml.impress.template",
  "sxm": "application/vnd.sun.xml.math",
  "sxw": "application/vnd.sun.xml.writer",
  "sxg": "application/vnd.sun.xml.writer.global",
  "stw": "application/vnd.sun.xml.writer.template",
  "sus": "application/vnd.sus-calendar",
  "susp": "application/vnd.sus-calendar",
  "svd": "application/vnd.svd",
  "sis": "application/vnd.symbian.install",
  "sisx": "application/vnd.symbian.install",
  "xsm": "application/vnd.syncml+xml",
  "bdm": "application/vnd.syncml.dm+wbxml",
  "xdm": "application/vnd.syncml.dm+xml",
  "tao": "application/vnd.tao.intent-module-archive",
  "pcap": "application/vnd.tcpdump.pcap",
  "cap": "application/vnd.tcpdump.pcap",
  "dmp": "application/vnd.tcpdump.pcap",
  "tmo": "application/vnd.tmobile-livetv",
  "tpt": "application/vnd.trid.tpt",
  "mxs": "application/vnd.triscape.mxs",
  "tra": "application/vnd.trueapp",
  "ufd": "application/vnd.ufdl",
  "ufdl": "application/vnd.ufdl",
  "utz": "application/vnd.uiq.theme",
  "umj": "application/vnd.umajin",
  "unityweb": "application/vnd.unity",
  "uoml": "application/vnd.uoml+xml",
  "vcx": "application/vnd.vcx",
  "vsd": "application/vnd.visio",
  "vst": "application/vnd.visio",
  "vss": "application/vnd.visio",
  "vsw": "application/vnd.visio",
  "vis": "application/vnd.visionary",
  "vsf": "application/vnd.vsf",
  "wbxml": "application/vnd.wap.wbxml",
  "wmlc": "application/vnd.wap.wmlc",
  "wmlsc": "application/vnd.wap.wmlscriptc",
  "wtb": "application/vnd.webturbo",
  "nbp": "application/vnd.wolfram.player",
  "wpd": "application/vnd.wordperfect",
  "wqd": "application/vnd.wqd",
  "stf": "application/vnd.wt.stf",
  "xar": "application/vnd.xara",
  "xfdl": "application/vnd.xfdl",
  "hvd": "application/vnd.yamaha.hv-dic",
  "hvs": "application/vnd.yamaha.hv-script",
  "hvp": "application/vnd.yamaha.hv-voice",
  "osf": "application/vnd.yamaha.openscoreformat",
  "osfpvg": "application/vnd.yamaha.openscoreformat.osfpvg+xml",
  "saf": "application/vnd.yamaha.smaf-audio",
  "spf": "application/vnd.yamaha.smaf-phrase",
  "cmp": "application/vnd.yellowriver-custom-menu",
  "zir": "application/vnd.zul",
  "zirz": "application/vnd.zul",
  "zaz": "application/vnd.zzazz.deck+xml",
  "vxml": "application/voicexml+xml",
  "wgt": "application/widget",
  "hlp": "application/winhlp",
  "wsdl": "application/wsdl+xml",
  "wspolicy": "application/wspolicy+xml",
  "7z": "application/x-7z-compressed",
  "abw": "application/x-abiword",
  "ace": "application/x-ace-compressed",
  "dmg": "application/x-apple-diskimage",
  "aab": "application/x-authorware-bin",
  "x32": "application/x-authorware-bin",
  "u32": "application/x-authorware-bin",
  "vox": "application/x-authorware-bin",
  "aam": "application/x-authorware-map",
  "aas": "application/x-authorware-seg",
  "bcpio": "application/x-bcpio",
  "torrent": "application/x-bittorrent",
  "blb": "application/x-blorb",
  "blorb": "application/x-blorb",
  "bz": "application/x-bzip",
  "bz2": "application/x-bzip2",
  "boz": "application/x-bzip2",
  "cbr": "application/x-cbr",
  "cba": "application/x-cbr",
  "cbt": "application/x-cbr",
  "cbz": "application/x-cbr",
  "cb7": "application/x-cbr",
  "vcd": "application/x-cdlink",
  "cfs": "application/x-cfs-compressed",
  "chat": "application/x-chat",
  "pgn": "application/x-chess-pgn",
  "nsc": "application/x-conference",
  "cpio": "application/x-cpio",
  "csh": "application/x-csh",
  "deb": "application/x-debian-package",
  "udeb": "application/x-debian-package",
  "dgc": "application/x-dgc-compressed",
  "dir": "application/x-director",
  "dcr": "application/x-director",
  "dxr": "application/x-director",
  "cst": "application/x-director",
  "cct": "application/x-director",
  "cxt": "application/x-director",
  "w3d": "application/x-director",
  "fgd": "application/x-director",
  "swa": "application/x-director",
  "wad": "application/x-doom",
  "ncx": "application/x-dtbncx+xml",
  "dtb": "application/x-dtbook+xml",
  "res": "application/x-dtbresource+xml",
  "dvi": "application/x-dvi",
  "evy": "application/x-envoy",
  "eva": "application/x-eva",
  "bdf": "application/x-font-bdf",
  "gsf": "application/x-font-ghostscript",
  "psf": "application/x-font-linux-psf",
  "otf": "application/x-font-otf",
  "pcf": "application/x-font-pcf",
  "snf": "application/x-font-snf",
  "ttf": "application/x-font-ttf",
  "ttc": "application/x-font-ttf",
  "pfa": "application/x-font-type1",
  "pfb": "application/x-font-type1",
  "pfm": "application/x-font-type1",
  "afm": "application/x-font-type1",
  "woff": "application/x-font-woff",
  "arc": "application/x-freearc",
  "spl": "application/x-futuresplash",
  "gca": "application/x-gca-compressed",
  "ulx": "application/x-glulx",
  "gnumeric": "application/x-gnumeric",
  "gramps": "application/x-gramps-xml",
  "gtar": "application/x-gtar",
  "hdf": "application/x-hdf",
  "install": "application/x-install-instructions",
  "iso": "application/x-iso9660-image",
  "jnlp": "application/x-java-jnlp-file",
  "latex": "application/x-latex",
  "lzh": "application/x-lzh-compressed",
  "lha": "application/x-lzh-compressed",
  "mie": "application/x-mie",
  "prc": "application/x-mobipocket-ebook",
  "mobi": "application/x-mobipocket-ebook",
  "application": "application/x-ms-application",
  "lnk": "application/x-ms-shortcut",
  "wmd": "application/x-ms-wmd",
  "wmz": "application/x-msmetafile",
  "xbap": "application/x-ms-xbap",
  "mdb": "application/x-msaccess",
  "obd": "application/x-msbinder",
  "crd": "application/x-mscardfile",
  "clp": "application/x-msclip",
  "exe": "application/x-msdownload",
  "dll": "application/x-msdownload",
  "com": "application/x-msdownload",
  "bat": "application/x-msdownload",
  "msi": "application/x-msdownload",
  "mvb": "application/x-msmediaview",
  "m13": "application/x-msmediaview",
  "m14": "application/x-msmediaview",
  "wmf": "application/x-msmetafile",
  "emf": "application/x-msmetafile",
  "emz": "application/x-msmetafile",
  "mny": "application/x-msmoney",
  "pub": "application/x-mspublisher",
  "scd": "application/x-msschedule",
  "trm": "application/x-msterminal",
  "wri": "application/x-mswrite",
  "nc": "application/x-netcdf",
  "cdf": "application/x-netcdf",
  "nzb": "application/x-nzb",
  "p12": "application/x-pkcs12",
  "pfx": "application/x-pkcs12",
  "p7b": "application/x-pkcs7-certificates",
  "spc": "application/x-pkcs7-certificates",
  "p7r": "application/x-pkcs7-certreqresp",
  "rar": "application/x-rar-compressed",
  "ris": "application/x-research-info-systems",
  "sh": "application/x-sh",
  "shar": "application/x-shar",
  "swf": "application/x-shockwave-flash",
  "xap": "application/x-silverlight-app",
  "sql": "application/x-sql",
  "sit": "application/x-stuffit",
  "sitx": "application/x-stuffitx",
  "srt": "application/x-subrip",
  "sv4cpio": "application/x-sv4cpio",
  "sv4crc": "application/x-sv4crc",
  "t3": "application/x-t3vm-image",
  "gam": "application/x-tads",
  "tar": "application/x-tar",
  "tcl": "application/x-tcl",
  "tex": "application/x-tex",
  "tfm": "application/x-tex-tfm",
  "texinfo": "application/x-texinfo",
  "texi": "application/x-texinfo",
  "obj": "application/x-tgif",
  "ustar": "application/x-ustar",
  "src": "application/x-wais-source",
  "der": "application/x-x509-ca-cert",
  "crt": "application/x-x509-ca-cert",
  "fig": "application/x-xfig",
  "xlf": "application/x-xliff+xml",
  "xpi": "application/x-xpinstall",
  "xz": "application/x-xz",
  "z1": "application/x-zmachine",
  "z2": "application/x-zmachine",
  "z3": "application/x-zmachine",
  "z4": "application/x-zmachine",
  "z5": "application/x-zmachine",
  "z6": "application/x-zmachine",
  "z7": "application/x-zmachine",
  "z8": "application/x-zmachine",
  "xaml": "application/xaml+xml",
  "xdf": "application/xcap-diff+xml",
  "xenc": "application/xenc+xml",
  "xhtml": "application/xhtml+xml",
  "xht": "application/xhtml+xml",
  "xml": "application/xml",
  "xsl": "application/xml",
  "dtd": "application/xml-dtd",
  "xop": "application/xop+xml",
  "xpl": "application/xproc+xml",
  "xslt": "application/xslt+xml",
  "xspf": "application/xspf+xml",
  "mxml": "application/xv+xml",
  "xhvml": "application/xv+xml",
  "xvml": "application/xv+xml",
  "xvm": "application/xv+xml",
  "yang": "application/yang",
  "yin": "application/yin+xml",
  "zip": "application/zip",
  "adp": "audio/adpcm",
  "au": "audio/basic",
  "snd": "audio/basic",
  "mid": "audio/midi",
  "midi": "audio/midi",
  "kar": "audio/midi",
  "rmi": "audio/midi",
  "mp4a": "audio/mp4",
  "mpga": "audio/mpeg",
  "mp2": "audio/mpeg",
  "mp2a": "audio/mpeg",
  "mp3": "audio/mpeg",
  "m2a": "audio/mpeg",
  "m3a": "audio/mpeg",
  "oga": "audio/ogg",
  "ogg": "audio/ogg",
  "spx": "audio/ogg",
  "s3m": "audio/s3m",
  "sil": "audio/silk",
  "uva": "audio/vnd.dece.audio",
  "uvva": "audio/vnd.dece.audio",
  "eol": "audio/vnd.digital-winds",
  "dra": "audio/vnd.dra",
  "dts": "audio/vnd.dts",
  "dtshd": "audio/vnd.dts.hd",
  "lvp": "audio/vnd.lucent.voice",
  "pya": "audio/vnd.ms-playready.media.pya",
  "ecelp4800": "audio/vnd.nuera.ecelp4800",
  "ecelp7470": "audio/vnd.nuera.ecelp7470",
  "ecelp9600": "audio/vnd.nuera.ecelp9600",
  "rip": "audio/vnd.rip",
  "weba": "audio/webm",
  "aac": "audio/x-aac",
  "aif": "audio/x-aiff",
  "aiff": "audio/x-aiff",
  "aifc": "audio/x-aiff",
  "caf": "audio/x-caf",
  "flac": "audio/x-flac",
  "mka": "audio/x-matroska",
  "m3u": "audio/x-mpegurl",
  "wax": "audio/x-ms-wax",
  "wma": "audio/x-ms-wma",
  "ram": "audio/x-pn-realaudio",
  "ra": "audio/x-pn-realaudio",
  "rmp": "audio/x-pn-realaudio-plugin",
  "wav": "audio/x-wav",
  "xm": "audio/xm",
  "cdx": "chemical/x-cdx",
  "cif": "chemical/x-cif",
  "cmdf": "chemical/x-cmdf",
  "cml": "chemical/x-cml",
  "csml": "chemical/x-csml",
  "xyz": "chemical/x-xyz",
  "bmp": "image/bmp",
  "cgm": "image/cgm",
  "g3": "image/g3fax",
  "gif": "image/gif",
  "ief": "image/ief",
  "jpeg": "image/jpeg",
  "jpg": "image/jpeg",
  "jpe": "image/jpeg",
  "ktx": "image/ktx",
  "png": "image/png",
  "btif": "image/prs.btif",
  "sgi": "image/sgi",
  "svg": "image/svg+xml",
  "svgz": "image/svg+xml",
  "tiff": "image/tiff",
  "tif": "image/tiff",
  "psd": "image/vnd.adobe.photoshop",
  "uvi": "image/vnd.dece.graphic",
  "uvvi": "image/vnd.dece.graphic",
  "uvg": "image/vnd.dece.graphic",
  "uvvg": "image/vnd.dece.graphic",
  "sub": "text/vnd.dvb.subtitle",
  "djvu": "image/vnd.djvu",
  "djv": "image/vnd.djvu",
  "dwg": "image/vnd.dwg",
  "dxf": "image/vnd.dxf",
  "fbs": "image/vnd.fastbidsheet",
  "fpx": "image/vnd.fpx",
  "fst": "image/vnd.fst",
  "mmr": "image/vnd.fujixerox.edmics-mmr",
  "rlc": "image/vnd.fujixerox.edmics-rlc",
  "mdi": "image/vnd.ms-modi",
  "wdp": "image/vnd.ms-photo",
  "npx": "image/vnd.net-fpx",
  "wbmp": "image/vnd.wap.wbmp",
  "xif": "image/vnd.xiff",
  "webp": "image/webp",
  "3ds": "image/x-3ds",
  "ras": "image/x-cmu-raster",
  "cmx": "image/x-cmx",
  "fh": "image/x-freehand",
  "fhc": "image/x-freehand",
  "fh4": "image/x-freehand",
  "fh5": "image/x-freehand",
  "fh7": "image/x-freehand",
  "ico": "image/x-icon",
  "sid": "image/x-mrsid-image",
  "pcx": "image/x-pcx",
  "pic": "image/x-pict",
  "pct": "image/x-pict",
  "pnm": "image/x-portable-anymap",
  "pbm": "image/x-portable-bitmap",
  "pgm": "image/x-portable-graymap",
  "ppm": "image/x-portable-pixmap",
  "rgb": "image/x-rgb",
  "tga": "image/x-tga",
  "xbm": "image/x-xbitmap",
  "xpm": "image/x-xpixmap",
  "xwd": "image/x-xwindowdump",
  "eml": "message/rfc822",
  "mime": "message/rfc822",
  "igs": "model/iges",
  "iges": "model/iges",
  "msh": "model/mesh",
  "mesh": "model/mesh",
  "silo": "model/mesh",
  "dae": "model/vnd.collada+xml",
  "dwf": "model/vnd.dwf",
  "gdl": "model/vnd.gdl",
  "gtw": "model/vnd.gtw",
  "mts": "model/vnd.mts",
  "vtu": "model/vnd.vtu",
  "wrl": "model/vrml",
  "vrml": "model/vrml",
  "x3db": "model/x3d+binary",
  "x3dbz": "model/x3d+binary",
  "x3dv": "model/x3d+vrml",
  "x3dvz": "model/x3d+vrml",
  "x3d": "model/x3d+xml",
  "x3dz": "model/x3d+xml",
  "appcache": "text/cache-manifest",
  "ics": "text/calendar",
  "ifb": "text/calendar",
  "css": "text/css",
  "csv": "text/csv",
  "html": "text/html",
  "htm": "text/html",
  "n3": "text/n3",
  "txt": "text/plain",
  "text": "text/plain",
  "conf": "text/plain",
  "def": "text/plain",
  "list": "text/plain",
  "log": "text/plain",
  "in": "text/plain",
  "dsc": "text/prs.lines.tag",
  "rtx": "text/richtext",
  "sgml": "text/sgml",
  "sgm": "text/sgml",
  "tsv": "text/tab-separated-values",
  "t": "text/troff",
  "tr": "text/troff",
  "roff": "text/troff",
  "man": "text/troff",
  "me": "text/troff",
  "ms": "text/troff",
  "ttl": "text/turtle",
  "uri": "text/uri-list",
  "uris": "text/uri-list",
  "urls": "text/uri-list",
  "vcard": "text/vcard",
  "curl": "text/vnd.curl",
  "dcurl": "text/vnd.curl.dcurl",
  "scurl": "text/vnd.curl.scurl",
  "mcurl": "text/vnd.curl.mcurl",
  "fly": "text/vnd.fly",
  "flx": "text/vnd.fmi.flexstor",
  "gv": "text/vnd.graphviz",
  "3dml": "text/vnd.in3d.3dml",
  "spot": "text/vnd.in3d.spot",
  "jad": "text/vnd.sun.j2me.app-descriptor",
  "wml": "text/vnd.wap.wml",
  "wmls": "text/vnd.wap.wmlscript",
  "s": "text/x-asm",
  "asm": "text/x-asm",
  "c": "text/x-c",
  "cc": "text/x-c",
  "cxx": "text/x-c",
  "cpp": "text/x-c",
  "h": "text/x-c",
  "hh": "text/x-c",
  "dic": "text/x-c",
  "f": "text/x-fortran",
  "for": "text/x-fortran",
  "f77": "text/x-fortran",
  "f90": "text/x-fortran",
  "java": "text/x-java-source",
  "opml": "text/x-opml",
  "p": "text/x-pascal",
  "pas": "text/x-pascal",
  "nfo": "text/x-nfo",
  "etx": "text/x-setext",
  "sfv": "text/x-sfv",
  "uu": "text/x-uuencode",
  "vcs": "text/x-vcalendar",
  "vcf": "text/x-vcard",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  "h261": "video/h261",
  "h263": "video/h263",
  "h264": "video/h264",
  "jpgv": "video/jpeg",
  "jpm": "video/jpm",
  "jpgm": "video/jpm",
  "mj2": "video/mj2",
  "mjp2": "video/mj2",
  "mp4": "video/mp4",
  "mp4v": "video/mp4",
  "mpg4": "video/mp4",
  "mpeg": "video/mpeg",
  "mpg": "video/mpeg",
  "mpe": "video/mpeg",
  "m1v": "video/mpeg",
  "m2v": "video/mpeg",
  "ogv": "video/ogg",
  "qt": "video/quicktime",
  "mov": "video/quicktime",
  "uvh": "video/vnd.dece.hd",
  "uvvh": "video/vnd.dece.hd",
  "uvm": "video/vnd.dece.mobile",
  "uvvm": "video/vnd.dece.mobile",
  "uvp": "video/vnd.dece.pd",
  "uvvp": "video/vnd.dece.pd",
  "uvs": "video/vnd.dece.sd",
  "uvvs": "video/vnd.dece.sd",
  "uvv": "video/vnd.dece.video",
  "uvvv": "video/vnd.dece.video",
  "dvb": "video/vnd.dvb.file",
  "fvt": "video/vnd.fvt",
  "mxu": "video/vnd.mpegurl",
  "m4u": "video/vnd.mpegurl",
  "pyv": "video/vnd.ms-playready.media.pyv",
  "uvu": "video/vnd.uvvu.mp4",
  "uvvu": "video/vnd.uvvu.mp4",
  "viv": "video/vnd.vivo",
  "webm": "video/webm",
  "f4v": "video/x-f4v",
  "fli": "video/x-fli",
  "flv": "video/x-flv",
  "m4v": "video/x-m4v",
  "mkv": "video/x-matroska",
  "mk3d": "video/x-matroska",
  "mks": "video/x-matroska",
  "mng": "video/x-mng",
  "asf": "video/x-ms-asf",
  "asx": "video/x-ms-asf",
  "vob": "video/x-ms-vob",
  "wm": "video/x-ms-wm",
  "wmv": "video/x-ms-wmv",
  "wmx": "video/x-ms-wmx",
  "wvx": "video/x-ms-wvx",
  "avi": "video/x-msvideo",
  "movie": "video/x-sgi-movie",
  "smv": "video/x-smv",
  "ice": "x-conference/x-cooltalk",
  "vtt": "text/vtt",
  "crx": "application/x-chrome-extension",
  "htc": "text/x-component",
  "manifest": "text/cache-manifest",
  "buffer": "application/octet-stream",
  "m4p": "application/mp4",
  "m4a": "audio/mp4",
  "ts": "video/MP2T",
  "event-stream": "text/event-stream",
  "webapp": "application/x-web-app-manifest+json",
  "lua": "text/x-lua",
  "luac": "application/x-lua-bytecode",
  "markdown": "text/x-markdown",
  "md": "text/x-markdown",
  "mkd": "text/x-markdown"
}
  , extensions: {
  "application/andrew-inset": "ez",
  "application/applixware": "aw",
  "application/atom+xml": "atom",
  "application/atomcat+xml": "atomcat",
  "application/atomsvc+xml": "atomsvc",
  "application/ccxml+xml": "ccxml",
  "application/cdmi-capability": "cdmia",
  "application/cdmi-container": "cdmic",
  "application/cdmi-domain": "cdmid",
  "application/cdmi-object": "cdmio",
  "application/cdmi-queue": "cdmiq",
  "application/cu-seeme": "cu",
  "application/davmount+xml": "davmount",
  "application/docbook+xml": "dbk",
  "application/dssc+der": "dssc",
  "application/dssc+xml": "xdssc",
  "application/ecmascript": "ecma",
  "application/emma+xml": "emma",
  "application/epub+zip": "epub",
  "application/exi": "exi",
  "application/font-tdpfr": "pfr",
  "application/gml+xml": "gml",
  "application/gpx+xml": "gpx",
  "application/gxf": "gxf",
  "application/hyperstudio": "stk",
  "application/inkml+xml": "ink",
  "application/ipfix": "ipfix",
  "application/java-archive": "jar",
  "application/java-serialized-object": "ser",
  "application/java-vm": "class",
  "application/javascript": "js",
  "application/json": "json",
  "application/jsonml+json": "jsonml",
  "application/lost+xml": "lostxml",
  "application/mac-binhex40": "hqx",
  "application/mac-compactpro": "cpt",
  "application/mads+xml": "mads",
  "application/marc": "mrc",
  "application/marcxml+xml": "mrcx",
  "application/mathematica": "ma",
  "application/mathml+xml": "mathml",
  "application/mbox": "mbox",
  "application/mediaservercontrol+xml": "mscml",
  "application/metalink+xml": "metalink",
  "application/metalink4+xml": "meta4",
  "application/mets+xml": "mets",
  "application/mods+xml": "mods",
  "application/mp21": "m21",
  "application/mp4": "mp4s",
  "application/msword": "doc",
  "application/mxf": "mxf",
  "application/octet-stream": "bin",
  "application/oda": "oda",
  "application/oebps-package+xml": "opf",
  "application/ogg": "ogx",
  "application/omdoc+xml": "omdoc",
  "application/onenote": "onetoc",
  "application/oxps": "oxps",
  "application/patch-ops-error+xml": "xer",
  "application/pdf": "pdf",
  "application/pgp-encrypted": "pgp",
  "application/pgp-signature": "asc",
  "application/pics-rules": "prf",
  "application/pkcs10": "p10",
  "application/pkcs7-mime": "p7m",
  "application/pkcs7-signature": "p7s",
  "application/pkcs8": "p8",
  "application/pkix-attr-cert": "ac",
  "application/pkix-cert": "cer",
  "application/pkix-crl": "crl",
  "application/pkix-pkipath": "pkipath",
  "application/pkixcmp": "pki",
  "application/pls+xml": "pls",
  "application/postscript": "ai",
  "application/prs.cww": "cww",
  "application/pskc+xml": "pskcxml",
  "application/rdf+xml": "rdf",
  "application/reginfo+xml": "rif",
  "application/relax-ng-compact-syntax": "rnc",
  "application/resource-lists+xml": "rl",
  "application/resource-lists-diff+xml": "rld",
  "application/rls-services+xml": "rs",
  "application/rpki-ghostbusters": "gbr",
  "application/rpki-manifest": "mft",
  "application/rpki-roa": "roa",
  "application/rsd+xml": "rsd",
  "application/rss+xml": "rss",
  "application/rtf": "rtf",
  "application/sbml+xml": "sbml",
  "application/scvp-cv-request": "scq",
  "application/scvp-cv-response": "scs",
  "application/scvp-vp-request": "spq",
  "application/scvp-vp-response": "spp",
  "application/sdp": "sdp",
  "application/set-payment-initiation": "setpay",
  "application/set-registration-initiation": "setreg",
  "application/shf+xml": "shf",
  "application/smil+xml": "smi",
  "application/sparql-query": "rq",
  "application/sparql-results+xml": "srx",
  "application/srgs": "gram",
  "application/srgs+xml": "grxml",
  "application/sru+xml": "sru",
  "application/ssdl+xml": "ssdl",
  "application/ssml+xml": "ssml",
  "application/tei+xml": "tei",
  "application/thraud+xml": "tfi",
  "application/timestamped-data": "tsd",
  "application/vnd.3gpp.pic-bw-large": "plb",
  "application/vnd.3gpp.pic-bw-small": "psb",
  "application/vnd.3gpp.pic-bw-var": "pvb",
  "application/vnd.3gpp2.tcap": "tcap",
  "application/vnd.3m.post-it-notes": "pwn",
  "application/vnd.accpac.simply.aso": "aso",
  "application/vnd.accpac.simply.imp": "imp",
  "application/vnd.acucobol": "acu",
  "application/vnd.acucorp": "atc",
  "application/vnd.adobe.air-application-installer-package+zip": "air",
  "application/vnd.adobe.formscentral.fcdt": "fcdt",
  "application/vnd.adobe.fxp": "fxp",
  "application/vnd.adobe.xdp+xml": "xdp",
  "application/vnd.adobe.xfdf": "xfdf",
  "application/vnd.ahead.space": "ahead",
  "application/vnd.airzip.filesecure.azf": "azf",
  "application/vnd.airzip.filesecure.azs": "azs",
  "application/vnd.amazon.ebook": "azw",
  "application/vnd.americandynamics.acc": "acc",
  "application/vnd.amiga.ami": "ami",
  "application/vnd.android.package-archive": "apk",
  "application/vnd.anser-web-certificate-issue-initiation": "cii",
  "application/vnd.anser-web-funds-transfer-initiation": "fti",
  "application/vnd.antix.game-component": "atx",
  "application/vnd.apple.installer+xml": "mpkg",
  "application/vnd.apple.mpegurl": "m3u8",
  "application/vnd.aristanetworks.swi": "swi",
  "application/vnd.astraea-software.iota": "iota",
  "application/vnd.audiograph": "aep",
  "application/vnd.blueice.multipass": "mpm",
  "application/vnd.bmi": "bmi",
  "application/vnd.businessobjects": "rep",
  "application/vnd.chemdraw+xml": "cdxml",
  "application/vnd.chipnuts.karaoke-mmd": "mmd",
  "application/vnd.cinderella": "cdy",
  "application/vnd.claymore": "cla",
  "application/vnd.cloanto.rp9": "rp9",
  "application/vnd.clonk.c4group": "c4g",
  "application/vnd.cluetrust.cartomobile-config": "c11amc",
  "application/vnd.cluetrust.cartomobile-config-pkg": "c11amz",
  "application/vnd.commonspace": "csp",
  "application/vnd.contact.cmsg": "cdbcmsg",
  "application/vnd.cosmocaller": "cmc",
  "application/vnd.crick.clicker": "clkx",
  "application/vnd.crick.clicker.keyboard": "clkk",
  "application/vnd.crick.clicker.palette": "clkp",
  "application/vnd.crick.clicker.template": "clkt",
  "application/vnd.crick.clicker.wordbank": "clkw",
  "application/vnd.criticaltools.wbs+xml": "wbs",
  "application/vnd.ctc-posml": "pml",
  "application/vnd.cups-ppd": "ppd",
  "application/vnd.curl.car": "car",
  "application/vnd.curl.pcurl": "pcurl",
  "application/vnd.dart": "dart",
  "application/vnd.data-vision.rdz": "rdz",
  "application/vnd.dece.data": "uvf",
  "application/vnd.dece.ttml+xml": "uvt",
  "application/vnd.dece.unspecified": "uvx",
  "application/vnd.dece.zip": "uvz",
  "application/vnd.denovo.fcselayout-link": "fe_launch",
  "application/vnd.dna": "dna",
  "application/vnd.dolby.mlp": "mlp",
  "application/vnd.dpgraph": "dpg",
  "application/vnd.dreamfactory": "dfac",
  "application/vnd.ds-keypoint": "kpxx",
  "application/vnd.dvb.ait": "ait",
  "application/vnd.dvb.service": "svc",
  "application/vnd.dynageo": "geo",
  "application/vnd.ecowin.chart": "mag",
  "application/vnd.enliven": "nml",
  "application/vnd.epson.esf": "esf",
  "application/vnd.epson.msf": "msf",
  "application/vnd.epson.quickanime": "qam",
  "application/vnd.epson.salt": "slt",
  "application/vnd.epson.ssf": "ssf",
  "application/vnd.eszigno3+xml": "es3",
  "application/vnd.ezpix-album": "ez2",
  "application/vnd.ezpix-package": "ez3",
  "application/vnd.fdf": "fdf",
  "application/vnd.fdsn.mseed": "mseed",
  "application/vnd.fdsn.seed": "seed",
  "application/vnd.flographit": "gph",
  "application/vnd.fluxtime.clip": "ftc",
  "application/vnd.framemaker": "fm",
  "application/vnd.frogans.fnc": "fnc",
  "application/vnd.frogans.ltf": "ltf",
  "application/vnd.fsc.weblaunch": "fsc",
  "application/vnd.fujitsu.oasys": "oas",
  "application/vnd.fujitsu.oasys2": "oa2",
  "application/vnd.fujitsu.oasys3": "oa3",
  "application/vnd.fujitsu.oasysgp": "fg5",
  "application/vnd.fujitsu.oasysprs": "bh2",
  "application/vnd.fujixerox.ddd": "ddd",
  "application/vnd.fujixerox.docuworks": "xdw",
  "application/vnd.fujixerox.docuworks.binder": "xbd",
  "application/vnd.fuzzysheet": "fzs",
  "application/vnd.genomatix.tuxedo": "txd",
  "application/vnd.geogebra.file": "ggb",
  "application/vnd.geogebra.tool": "ggt",
  "application/vnd.geometry-explorer": "gex",
  "application/vnd.geonext": "gxt",
  "application/vnd.geoplan": "g2w",
  "application/vnd.geospace": "g3w",
  "application/vnd.gmx": "gmx",
  "application/vnd.google-earth.kml+xml": "kml",
  "application/vnd.google-earth.kmz": "kmz",
  "application/vnd.grafeq": "gqf",
  "application/vnd.groove-account": "gac",
  "application/vnd.groove-help": "ghf",
  "application/vnd.groove-identity-message": "gim",
  "application/vnd.groove-injector": "grv",
  "application/vnd.groove-tool-message": "gtm",
  "application/vnd.groove-tool-template": "tpl",
  "application/vnd.groove-vcard": "vcg",
  "application/vnd.hal+xml": "hal",
  "application/vnd.handheld-entertainment+xml": "zmm",
  "application/vnd.hbci": "hbci",
  "application/vnd.hhe.lesson-player": "les",
  "application/vnd.hp-hpgl": "hpgl",
  "application/vnd.hp-hpid": "hpid",
  "application/vnd.hp-hps": "hps",
  "application/vnd.hp-jlyt": "jlt",
  "application/vnd.hp-pcl": "pcl",
  "application/vnd.hp-pclxl": "pclxl",
  "application/vnd.hydrostatix.sof-data": "sfd-hdstx",
  "application/vnd.ibm.minipay": "mpy",
  "application/vnd.ibm.modcap": "afp",
  "application/vnd.ibm.rights-management": "irm",
  "application/vnd.ibm.secure-container": "sc",
  "application/vnd.iccprofile": "icc",
  "application/vnd.igloader": "igl",
  "application/vnd.immervision-ivp": "ivp",
  "application/vnd.immervision-ivu": "ivu",
  "application/vnd.insors.igm": "igm",
  "application/vnd.intercon.formnet": "xpw",
  "application/vnd.intergeo": "i2g",
  "application/vnd.intu.qbo": "qbo",
  "application/vnd.intu.qfx": "qfx",
  "application/vnd.ipunplugged.rcprofile": "rcprofile",
  "application/vnd.irepository.package+xml": "irp",
  "application/vnd.is-xpr": "xpr",
  "application/vnd.isac.fcs": "fcs",
  "application/vnd.jam": "jam",
  "application/vnd.jcp.javame.midlet-rms": "rms",
  "application/vnd.jisp": "jisp",
  "application/vnd.joost.joda-archive": "joda",
  "application/vnd.kahootz": "ktz",
  "application/vnd.kde.karbon": "karbon",
  "application/vnd.kde.kchart": "chrt",
  "application/vnd.kde.kformula": "kfo",
  "application/vnd.kde.kivio": "flw",
  "application/vnd.kde.kontour": "kon",
  "application/vnd.kde.kpresenter": "kpr",
  "application/vnd.kde.kspread": "ksp",
  "application/vnd.kde.kword": "kwd",
  "application/vnd.kenameaapp": "htke",
  "application/vnd.kidspiration": "kia",
  "application/vnd.kinar": "kne",
  "application/vnd.koan": "skp",
  "application/vnd.kodak-descriptor": "sse",
  "application/vnd.las.las+xml": "lasxml",
  "application/vnd.llamagraphics.life-balance.desktop": "lbd",
  "application/vnd.llamagraphics.life-balance.exchange+xml": "lbe",
  "application/vnd.lotus-1-2-3": "123",
  "application/vnd.lotus-approach": "apr",
  "application/vnd.lotus-freelance": "pre",
  "application/vnd.lotus-notes": "nsf",
  "application/vnd.lotus-organizer": "org",
  "application/vnd.lotus-screencam": "scm",
  "application/vnd.lotus-wordpro": "lwp",
  "application/vnd.macports.portpkg": "portpkg",
  "application/vnd.mcd": "mcd",
  "application/vnd.medcalcdata": "mc1",
  "application/vnd.mediastation.cdkey": "cdkey",
  "application/vnd.mfer": "mwf",
  "application/vnd.mfmp": "mfm",
  "application/vnd.micrografx.flo": "flo",
  "application/vnd.micrografx.igx": "igx",
  "application/vnd.mif": "mif",
  "application/vnd.mobius.daf": "daf",
  "application/vnd.mobius.dis": "dis",
  "application/vnd.mobius.mbk": "mbk",
  "application/vnd.mobius.mqy": "mqy",
  "application/vnd.mobius.msl": "msl",
  "application/vnd.mobius.plc": "plc",
  "application/vnd.mobius.txf": "txf",
  "application/vnd.mophun.application": "mpn",
  "application/vnd.mophun.certificate": "mpc",
  "application/vnd.mozilla.xul+xml": "xul",
  "application/vnd.ms-artgalry": "cil",
  "application/vnd.ms-cab-compressed": "cab",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-excel.addin.macroenabled.12": "xlam",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12": "xlsb",
  "application/vnd.ms-excel.sheet.macroenabled.12": "xlsm",
  "application/vnd.ms-excel.template.macroenabled.12": "xltm",
  "application/vnd.ms-fontobject": "eot",
  "application/vnd.ms-htmlhelp": "chm",
  "application/vnd.ms-ims": "ims",
  "application/vnd.ms-lrm": "lrm",
  "application/vnd.ms-officetheme": "thmx",
  "application/vnd.ms-pki.seccat": "cat",
  "application/vnd.ms-pki.stl": "stl",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.ms-powerpoint.addin.macroenabled.12": "ppam",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12": "pptm",
  "application/vnd.ms-powerpoint.slide.macroenabled.12": "sldm",
  "application/vnd.ms-powerpoint.slideshow.macroenabled.12": "ppsm",
  "application/vnd.ms-powerpoint.template.macroenabled.12": "potm",
  "application/vnd.ms-project": "mpp",
  "application/vnd.ms-word.document.macroenabled.12": "docm",
  "application/vnd.ms-word.template.macroenabled.12": "dotm",
  "application/vnd.ms-works": "wps",
  "application/vnd.ms-wpl": "wpl",
  "application/vnd.ms-xpsdocument": "xps",
  "application/vnd.mseq": "mseq",
  "application/vnd.musician": "mus",
  "application/vnd.muvee.style": "msty",
  "application/vnd.mynfc": "taglet",
  "application/vnd.neurolanguage.nlu": "nlu",
  "application/vnd.nitf": "ntf",
  "application/vnd.noblenet-directory": "nnd",
  "application/vnd.noblenet-sealer": "nns",
  "application/vnd.noblenet-web": "nnw",
  "application/vnd.nokia.n-gage.data": "ngdat",
  "application/vnd.nokia.n-gage.symbian.install": "n-gage",
  "application/vnd.nokia.radio-preset": "rpst",
  "application/vnd.nokia.radio-presets": "rpss",
  "application/vnd.novadigm.edm": "edm",
  "application/vnd.novadigm.edx": "edx",
  "application/vnd.novadigm.ext": "ext",
  "application/vnd.oasis.opendocument.chart": "odc",
  "application/vnd.oasis.opendocument.chart-template": "otc",
  "application/vnd.oasis.opendocument.database": "odb",
  "application/vnd.oasis.opendocument.formula": "odf",
  "application/vnd.oasis.opendocument.formula-template": "odft",
  "application/vnd.oasis.opendocument.graphics": "odg",
  "application/vnd.oasis.opendocument.graphics-template": "otg",
  "application/vnd.oasis.opendocument.image": "odi",
  "application/vnd.oasis.opendocument.image-template": "oti",
  "application/vnd.oasis.opendocument.presentation": "odp",
  "application/vnd.oasis.opendocument.presentation-template": "otp",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.oasis.opendocument.spreadsheet-template": "ots",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.text-master": "odm",
  "application/vnd.oasis.opendocument.text-template": "ott",
  "application/vnd.oasis.opendocument.text-web": "oth",
  "application/vnd.olpc-sugar": "xo",
  "application/vnd.oma.dd2+xml": "dd2",
  "application/vnd.openofficeorg.extension": "oxt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.presentationml.slide": "sldx",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow": "ppsx",
  "application/vnd.openxmlformats-officedocument.presentationml.template": "potx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template": "xltx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template": "dotx",
  "application/vnd.osgeo.mapguide.package": "mgp",
  "application/vnd.osgi.dp": "dp",
  "application/vnd.osgi.subsystem": "esa",
  "application/vnd.palm": "pdb",
  "application/vnd.pawaafile": "paw",
  "application/vnd.pg.format": "str",
  "application/vnd.pg.osasli": "ei6",
  "application/vnd.picsel": "efif",
  "application/vnd.pmi.widget": "wg",
  "application/vnd.pocketlearn": "plf",
  "application/vnd.powerbuilder6": "pbd",
  "application/vnd.previewsystems.box": "box",
  "application/vnd.proteus.magazine": "mgz",
  "application/vnd.publishare-delta-tree": "qps",
  "application/vnd.pvi.ptid1": "ptid",
  "application/vnd.quark.quarkxpress": "qxd",
  "application/vnd.realvnc.bed": "bed",
  "application/vnd.recordare.musicxml": "mxl",
  "application/vnd.recordare.musicxml+xml": "musicxml",
  "application/vnd.rig.cryptonote": "cryptonote",
  "application/vnd.rim.cod": "cod",
  "application/vnd.rn-realmedia": "rm",
  "application/vnd.rn-realmedia-vbr": "rmvb",
  "application/vnd.route66.link66+xml": "link66",
  "application/vnd.sailingtracker.track": "st",
  "application/vnd.seemail": "see",
  "application/vnd.sema": "sema",
  "application/vnd.semd": "semd",
  "application/vnd.semf": "semf",
  "application/vnd.shana.informed.formdata": "ifm",
  "application/vnd.shana.informed.formtemplate": "itp",
  "application/vnd.shana.informed.interchange": "iif",
  "application/vnd.shana.informed.package": "ipk",
  "application/vnd.simtech-mindmapper": "twd",
  "application/vnd.smaf": "mmf",
  "application/vnd.smart.teacher": "teacher",
  "application/vnd.solent.sdkm+xml": "sdkm",
  "application/vnd.spotfire.dxp": "dxp",
  "application/vnd.spotfire.sfs": "sfs",
  "application/vnd.stardivision.calc": "sdc",
  "application/vnd.stardivision.draw": "sda",
  "application/vnd.stardivision.impress": "sdd",
  "application/vnd.stardivision.math": "smf",
  "application/vnd.stardivision.writer": "sdw",
  "application/vnd.stardivision.writer-global": "sgl",
  "application/vnd.stepmania.package": "smzip",
  "application/vnd.stepmania.stepchart": "sm",
  "application/vnd.sun.xml.calc": "sxc",
  "application/vnd.sun.xml.calc.template": "stc",
  "application/vnd.sun.xml.draw": "sxd",
  "application/vnd.sun.xml.draw.template": "std",
  "application/vnd.sun.xml.impress": "sxi",
  "application/vnd.sun.xml.impress.template": "sti",
  "application/vnd.sun.xml.math": "sxm",
  "application/vnd.sun.xml.writer": "sxw",
  "application/vnd.sun.xml.writer.global": "sxg",
  "application/vnd.sun.xml.writer.template": "stw",
  "application/vnd.sus-calendar": "sus",
  "application/vnd.svd": "svd",
  "application/vnd.symbian.install": "sis",
  "application/vnd.syncml+xml": "xsm",
  "application/vnd.syncml.dm+wbxml": "bdm",
  "application/vnd.syncml.dm+xml": "xdm",
  "application/vnd.tao.intent-module-archive": "tao",
  "application/vnd.tcpdump.pcap": "pcap",
  "application/vnd.tmobile-livetv": "tmo",
  "application/vnd.trid.tpt": "tpt",
  "application/vnd.triscape.mxs": "mxs",
  "application/vnd.trueapp": "tra",
  "application/vnd.ufdl": "ufd",
  "application/vnd.uiq.theme": "utz",
  "application/vnd.umajin": "umj",
  "application/vnd.unity": "unityweb",
  "application/vnd.uoml+xml": "uoml",
  "application/vnd.vcx": "vcx",
  "application/vnd.visio": "vsd",
  "application/vnd.visionary": "vis",
  "application/vnd.vsf": "vsf",
  "application/vnd.wap.wbxml": "wbxml",
  "application/vnd.wap.wmlc": "wmlc",
  "application/vnd.wap.wmlscriptc": "wmlsc",
  "application/vnd.webturbo": "wtb",
  "application/vnd.wolfram.player": "nbp",
  "application/vnd.wordperfect": "wpd",
  "application/vnd.wqd": "wqd",
  "application/vnd.wt.stf": "stf",
  "application/vnd.xara": "xar",
  "application/vnd.xfdl": "xfdl",
  "application/vnd.yamaha.hv-dic": "hvd",
  "application/vnd.yamaha.hv-script": "hvs",
  "application/vnd.yamaha.hv-voice": "hvp",
  "application/vnd.yamaha.openscoreformat": "osf",
  "application/vnd.yamaha.openscoreformat.osfpvg+xml": "osfpvg",
  "application/vnd.yamaha.smaf-audio": "saf",
  "application/vnd.yamaha.smaf-phrase": "spf",
  "application/vnd.yellowriver-custom-menu": "cmp",
  "application/vnd.zul": "zir",
  "application/vnd.zzazz.deck+xml": "zaz",
  "application/voicexml+xml": "vxml",
  "application/widget": "wgt",
  "application/winhlp": "hlp",
  "application/wsdl+xml": "wsdl",
  "application/wspolicy+xml": "wspolicy",
  "application/x-7z-compressed": "7z",
  "application/x-abiword": "abw",
  "application/x-ace-compressed": "ace",
  "application/x-apple-diskimage": "dmg",
  "application/x-authorware-bin": "aab",
  "application/x-authorware-map": "aam",
  "application/x-authorware-seg": "aas",
  "application/x-bcpio": "bcpio",
  "application/x-bittorrent": "torrent",
  "application/x-blorb": "blb",
  "application/x-bzip": "bz",
  "application/x-bzip2": "bz2",
  "application/x-cbr": "cbr",
  "application/x-cdlink": "vcd",
  "application/x-cfs-compressed": "cfs",
  "application/x-chat": "chat",
  "application/x-chess-pgn": "pgn",
  "application/x-conference": "nsc",
  "application/x-cpio": "cpio",
  "application/x-csh": "csh",
  "application/x-debian-package": "deb",
  "application/x-dgc-compressed": "dgc",
  "application/x-director": "dir",
  "application/x-doom": "wad",
  "application/x-dtbncx+xml": "ncx",
  "application/x-dtbook+xml": "dtb",
  "application/x-dtbresource+xml": "res",
  "application/x-dvi": "dvi",
  "application/x-envoy": "evy",
  "application/x-eva": "eva",
  "application/x-font-bdf": "bdf",
  "application/x-font-ghostscript": "gsf",
  "application/x-font-linux-psf": "psf",
  "application/x-font-otf": "otf",
  "application/x-font-pcf": "pcf",
  "application/x-font-snf": "snf",
  "application/x-font-ttf": "ttf",
  "application/x-font-type1": "pfa",
  "application/x-font-woff": "woff",
  "application/x-freearc": "arc",
  "application/x-futuresplash": "spl",
  "application/x-gca-compressed": "gca",
  "application/x-glulx": "ulx",
  "application/x-gnumeric": "gnumeric",
  "application/x-gramps-xml": "gramps",
  "application/x-gtar": "gtar",
  "application/x-hdf": "hdf",
  "application/x-install-instructions": "install",
  "application/x-iso9660-image": "iso",
  "application/x-java-jnlp-file": "jnlp",
  "application/x-latex": "latex",
  "application/x-lzh-compressed": "lzh",
  "application/x-mie": "mie",
  "application/x-mobipocket-ebook": "prc",
  "application/x-ms-application": "application",
  "application/x-ms-shortcut": "lnk",
  "application/x-ms-wmd": "wmd",
  "application/x-ms-wmz": "wmz",
  "application/x-ms-xbap": "xbap",
  "application/x-msaccess": "mdb",
  "application/x-msbinder": "obd",
  "application/x-mscardfile": "crd",
  "application/x-msclip": "clp",
  "application/x-msdownload": "exe",
  "application/x-msmediaview": "mvb",
  "application/x-msmetafile": "wmf",
  "application/x-msmoney": "mny",
  "application/x-mspublisher": "pub",
  "application/x-msschedule": "scd",
  "application/x-msterminal": "trm",
  "application/x-mswrite": "wri",
  "application/x-netcdf": "nc",
  "application/x-nzb": "nzb",
  "application/x-pkcs12": "p12",
  "application/x-pkcs7-certificates": "p7b",
  "application/x-pkcs7-certreqresp": "p7r",
  "application/x-rar-compressed": "rar",
  "application/x-research-info-systems": "ris",
  "application/x-sh": "sh",
  "application/x-shar": "shar",
  "application/x-shockwave-flash": "swf",
  "application/x-silverlight-app": "xap",
  "application/x-sql": "sql",
  "application/x-stuffit": "sit",
  "application/x-stuffitx": "sitx",
  "application/x-subrip": "srt",
  "application/x-sv4cpio": "sv4cpio",
  "application/x-sv4crc": "sv4crc",
  "application/x-t3vm-image": "t3",
  "application/x-tads": "gam",
  "application/x-tar": "tar",
  "application/x-tcl": "tcl",
  "application/x-tex": "tex",
  "application/x-tex-tfm": "tfm",
  "application/x-texinfo": "texinfo",
  "application/x-tgif": "obj",
  "application/x-ustar": "ustar",
  "application/x-wais-source": "src",
  "application/x-x509-ca-cert": "der",
  "application/x-xfig": "fig",
  "application/x-xliff+xml": "xlf",
  "application/x-xpinstall": "xpi",
  "application/x-xz": "xz",
  "application/x-zmachine": "z1",
  "application/xaml+xml": "xaml",
  "application/xcap-diff+xml": "xdf",
  "application/xenc+xml": "xenc",
  "application/xhtml+xml": "xhtml",
  "application/xml": "xml",
  "application/xml-dtd": "dtd",
  "application/xop+xml": "xop",
  "application/xproc+xml": "xpl",
  "application/xslt+xml": "xslt",
  "application/xspf+xml": "xspf",
  "application/xv+xml": "mxml",
  "application/yang": "yang",
  "application/yin+xml": "yin",
  "application/zip": "zip",
  "audio/adpcm": "adp",
  "audio/basic": "au",
  "audio/midi": "mid",
  "audio/mp4": "mp4a",
  "audio/mpeg": "mpga",
  "audio/ogg": "oga",
  "audio/s3m": "s3m",
  "audio/silk": "sil",
  "audio/vnd.dece.audio": "uva",
  "audio/vnd.digital-winds": "eol",
  "audio/vnd.dra": "dra",
  "audio/vnd.dts": "dts",
  "audio/vnd.dts.hd": "dtshd",
  "audio/vnd.lucent.voice": "lvp",
  "audio/vnd.ms-playready.media.pya": "pya",
  "audio/vnd.nuera.ecelp4800": "ecelp4800",
  "audio/vnd.nuera.ecelp7470": "ecelp7470",
  "audio/vnd.nuera.ecelp9600": "ecelp9600",
  "audio/vnd.rip": "rip",
  "audio/webm": "weba",
  "audio/x-aac": "aac",
  "audio/x-aiff": "aif",
  "audio/x-caf": "caf",
  "audio/x-flac": "flac",
  "audio/x-matroska": "mka",
  "audio/x-mpegurl": "m3u",
  "audio/x-ms-wax": "wax",
  "audio/x-ms-wma": "wma",
  "audio/x-pn-realaudio": "ram",
  "audio/x-pn-realaudio-plugin": "rmp",
  "audio/x-wav": "wav",
  "audio/xm": "xm",
  "chemical/x-cdx": "cdx",
  "chemical/x-cif": "cif",
  "chemical/x-cmdf": "cmdf",
  "chemical/x-cml": "cml",
  "chemical/x-csml": "csml",
  "chemical/x-xyz": "xyz",
  "image/bmp": "bmp",
  "image/cgm": "cgm",
  "image/g3fax": "g3",
  "image/gif": "gif",
  "image/ief": "ief",
  "image/jpeg": "jpeg",
  "image/ktx": "ktx",
  "image/png": "png",
  "image/prs.btif": "btif",
  "image/sgi": "sgi",
  "image/svg+xml": "svg",
  "image/tiff": "tiff",
  "image/vnd.adobe.photoshop": "psd",
  "image/vnd.dece.graphic": "uvi",
  "image/vnd.dvb.subtitle": "sub",
  "image/vnd.djvu": "djvu",
  "image/vnd.dwg": "dwg",
  "image/vnd.dxf": "dxf",
  "image/vnd.fastbidsheet": "fbs",
  "image/vnd.fpx": "fpx",
  "image/vnd.fst": "fst",
  "image/vnd.fujixerox.edmics-mmr": "mmr",
  "image/vnd.fujixerox.edmics-rlc": "rlc",
  "image/vnd.ms-modi": "mdi",
  "image/vnd.ms-photo": "wdp",
  "image/vnd.net-fpx": "npx",
  "image/vnd.wap.wbmp": "wbmp",
  "image/vnd.xiff": "xif",
  "image/webp": "webp",
  "image/x-3ds": "3ds",
  "image/x-cmu-raster": "ras",
  "image/x-cmx": "cmx",
  "image/x-freehand": "fh",
  "image/x-icon": "ico",
  "image/x-mrsid-image": "sid",
  "image/x-pcx": "pcx",
  "image/x-pict": "pic",
  "image/x-portable-anymap": "pnm",
  "image/x-portable-bitmap": "pbm",
  "image/x-portable-graymap": "pgm",
  "image/x-portable-pixmap": "ppm",
  "image/x-rgb": "rgb",
  "image/x-tga": "tga",
  "image/x-xbitmap": "xbm",
  "image/x-xpixmap": "xpm",
  "image/x-xwindowdump": "xwd",
  "message/rfc822": "eml",
  "model/iges": "igs",
  "model/mesh": "msh",
  "model/vnd.collada+xml": "dae",
  "model/vnd.dwf": "dwf",
  "model/vnd.gdl": "gdl",
  "model/vnd.gtw": "gtw",
  "model/vnd.mts": "mts",
  "model/vnd.vtu": "vtu",
  "model/vrml": "wrl",
  "model/x3d+binary": "x3db",
  "model/x3d+vrml": "x3dv",
  "model/x3d+xml": "x3d",
  "text/cache-manifest": "appcache",
  "text/calendar": "ics",
  "text/css": "css",
  "text/csv": "csv",
  "text/html": "html",
  "text/n3": "n3",
  "text/plain": "txt",
  "text/prs.lines.tag": "dsc",
  "text/richtext": "rtx",
  "text/sgml": "sgml",
  "text/tab-separated-values": "tsv",
  "text/troff": "t",
  "text/turtle": "ttl",
  "text/uri-list": "uri",
  "text/vcard": "vcard",
  "text/vnd.curl": "curl",
  "text/vnd.curl.dcurl": "dcurl",
  "text/vnd.curl.scurl": "scurl",
  "text/vnd.curl.mcurl": "mcurl",
  "text/vnd.dvb.subtitle": "sub",
  "text/vnd.fly": "fly",
  "text/vnd.fmi.flexstor": "flx",
  "text/vnd.graphviz": "gv",
  "text/vnd.in3d.3dml": "3dml",
  "text/vnd.in3d.spot": "spot",
  "text/vnd.sun.j2me.app-descriptor": "jad",
  "text/vnd.wap.wml": "wml",
  "text/vnd.wap.wmlscript": "wmls",
  "text/x-asm": "s",
  "text/x-c": "c",
  "text/x-fortran": "f",
  "text/x-java-source": "java",
  "text/x-opml": "opml",
  "text/x-pascal": "p",
  "text/x-nfo": "nfo",
  "text/x-setext": "etx",
  "text/x-sfv": "sfv",
  "text/x-uuencode": "uu",
  "text/x-vcalendar": "vcs",
  "text/x-vcard": "vcf",
  "video/3gpp": "3gp",
  "video/3gpp2": "3g2",
  "video/h261": "h261",
  "video/h263": "h263",
  "video/h264": "h264",
  "video/jpeg": "jpgv",
  "video/jpm": "jpm",
  "video/mj2": "mj2",
  "video/mp4": "mp4",
  "video/mpeg": "mpeg",
  "video/ogg": "ogv",
  "video/quicktime": "qt",
  "video/vnd.dece.hd": "uvh",
  "video/vnd.dece.mobile": "uvm",
  "video/vnd.dece.pd": "uvp",
  "video/vnd.dece.sd": "uvs",
  "video/vnd.dece.video": "uvv",
  "video/vnd.dvb.file": "dvb",
  "video/vnd.fvt": "fvt",
  "video/vnd.mpegurl": "mxu",
  "video/vnd.ms-playready.media.pyv": "pyv",
  "video/vnd.uvvu.mp4": "uvu",
  "video/vnd.vivo": "viv",
  "video/webm": "webm",
  "video/x-f4v": "f4v",
  "video/x-fli": "fli",
  "video/x-flv": "flv",
  "video/x-m4v": "m4v",
  "video/x-matroska": "mkv",
  "video/x-mng": "mng",
  "video/x-ms-asf": "asf",
  "video/x-ms-vob": "vob",
  "video/x-ms-wm": "wm",
  "video/x-ms-wmv": "wmv",
  "video/x-ms-wmx": "wmx",
  "video/x-ms-wvx": "wvx",
  "video/x-msvideo": "avi",
  "video/x-sgi-movie": "movie",
  "video/x-smv": "smv",
  "x-conference/x-cooltalk": "ice",
  "text/vtt": "vtt",
  "application/x-chrome-extension": "crx",
  "text/x-component": "htc",
  "video/MP2T": "ts",
  "text/event-stream": "event-stream",
  "application/x-web-app-manifest+json": "webapp",
  "text/x-lua": "lua",
  "application/x-lua-bytecode": "luac",
  "text/x-markdown": "markdown"
}
  , extension: function (mimeType) {
  var type = mimeType.match(/^\s*([^;\s]*)(?:;|\s|$)/)[1].toLowerCase();
  return this.extensions[type];
}
  , define: function (map) {
  for (var type in map) {
    var exts = map[type];

    for (var i = 0; i < exts.length; i++) {
      if (false && this.types[exts]) {
        console.warn(this._loading.replace(/.*\//, ''), 'changes "' + exts[i] + '" extension type from ' +
          this.types[exts] + ' to ' + type);
      }

      this.types[exts[i]] = type;
    }

    // Default extension is the first one we encounter
    if (!this.extensions[type]) {
      this.extensions[type] = exts[0];
    }
  }
}
  , charsets: {lookup: function (mimeType, fallback) {
    // Assume text types are utf8
    return (/^text\//).test(mimeType) ? 'UTF-8' : fallback;
  }}
}
mime.types.constructor = undefined
mime.extensions.constructor = undefined
},{}],42:[function(require,module,exports){
(function (Buffer){
//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

// Module dependencies.
var qs = require('querystring');
var url = require('url');
var util = require('util');
var _ = require('underscore');
var extend = require('extend');

var azureCommon = require('./../../common/common.core');
var BlockRangeStream = require('./internal/blockrangestream');
var Md5Wrapper = require('./../../common/md5-wrapper');
var PageRangeStream = require('./internal/pagerangestream');
var RangeStream = require('./../../common/streams/rangestream');
var azureutil = azureCommon.util;
var SR = azureCommon.SR;
var validate = azureCommon.validate;
var StorageServiceClient = azureCommon.StorageServiceClient;
var WebResource = azureCommon.WebResource;

// Constants
var Constants = azureCommon.Constants;
var BlobConstants = Constants.BlobConstants;
var HeaderConstants = Constants.HeaderConstants;
var QueryStringConstants = Constants.QueryStringConstants;
var RequestLocationMode = Constants.RequestLocationMode;

// Streams
var BatchOperation = azureCommon.BatchOperation;
var SpeedSummary = azureCommon.SpeedSummary;
var ChunkAllocator = azureCommon.ChunkAllocator;
var ChunkStream = azureCommon.ChunkStream;
var ChunkStreamWithStream = azureCommon.ChunkStreamWithStream;

// Models requires
var AclResult = azureCommon.AclResult;
var ServiceStatsParser = azureCommon.ServiceStatsParser;
var BlockListResult = require('./models/blocklistresult');
var BlobResult = require('./models/blobresult');
var ContainerResult = require('./models/containerresult');
var LeaseResult = require('./models/leaseresult');

var BlobUtilities = require('./blobutilities');

// Errors requires
var errors = require('../../common/errors/errors');
var ArgumentError = errors.ArgumentError;
var ArgumentNullError = errors.ArgumentNullError;
var StorageError = errors.StorageError;

/**
* Creates a new BlobService object.
* If no connection string or storageaccount and storageaccesskey are provided,
* the AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY environment variables will be used.
* @class
* The BlobService class is used to perform operations on the Microsoft Azure Blob Service.
* The Blob Service provides storage for binary large objects, and provides
* functions for working with data stored in blobs as either streams or pages of data.
*
* For more information on the Blob Service, as well as task focused information on using it in a Node.js application, see
* [How to Use the Blob Service from Node.js](http://azure.microsoft.com/en-us/documentation/articles/storage-nodejs-how-to-use-blob-storage/).
* The following defaults can be set on the blob service.
* singleBlobPutThresholdInBytes                       The default maximum size, in bytes, of a blob before it must be separated into blocks.
* defaultEnableReuseSocket                            The default boolean value to enable socket reuse when uploading local files or streams.
*                                                     If the Node.js version is lower than 0.10.x, socket reuse will always be turned off.
* defaultTimeoutIntervalInMs                          The default timeout interval, in milliseconds, to use for request made via the Blob service.
* defaultClientRequestTimeoutInMs                     The default timeout of client requests, in milliseconds, to use for the request made via the Blob service.
* defaultMaximumExecutionTimeInMs                     The default maximum execution time across all potential retries, for requests made via the Blob service.
* defaultLocationMode                                 The default location mode for requests made via the Blob service.
* parallelOperationThreadCount                        The number of parallel operations that may be performed when uploading a blob that is greater than
*                                                     the value specified by the singleBlobPutThresholdInBytes property in size.
* useNagleAlgorithm                                   Determines whether the Nagle algorithm is used for requests made via the Blob service; true to use the
*                                                     Nagle algorithm; otherwise, false. The default value is false.
* @constructor
* @extends {StorageServiceClient}
*
* @param {string} [storageAccountOrConnectionString]  The storage account or the connection string.
* @param {string} [storageAccessKey]                  The storage access key.
* @param {string|object} [host]                       The host address. To define primary only, pass a string.
*                                                     Otherwise 'host.primaryHost' defines the primary host and 'host.secondaryHost' defines the secondary host.
* @param {string} [sasToken]                          The Shared Access Signature token.
* @param {string} [endpointSuffix]                    The endpoint suffix.
*/
function BlobService(storageAccountOrConnectionString, storageAccessKey, host, sasToken, endpointSuffix) {
  var storageServiceSettings = StorageServiceClient.getStorageSettings(storageAccountOrConnectionString, storageAccessKey, host, sasToken, endpointSuffix);

  BlobService['super_'].call(this,
    storageServiceSettings._name,
    storageServiceSettings._key,
    storageServiceSettings._blobEndpoint,
    storageServiceSettings._usePathStyleUri,
    storageServiceSettings._sasToken);

  this.defaultEnableReuseSocket = Constants.DEFAULT_ENABLE_REUSE_SOCKET;
  this.singleBlobPutThresholdInBytes = BlobConstants.DEFAULT_SINGLE_BLOB_PUT_THRESHOLD_IN_BYTES;
  this.parallelOperationThreadCount = Constants.DEFAULT_PARALLEL_OPERATION_THREAD_COUNT;
}

util.inherits(BlobService, StorageServiceClient);

// Non-class methods

/**
* Create resource name
* @ignore
*
* @param {string} containerName Container name
* @param {string} blobName      Blob name
* @return {string} The encoded resource name.
*/
function createResourceName(containerName, blobName, forSAS) {
  // Resource name
  if (blobName && !forSAS) {
    blobName = encodeURIComponent(blobName);
    blobName = blobName.replace(/%2F/g, '/');
    blobName = blobName.replace(/%5C/g, '/');
    blobName = blobName.replace(/\+/g, '%20');
  }

  // return URI encoded resource name
  if (blobName) {
    return containerName + '/' + blobName;
  }
  else {
    return containerName;
  }
}

// Blob service methods

/**
* Gets the service stats for a storage account’s Blob service.
*
* @this {BlobService}
* @param {object}       [options]                               The request options.
* @param {LocationMode} [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to.
*                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}          [options.timeoutIntervalInMs]           The timeout interval, in milliseconds, to use for the request.
* @param {int}          [options.clientRequestTimeoutInMs]      The timeout of client requests, in milliseconds, to use for the request.
* @param {int}          [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}       [options.clientRequestId]               A string that represents the client request ID with a 1KB character limit.
* @param {bool}         [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                               The default value is false.
* @param {errorOrResult}  callback                              `error` will contain information if an error occurs; otherwise, `[result]{@link ServiceStats}` will contain the stats and
*                                                               `response` will contain information related to this operation.
*/
BlobService.prototype.getServiceStats = function (optionsOrCallback, callback) {
  var options;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { options = o; callback = c; });

  validate.validateArgs('getServiceStats', function (v) {
    v.callback(callback);
  });

  var webResource = WebResource.get()
    .withQueryOption(QueryStringConstants.COMP, 'stats')
    .withQueryOption(QueryStringConstants.RESTYPE, 'service');

  options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;

  var processResponseCallback = function (responseObject, next) {
    responseObject.serviceStatsResult = null;
    if (!responseObject.error) {
      responseObject.serviceStatsResult = ServiceStatsParser.parse(responseObject.response.body.StorageServiceStats);
    }

    // function to be called after all filters
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.serviceStatsResult, returnObject.response);
    };

    // call the first filter
    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Gets the properties of a storage account’s Blob service, including Azure Storage Analytics.
*
* @this {BlobService}
* @param {object}       [options]                               The request options.
* @param {LocationMode} [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to.
*                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}          [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}          [options.clientRequestTimeoutInMs]      The timeout of client requests, in milliseconds, to use for the request.
* @param {int}          [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}       [options.clientRequestId]               A string that represents the client request ID with a 1KB character limit.
* @param {bool}         [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                               The default value is false.
* @param {errorOrResult}  callback                              `error` will contain information if an error occurs; otherwise, `[result]{@link ServiceProperties}` will contain the properties
*                                                               and `response` will contain information related to this operation.
*/
BlobService.prototype.getServiceProperties = function (optionsOrCallback, callback) {
  return this.getAccountServiceProperties(optionsOrCallback, callback);
};

/**
* Sets the properties of a storage account's Blob service, including Azure Storage Analytics.
* You can also use this operation to set the default request version for all incoming requests that do not have a version specified.
*
* @this {BlobService}
* @param {object}             serviceProperties                        The service properties.
* @param {object}             [options]                                The request options.
* @param {LocationMode}       [options.locationMode]                   Specifies the location mode used to decide which location the request should be sent to.
*                                                                      Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]            The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]       The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]       The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                      The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                      execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]              Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                      The default value is false.
* @param {errorOrResponse}    callback                                 `error` will contain information
*                                                                      if an error occurs; otherwise, `response`
*                                                                      will contain information related to this operation.
*/
BlobService.prototype.setServiceProperties = function (serviceProperties, optionsOrCallback, callback) {
  return this.setAccountServiceProperties(serviceProperties, optionsOrCallback, callback);
};

/**
* Sets the tier of a blockblob under a blob storage LRS account, or the tier of a pageblob under a premium storage account.
*
* @this {BlobService}
* @param {string}             container                                The container name.
* @param {string}             blob                                     The blob name.
* @param {string}             blobTier                                 Please see BlobUtilities.BlobTier.StandardBlobTier or BlobUtilities.BlobTier.PremiumPageBlobTier for possible values.
* @param {LocationMode}       [options.locationMode]                   Specifies the location mode used to decide which location the request should be sent to.
*                                                                      Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]            The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]       The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]       The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                      The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                      execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]              Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                      The default value is false.
* @param {errorOrResponse}    callback                                 `error` will contain information
*                                                                      if an error occurs; otherwise, `response`
*                                                                      will contain information related to this operation.
*/
BlobService.prototype.setBlobTier = function (container, blob, blobTier, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setBlobTier', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.string(blobTier, 'blobTier');
    v.containerNameIsValid(container);
    v.blobNameIsValid(container, blob);
    v.blobTierNameIsValid(blobTier);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'tier')
    .withHeader(HeaderConstants.ACCESS_TIER, blobTier);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Lists a segment containing a collection of container items under the specified account.
*
* @this {BlobService}
* @param {object}             currentToken                                A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.maxResults]                        Specifies the maximum number of containers to return per call to Azure storage.
* @param {string}             [options.include]                           Include this parameter to specify that the container's metadata be returned as part of the response body. (allowed values: '', 'metadata')
*                                                                         **Note** that all metadata names returned from the server will be converted to lower case by NodeJS itself as metadata is set via HTTP headers and HTTP header names are case insensitive.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain `entries` and `continuationToken`.
*                                                                         `entries`  gives a list of `[containers]{@link ContainerResult}` and the `continuationToken` is used for the next listing operation.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.listContainersSegmented = function (currentToken, optionsOrCallback, callback) {
  this.listContainersSegmentedWithPrefix(null /* prefix */, currentToken, optionsOrCallback, callback);
};

/**
* Lists a segment containing a collection of container items whose names begin with the specified prefix under the specified account.
*
* @this {BlobService}
* @param {string}             prefix                                      The prefix of the container name.
* @param {object}             currentToken                                A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                                   The request options.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.maxResults]                        Specifies the maximum number of containers to return per call to Azure storage.
* @param {string}             [options.include]                           Include this parameter to specify that the container's metadata be returned as part of the response body. (allowed values: '', 'metadata')
*                                                                         **Note** that all metadata names returned from the server will be converted to lower case by NodeJS itself as metadata is set via HTTP headers and HTTP header names are case insensitive.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain `entries` and `continuationToken`.
*                                                                         `entries`  gives a list of `[containers]{@link ContainerResult}` and the `continuationToken` is used for the next listing operation.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.listContainersSegmentedWithPrefix = function (prefix, currentToken, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listContainers', function (v) {
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get()
    .withQueryOption(QueryStringConstants.COMP, 'list')
    .withQueryOption(QueryStringConstants.MAX_RESULTS, options.maxResults)
    .withQueryOption(QueryStringConstants.INCLUDE, options.include);

  if (!azureutil.objectIsNull(currentToken)) {
    webResource.withQueryOption(QueryStringConstants.MARKER, currentToken.nextMarker);
  }

  webResource.withQueryOption(QueryStringConstants.PREFIX, prefix);

  options.requestLocationMode = azureutil.getNextListingLocationMode(currentToken);

  var processResponseCallback = function (responseObject, next) {
    responseObject.listContainersResult = null;

    if (!responseObject.error) {
      responseObject.listContainersResult = {
        entries: null,
        continuationToken: null
      };
      responseObject.listContainersResult.entries = [];

      var containers = [];

      if (responseObject.response.body.EnumerationResults.Containers && responseObject.response.body.EnumerationResults.Containers.Container) {
        containers = responseObject.response.body.EnumerationResults.Containers.Container;
        if (!_.isArray(containers)) {
          containers = [containers];
        }
      }

      containers.forEach(function (currentContainer) {
        var containerResult = ContainerResult.parse(currentContainer);
        responseObject.listContainersResult.entries.push(containerResult);
      });

      if (responseObject.response.body.EnumerationResults.NextMarker) {
        responseObject.listContainersResult.continuationToken = {
          nextMarker: null,
          targetLocation: null
        };

        responseObject.listContainersResult.continuationToken.nextMarker = responseObject.response.body.EnumerationResults.NextMarker;
        responseObject.listContainersResult.continuationToken.targetLocation = responseObject.targetLocation;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.listContainersResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

// Container methods

/**
* Checks whether or not a container exists on the service.
*
* @this {BlobService}
* @param {string}             container                               The container name.
* @param {object}             [options]                               The request options.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to.
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]               A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {errorOrResult}      callback                                `error` will contain information
*                                                                     if an error occurs; otherwise `[result]{@link ContainerResult}` will contain
*                                                                     the container information including `exists` boolean member.
*                                                                     `response` will contain information related to this operation.
*/
BlobService.prototype.doesContainerExist = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('doesContainerExist', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  this._doesContainerExist(container, false, options, callback);
};

/**
* Creates a new container under the specified account.
* If a container with the same name already exists, the operation fails.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {object}             [options.metadata]                  The metadata key/value pairs.
* @param {string}             [options.publicAccessLevel]         Specifies whether data in the container may be accessed publicly and the level of access.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResult}      callback                            `error` will contain information
*                                                                 if an error occurs; otherwise `[result]{@link ContainerResult}` will contain
*                                                                 the container information.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.createContainer = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createContainer', function (v) {
    v.string(container, 'container');
    v.test(function () { return container !== '$logs'; },
      'Container name format is incorrect');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container');

  webResource.addOptionalMetadataHeaders(options.metadata);
  webResource.withHeader(HeaderConstants.BLOB_PUBLIC_ACCESS, options.publicAccessLevel);

  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);

      if (options.metadata) {
        responseObject.containerResult.metadata = options.metadata;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Creates a new container under the specified account if the container does not exists.
*
* @this {BlobService}
* @param {string}             container                                 The container name.
* @param {object}             [options]                                 The request options.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to.
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {object}             [options.metadata]                        The metadata key/value pairs.
* @param {string}             [options.publicAccessLevel]               Specifies whether data in the container may be accessed publicly and the level of access.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]        The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                 A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]               Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                       The default value is false.
* @param {errorOrResult}      callback                                  `error` will contain information
*                                                                       if an error occurs; otherwise `[result]{@link ContainerResult}` will contain
*                                                                       the container information including `created` boolean member.
*                                                                       `response` will contain information related to this operation.
*
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* blobService.createContainerIfNotExists('taskcontainer', {publicAccessLevel : 'blob'}, function(error) {
*   if(!error) {
*     // Container created or exists, and is public
*   }
* });
*/
BlobService.prototype.createContainerIfNotExists = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createContainerIfNotExists', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesContainerExist(container, true, options, function (error, result, response) {
    var exists = result.exists;
    result.created = false;
    delete result.exists;

    if (error) {
      callback(error, result, response);
    } else if (exists) {
      response.isSuccessful = true;
      callback(error, result, response);
    } else {
      self.createContainer(container, options, function (createError, containerResult, createResponse) {
        if (!createError) {
          containerResult.created = true;
        }
        else if (createError && createError.statusCode === Constants.HttpConstants.HttpResponseCodes.Conflict && createError.code === Constants.BlobErrorCodeStrings.CONTAINER_ALREADY_EXISTS) {
          // If it was created before, there was no actual error.
          createError = null;
          createResponse.isSuccessful = true;
        }

        callback(createError, containerResult, createResponse);
      });
    }
  });
};

/**
* Retrieves a container and its properties from a specified account.
* **Note** that all metadata names returned from the server will be converted to lower case by NodeJS itself as metadata is set via HTTP headers and HTTP header names are case insensitive.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             [options]                           The request options.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {string}             [options.leaseId]                   The container lease identifier.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResult}      callback                            `error` will contain information
*                                                                 if an error occurs; otherwise `[result]{@link ContainerResult}` will contain
*                                                                 information for the container.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.getContainerProperties = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getContainerProperties', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.head(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withHeader(HeaderConstants.LEASE_ID, options.leaseId);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container);
      responseObject.containerResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Returns all user-defined metadata for the container.
* **Note** that all metadata names returned from the server will be converted to lower case by NodeJS itself as metadata is set via HTTP headers and HTTP header names are case insensitive.
*
* @this {BlobService}
* @param {string}             container                                 The container name.
* @param {object}             [options]                                 The request options.
* @param {string}             [options.leaseId]                         The container lease identifier.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to.
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]        The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                 A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]               Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                       The default value is false.
* @param {errorOrResult}      callback                                  `error` will contain information
*                                                                       if an error occurs; otherwise `[result]{@link ContainerResult}` will contain
*                                                                       information for the container.
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype.getContainerMetadata = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getContainerMetadata', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.head(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withQueryOption(QueryStringConstants.COMP, 'metadata')
    .withHeader(HeaderConstants.LEASE_ID, options.leaseId);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container);
      responseObject.containerResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Sets the container's metadata.
*
* Calling the Set Container Metadata operation overwrites all existing metadata that is associated with the container.
* It's not possible to modify an individual name/value pair.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             metadata                            The metadata key/value pairs.
* @param {object}             [options]                           The request options.
* @param {string}             [options.leaseId]                   The container lease identifier.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {AccessConditions}   [options.accessConditions]          The access conditions.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResponse}    callback                            `error` will contain information
*                                                                 if an error occurs; otherwise
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.setContainerMetadata = function (container, metadata, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setContainerMetadata', function (v) {
    v.string(container, 'container');
    v.object(metadata, 'metadata');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withQueryOption(QueryStringConstants.COMP, 'metadata')
    .withHeader(HeaderConstants.LEASE_ID, options.leaseId);

  webResource.addOptionalMetadataHeaders(metadata);

  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Gets the container's ACL.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             [options]                           The request options.
* @param {string}             [options.leaseId]                   The container lease identifier.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResult}      callback                            `error` will contain information
*                                                                 if an error occurs; otherwise `[result]{@link ContainerAclResult}` will contain
*                                                                 information for the container.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.getContainerAcl = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getContainerAcl', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withQueryOption(QueryStringConstants.COMP, 'acl')
    .withHeader(HeaderConstants.LEASE_ID, options.leaseId);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);
      responseObject.containerResult.signedIdentifiers = AclResult.parse(responseObject.response.body);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Updates the container's ACL.
*
* @this {BlobService}
* @param {string}                         container                           The container name.
* @param {Object.<string, AccessPolicy>}  signedIdentifiers                   The container ACL settings. See `[AccessPolicy]{@link AccessPolicy}` for detailed information.
* @param {object}                         [options]                           The request options.
* @param {AccessConditions}               [options.accessConditions]          The access conditions.
* @param {string}                         [options.publicAccessLevel]         Specifies whether data in the container may be accessed publicly and the level of access.
* @param {string}                         [options.leaseId]                   The container lease identifier.
* @param {int}                            [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                            [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                            [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                             The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                             execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}                         [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}                           [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                             The default value is false.
* @param {errorOrResult}                  callback                            `error` will contain information
*                                                                             if an error occurs; otherwise `[result]{@link ContainerAclResult}` will contain
*                                                                             information for the container.
*                                                                             `response` will contain information related to this operation.
*/
BlobService.prototype.setContainerAcl = function (container, signedIdentifiers, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setContainerAcl', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var policies = null;
  if (signedIdentifiers) {
    if (_.isArray(signedIdentifiers)) {
      throw new TypeError(SR.INVALID_SIGNED_IDENTIFIERS);
    }
    policies = AclResult.serialize(signedIdentifiers);
  }

  var webResource = WebResource.put(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withQueryOption(QueryStringConstants.COMP, 'acl')
    .withHeader(HeaderConstants.CONTENT_LENGTH, !azureutil.objectIsNull(policies) ? Buffer.byteLength(policies) : 0)
    .withHeader(HeaderConstants.BLOB_PUBLIC_ACCESS, options.publicAccessLevel)
    .withHeader(HeaderConstants.LEASE_ID, options.leaseId)
    .withBody(policies);

  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = null;
    if (!responseObject.error) {
      responseObject.containerResult = new ContainerResult(container, options.publicAccessLevel);
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);
      if (signedIdentifiers) {
        responseObject.containerResult.signedIdentifiers = signedIdentifiers;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

/**
* Marks the specified container for deletion.
* The container and any blobs contained within it are later deleted during garbage collection.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             [options]                           The request options.
* @param {AccessConditions}   [options.accessConditions]          The access conditions.
* @param {string}             [options.leaseId]                   The container lease identifier.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResponse}    callback                            `error` will contain information
*                                                                 if an error occurs; otherwise
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.deleteContainer = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteContainer', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.del(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withHeader(HeaderConstants.LEASE_ID, options.leaseId);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Marks the specified container for deletion if it exists.
* The container and any blobs contained within it are later deleted during garbage collection.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             [options]                           The request options.
* @param {AccessConditions}   [options.accessConditions]          The access conditions.
* @param {string}             [options.leaseId]                   The container lease identifier.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResult}      callback                            `error` will contain information
*                                                                 if an error occurs; otherwise `result` will
*                                                                 be true if the container exists and was deleted, or false if the container
*                                                                 did not exist.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.deleteContainerIfExists = function (container, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteContainerIfExists', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesContainerExist(container, true, options, function (error, result, response) {
    if (error) {
      callback(error, result.exists, response);
    } else if (!result.exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.deleteContainer(container, options, function (deleteError, deleteResponse) {
        var deleted;
        if (!deleteError) {
          deleted = true;
        } else if (deleteError && deleteError.statuscode === Constants.HttpConstants.HttpResponseCodes.NotFound && deleteError.code === Constants.BlobErrorCodeStrings.CONTAINER_NOT_FOUND) {
          // If it was deleted already, there was no actual error.
          deleted = false;
          deleteError = null;
          deleteResponse.isSuccessful = true;
        }

        callback(deleteError, deleted, deleteResponse);
      });
    }
  });
};

/**
* Lists a segment containing a collection of blob directory items in the container.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             currentToken                        A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                           The request options.
* @param {int}                [options.maxResults]                Specifies the maximum number of directories to return per call to Azure ServiceClient. This does NOT affect list size returned by this function. (maximum: 5000)
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResult}      callback                            `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain `entries` and `continuationToken`.
*                                                                 `entries`  gives a list of `[directories]{@link DirectoryResult}` and the `continuationToken` is used for the next listing operation.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.listBlobDirectoriesSegmented = function (container, currentToken, optionsOrCallback, callback) {
  this.listBlobDirectoriesSegmentedWithPrefix(container, null /* prefix */, currentToken, optionsOrCallback, callback);
};

/**
* Lists a segment containing a collection of blob directory items in the container.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {string}             prefix                              The prefix of the blob directory.
* @param {object}             currentToken                        A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                           The request options.
* @param {int}                [options.maxResults]                Specifies the maximum number of directories to return per call to Azure ServiceClient. This does NOT affect list size returned by this function. (maximum: 5000)
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResult}      callback                            `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain `entries` and `continuationToken`.
*                                                                 `entries`  gives a list of `[directories]{@link BlobResult}` and the `continuationToken` is used for the next listing operation.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.listBlobDirectoriesSegmentedWithPrefix = function (container, prefix, currentToken, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });
  userOptions.delimiter = '/';

  this._listBlobsOrDircotriesSegmentedWithPrefix(container, prefix, currentToken, BlobConstants.ListBlobTypes.Directory, userOptions, callback);
};

/**
* Lists a segment containing a collection of blob items in the container.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {object}             currentToken                        A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                           The request options.
* @param {string}             [options.delimiter]                 Delimiter, i.e. '/', for specifying folder hierarchy.
* @param {int}                [options.maxResults]                Specifies the maximum number of blobs to return per call to Azure ServiceClient. This does NOT affect list size returned by this function. (maximum: 5000)
* @param {string}             [options.include]                   Specifies that the response should include one or more of the following subsets: '', 'metadata', 'snapshots', 'uncommittedblobs', 'copy').
*                                                                 Please find these values in BlobUtilities.BlobListingDetails. Multiple values can be added separated with a comma (,).
*                                                                 **Note** that all metadata names returned from the server will be converted to lower case by NodeJS itself as metadata is set via HTTP headers and HTTP header names are case insensitive.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResult}      callback                            `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain `entries` and `continuationToken`.
*                                                                 `entries`  gives a list of `[blobs]{@link BlobResult}` and the `continuationToken` is used for the next listing operation.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.listBlobsSegmented = function (container, currentToken, optionsOrCallback, callback) {
  this.listBlobsSegmentedWithPrefix(container, null /* prefix */, currentToken, optionsOrCallback, callback);
};

/**
* Lists a segment containing a collection of blob items whose names begin with the specified prefix in the container.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {string}             prefix                              The prefix of the blob name.
* @param {object}             currentToken                        A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {object}             [options]                           The request options.
* @param {string}             [options.delimiter]                 Delimiter, i.e. '/', for specifying folder hierarchy.
* @param {int}                [options.maxResults]                Specifies the maximum number of blobs to return per call to Azure ServiceClient. This does NOT affect list size returned by this function. (maximum: 5000)
* @param {string}             [options.include]                   Specifies that the response should include one or more of the following subsets: '', 'metadata', 'snapshots', 'uncommittedblobs', 'copy').
*                                                                 Please find these values in BlobUtilities.BlobListingDetails. Multiple values can be added separated with a comma (,).
*                                                                 **Note** that all metadata names returned from the server will be converted to lower case by NodeJS itself as metadata is set via HTTP headers and HTTP header names are case insensitive.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResult}      callback                            `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain
*                                                                 the entries of `[blobs]{@link BlobResult}` and the continuation token for the next listing operation.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.listBlobsSegmentedWithPrefix = function (container, prefix, currentToken, optionsOrCallback, callback) {
  this._listBlobsOrDircotriesSegmentedWithPrefix(container, prefix, currentToken, BlobConstants.ListBlobTypes.Blob, optionsOrCallback, callback);
};

// Lease methods

/**
* Acquires a new lease. If container and blob are specified, acquires a blob lease. Otherwise, if only container is specified and blob is null, acquires a container lease.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseDuration]                     The lease duration in seconds. A non-infinite lease can be between 15 and 60 seconds. Default is never to expire.
* @param {string}             [options.proposedLeaseId]                   The proposed lease identifier. Must be a GUID.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `[result]{@link LeaseResult}` will contain
*                                                                         the lease information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.acquireLease = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('acquireLease', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  if (!options.leaseDuration) {
    options.leaseDuration = -1;
  }

  this._leaseImpl(container, blob, null /* leaseId */, BlobConstants.LeaseOperation.ACQUIRE, options, callback);
};

/**
* Renews an existing lease. If container and blob are specified, renews the blob lease. Otherwise, if only container is specified and blob is null, renews the container lease.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             leaseId                                     The lease identifier. Must be a GUID.
* @param {object}             [options]                                   The request options.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `[result]{@link LeaseResult}` will contain
*                                                                         the lease information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.renewLease = function (container, blob, leaseId, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('renewLease', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  this._leaseImpl(container, blob, leaseId, BlobConstants.LeaseOperation.RENEW, options, callback);
};

/**
* Changes the lease ID of an active lease. If container and blob are specified, changes the blob lease. Otherwise, if only container is specified and blob is null, changes the
* container lease.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             leaseId                                     The current lease identifier.
* @param {string}             proposedLeaseId                             The proposed lease identifier. Must be a GUID.
* @param {object}             [options]                                   The request options.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information if an error occurs;
*                                                                         otherwise `[result]{@link LeaseResult}` will contain  the lease information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.changeLease = function (container, blob, leaseId, proposedLeaseId, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('changeLease', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  options.proposedLeaseId = proposedLeaseId;
  this._leaseImpl(container, blob, leaseId, BlobConstants.LeaseOperation.CHANGE, options, callback);
};

/**
* Releases the lease. If container and blob are specified, releases the blob lease. Otherwise, if only container is specified and blob is null, releases the container lease.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             leaseId                                     The lease identifier.
* @param {object}             [options]                                   The request options.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `[result]{@link LeaseResult}` will contain
*                                                                         the lease information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.releaseLease = function (container, blob, leaseId, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('releaseLease', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  this._leaseImpl(container, blob, leaseId, BlobConstants.LeaseOperation.RELEASE, options, callback);
};

/**
* Breaks the lease but ensures that another client cannot acquire a new lease until the current lease period has expired. If container and blob are specified, breaks the blob lease.
* Otherwise, if only container is specified and blob is null, breaks the container lease.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {int}                [options.leaseBreakPeriod]                  The lease break period, between 0 and 60 seconds. If unspecified, a fixed-duration lease breaks after
*                                                                         the remaining lease period elapses, and an infinite lease breaks immediately.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `[result]{@link LeaseResult}` will contain
*                                                                         the lease information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.breakLease = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('breakLease', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  this._leaseImpl(container, blob, null /*leaseId*/, BlobConstants.LeaseOperation.BREAK, options, callback);
};

// Blob methods

/**
* Returns all user-defined metadata, standard HTTP properties, and system properties for the blob.
* It does not return or modify the content of the blob.
* **Note** that all metadata names returned from the server will be converted to lower case by NodeJS itself as metadata is set via HTTP headers and HTTP header names are case insensitive.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                         information about the blob.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.getBlobProperties = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getBlobProperties', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.head(resourceName);

  if (options.snapshotId) {
    webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);
  }

  BlobResult.setHeadersFromBlob(webResource, options);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Returns all user-defined metadata for the specified blob or snapshot.
* It does not modify or return the content of the blob.
* **Note** that all metadata names returned from the server will be converted to lower case by NodeJS itself as metadata is set via HTTP headers and HTTP header names are case insensitive.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                         information about the blob.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.getBlobMetadata = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getBlobMetadata', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.head(resourceName);

  webResource.withQueryOption(QueryStringConstants.COMP, 'metadata');
  webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);

  BlobResult.setHeadersFromBlob(webResource, options);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Sets user-defined properties for the specified blob or snapshot.
* It does not modify or return the content of the blob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [properties]                                The blob properties to set.
* @param {string}             [properties.contentType]                    The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [properties.contentEncoding]                The content encodings that have been applied to the blob.
* @param {string}             [properties.contentLanguage]                The natural languages used by this resource.
* @param {string}             [properties.cacheControl]                   The blob's cache control.
* @param {string}             [properties.contentDisposition]             The blob's content disposition.
* @param {string}             [properties.contentMD5]                     The blob's MD5 hash.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                         information about the blob.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.setBlobProperties = function (container, blob, properties, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setBlobProperties', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, { contentSettings: properties }, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'properties');

  BlobResult.setPropertiesFromBlob(webResource, options);

  this._setBlobPropertiesHelper({
    webResource: webResource,
    options: options,
    container: container,
    blob: blob,
    callback: callback
  });
};

/**
* Sets user-defined metadata for the specified blob or snapshot as one or more name-value pairs
* It does not modify or return the content of the blob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             metadata                                    The metadata key/value pairs.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                         information on the blob.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.setBlobMetadata = function (container, blob, metadata, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setBlobMetadata', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.object(metadata, 'metadata');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'metadata');

  webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);

  options.metadata = metadata;
  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};


/**
* Provides a stream to read from a blob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {string}             [options.rangeStart]                        Return only the bytes of the blob in the specified range.
* @param {string}             [options.rangeEnd]                          Return only the bytes of the blob in the specified range.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {boolean}            [options.useTransactionalMD5]               When set to true, Calculate and send/validate content MD5 for transactions.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading blobs.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information if an error occurs;
*                                                                         otherwise `[result]{@link BlobResult}` will contain the blob information.
*                                                                         `response` will contain information related to this operation.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* var writable = fs.createWriteStream(destinationFileNameTarget);
*  blobService.createReadStream(containerName, blobName).pipe(writable);
*/
BlobService.prototype.createReadStream = function (container, blob, optionsOrCallback, callback) {
  var options;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { options = o; callback = c; });

  validate.validateArgs('createReadStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
  });

  var readStream = new ChunkStream();
  this.getBlobToStream(container, blob, readStream, options, function (error, responseBlob, response) {
    if (error) {
      readStream.emit('error', error);
    }

    if (callback) {
      callback(error, responseBlob, response);
    }
  });

  return readStream;
};

/**
* Downloads a blob into a stream.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {Stream}             writeStream                                 The write stream.
* @param {object}             [options]                                   The request options.
* @param {boolean}            [options.skipSizeCheck]                     Skip the size check to perform direct download.
*                                                                         Set the option to true for small blobs.
*                                                                         Parallel download and speed summary won't work with this option on.
* @param {SpeedSummary}       [options.speedSummary]                      The download tracker objects.
* @param {int}                [options.parallelOperationThreadCount]      The number of parallel operations that may be performed when uploading.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {string}             [options.rangeStart]                        Return only the bytes of the blob in the specified range.
* @param {string}             [options.rangeEnd]                          Return only the bytes of the blob in the specified range.
* @param {boolean}            [options.useTransactionalMD5]               When set to true, Calculate and send/validate content MD5 for transactions.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading blobs.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information if an error occurs;
*                                                                         otherwise `[result]{@link BlobResult}` will contain the blob information.
*                                                                         `response` will contain information related to this operation.
* @return {SpeedSummary}
*
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* blobService.getBlobToStream('taskcontainer', 'task1', fs.createWriteStream('task1-download.txt'), function(error, serverBlob) {
*   if(!error) {
*     // Blob available in serverBlob.blob variable
*   }
* });
*/
BlobService.prototype.getBlobToStream = function (container, blob, writeStream, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });
  userOptions.speedSummary = userOptions.speedSummary || new SpeedSummary(blob);

  validate.validateArgs('getBlobToStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.object(writeStream, 'writeStream');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var propertiesRequestOptions = {
    timeoutIntervalInMs: options.timeoutIntervalInMs,
    clientRequestTimeoutInMs: options.clientRequestTimeoutInMs,
    snapshotId: options.snapshotId,
    accessConditions: options.accessConditions
  };

  if (options.skipSizeCheck) {
    this._getBlobToStream(container, blob, writeStream, options, callback);
  } else {
    var self = this;
    this.getBlobProperties(container, blob, propertiesRequestOptions, function (error, properties) {
      if (error) {
        callback(error);
      } else {
        var size;
        if (options.rangeStart) {
          var endOffset = properties.contentLength - 1;
          var end = options.rangeEnd ? Math.min(options.rangeEnd, endOffset) : endOffset;
          size = end - options.rangeStart + 1;
        } else {
          size = properties.contentLength;
        }
        options.speedSummary.totalSize = size;

        if (size > self.singleBlobPutThresholdInBytes) {
          azureutil.setObjectInnerPropertyValue(options, ['contentSettings', 'contentMD5'], azureutil.tryGetValueChain(properties, ['contentSettings', 'contentMD5'], null));
          self._getBlobToRangeStream(container, blob, properties.blobType, writeStream, options, callback);
        } else {
          self._getBlobToStream(container, blob, writeStream, options, callback);
        }
      }
    });
  }

  return options.speedSummary;
};

/**
* Downloads a blob into a text string.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {string}             [options.rangeStart]                        Return only the bytes of the blob in the specified range.
* @param {string}             [options.rangeEnd]                          Return only the bytes of the blob in the specified range.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading blobs.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {BlobService~blobToText}  callback                               `error` will contain information
*                                                                         if an error occurs; otherwise `text` will contain the blob contents,
*                                                                         and `[blockBlob]{@link BlobResult}` will contain
*                                                                         the blob information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.getBlobToText = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getBlobToText', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.get(resourceName)
    .withRawResponse();

  webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);

  BlobResult.setHeadersFromBlob(webResource, options);
  this._setRangeContentMD5Header(webResource, options);

  options.requestLocationMode = Constants.RequestLocationMode.PRIMARY_OR_SECONDARY;

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.text = null;
    responseObject.blobResult = null;

    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
      responseObject.text = responseObject.response.body;

      self._validateLengthAndMD5(options, responseObject);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.text, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Marks the specified blob or snapshot for deletion. The blob is later deleted during garbage collection.
* If a blob has snapshots, you must delete them when deleting the blob. Using the deleteSnapshots option, you can choose either to delete both the blob and its snapshots,
* or to delete only the snapshots but not the blob itself. If the blob has snapshots, you must include the deleteSnapshots option or the blob service will return an error
* and nothing will be deleted.
* If you are deleting a specific snapshot using the snapshotId option, the deleteSnapshots option must NOT be included.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.deleteSnapshots]                   The snapshot delete option. See azure.BlobUtilities.SnapshotDeleteOptions.*.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResponse}    callback                                    `error` will contain information
*                                                                         if an error occurs; `response` will contain information related to this operation.
*/
BlobService.prototype.deleteBlob = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.del(resourceName)
    .withHeader(HeaderConstants.LEASE_ID, options.leaseId);

  if (!azureutil.objectIsNull(options.snapshotId) && !azureutil.objectIsNull(options.deleteSnapshots)) {
    throw new ArgumentError('options', SR.INVALID_DELETE_SNAPSHOT_OPTION);
  }

  webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);
  webResource.withHeader(HeaderConstants.DELETE_SNAPSHOT, options.deleteSnapshots);

  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Checks whether or not a blob exists on the service.
*
* @this {BlobService}
* @param {string}             container                               The container name.
* @param {string}             blob                                    The blob name.
* @param {object}             [options]                               The request options.
* @param {string}             [options.snapshotId]                    The snapshot identifier.
* @param {string}             [options.leaseId]                       The lease identifier.
* @param {LocationMode}       [options.locationMode]                  Specifies the location mode used to decide which location the request should be sent to.
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]           The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]      The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]      The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]               A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {Function(error, result, response)}  callback                `error` will contain information
*                                                                     if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                     the blob information including the `exists` boolean member.
*                                                                     `response` will contain information related to this operation.
*/
BlobService.prototype.doesBlobExist = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('doesBlobExist', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  this._doesBlobExist(container, blob, false, options, callback);
};

/**
* Marks the specified blob or snapshot for deletion if it exists. The blob is later deleted during garbage collection.
* If a blob has snapshots, you must delete them when deleting the blob. Using the deleteSnapshots option, you can choose either to delete both the blob and its snapshots,
* or to delete only the snapshots but not the blob itself. If the blob has snapshots, you must include the deleteSnapshots option or the blob service will return an error
* and nothing will be deleted.
* If you are deleting a specific snapshot using the snapshotId option, the deleteSnapshots option must NOT be included.
*
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {string}             blob                                The blob name.
* @param {object}             [options]                           The request options.
* @param {string}             [options.deleteSnapshots]           The snapshot delete option. See azure.BlobUtilities.SnapshotDeleteOptions.*.
* @param {string}             [options.snapshotId]                The snapshot identifier.
* @param {string}             [options.leaseId]                   The lease identifier.
* @param {AccessConditions}   [options.accessConditions]          The access conditions.
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResult}      callback                            `error` will contain information
*                                                                 if an error occurs; otherwise `result` will
*                                                                 be true if the blob was deleted, or false if the blob
*                                                                 does not exist.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype.deleteBlobIfExists = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('deleteBlobIfExists', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var self = this;
  self._doesBlobExist(container, blob, true, options, function (error, existsResult, response) {
    if (error) {
      callback(error, existsResult.exists, response);
    } else if (!existsResult.exists) {
      response.isSuccessful = true;
      callback(error, false, response);
    } else {
      self.deleteBlob(container, blob, options, function (deleteError, deleteResponse) {
        var deleted;
        if (!deleteError) {
          deleted = true;
        } else if (deleteError && deleteError.statusCode === Constants.HttpConstants.HttpResponseCodes.NotFound && deleteError.code === Constants.BlobErrorCodeStrings.BLOB_NOT_FOUND) {
          // If it was deleted already, there was no actual error.
          deleted = false;
          deleteError = null;
          deleteResponse.isSuccessful = true;
        }

        callback(deleteError, deleted, deleteResponse);
      });
    }
  });
};

/**
* Creates a read-only snapshot of a blob.
*
* @this {BlobService}
* @param {string}             container                             The container name.
* @param {string}             blob                                  The blob name.
* @param {object}             [options]                             The request options.
* @param {string}             [options.snapshotId]                  The snapshot identifier.
* @param {object}             [options.metadata]                    The metadata key/value pairs.
* @param {string}             [options.leaseId]                     The lease identifier.
* @param {AccessConditions}   [options.accessConditions]            The access conditions.
* @param {LocationMode}       [options.locationMode]                Specifies the location mode used to decide which location the request should be sent to.
*                                                                   Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]         The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]    The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]    The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                   The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                   execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]             A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]           Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                   The default value is false.
* @param {errorOrResult}      callback                              `error` will contain information
*                                                                   if an error occurs; otherwise `result` will contain
*                                                                   the ID of the snapshot.
*                                                                   `response` will contain information related to this operation.
*/
BlobService.prototype.createBlobSnapshot = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createBlobSnapshot', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'snapshot');

  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    responseObject.snapshotId = null;
    if (!responseObject.error) {
      responseObject.snapshotId = responseObject.response.headers[HeaderConstants.SNAPSHOT];
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.snapshotId, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Starts to copy a blob to a destination within the storage account. The Copy Blob operation copies the entire committed blob.
*
* @this {BlobService}
* @param {string}             sourceUri                                 The source blob URI.
* @param {string}             targetContainer                           The target container name.
* @param {string}             targetBlob                                The target blob name.
* @param {object}             [options]                                 The request options.
* @param {string}             [options.blobTier]                        For page blobs on premium accounts only. Set the tier of target blob. Refer to BlobUtilities.BlobTier.PremiumPageBlobTier.
* @param {boolean}            [options.isIncrementalCopy]               If it's incremental copy or not. Refer to https://docs.microsoft.com/en-us/rest/api/storageservices/fileservices/incremental-copy-blob
* @param {string}             [options.snapshotId]                      The source blob snapshot identifier.
* @param {object}             [options.metadata]                        The target blob metadata key/value pairs.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {string}             [options.sourceLeaseId]                   The source blob lease identifier.
* @param {AccessConditions}   [options.accessConditions]                The access conditions.
* @param {AccessConditions}   [options.sourceAccessConditions]          The source access conditions.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to.
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]        The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                 A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]               Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                       The default value is false.
* @param {errorOrResult}      callback                                  `error` will contain information
*                                                                       if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                       the blob information.
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype.startCopyBlob = function (sourceUri, targetContainer, targetBlob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('startCopyBlob', function (v) {
    v.string(sourceUri, 'sourceUri');
    v.string(targetContainer, 'targetContainer');
    v.string(targetBlob, 'targetBlob');
    v.containerNameIsValid(targetContainer);
    v.callback(callback);
  });

  var targetResourceName = createResourceName(targetContainer, targetBlob);

  var options = extend(true, {}, userOptions);

  if (options.snapshotId) {
    var uri = url.parse(sourceUri, true);
    if (uri.query['snapshot']) {
      throw new ArgumentError('options.snapshotId', 'Duplicate snapshot supplied in both the source uri and option.');
    }

    uri.search = undefined;
    uri.query['snapshot'] = options.snapshotId;

    sourceUri = url.format(uri);
  }

  var webResource = WebResource.put(targetResourceName)
    .withHeader(HeaderConstants.COPY_SOURCE, sourceUri);

  if (options.isIncrementalCopy) {
    webResource.withQueryOption(QueryStringConstants.COMP, 'incrementalcopy');
  }

  webResource.withHeader(HeaderConstants.ACCESS_TIER, options.blobTier);
  webResource.withHeader(HeaderConstants.LEASE_ID, options.leaseId);
  webResource.withHeader(HeaderConstants.SOURCE_LEASE_ID, options.sourceLeaseId);
  webResource.addOptionalMetadataHeaders(options.metadata);

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(targetContainer, targetBlob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);

      if (options.metadata) {
        responseObject.blobResult.metadata = options.metadata;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Abort a blob copy operation.
*
* @this {BlobService}
* @param {string}             container                                 The destination container name.
* @param {string}             blob                                      The destination blob name.
* @param {string}             copyId                                    The copy operation identifier.
* @param {object}             [options]                                 The request options.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to.
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]        The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                 A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]               Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                       The default value is false.
* @param {errorOrResponse}    callback                                  `error` will contain information  if an error occurs;
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype.abortCopyBlob = function (container, blob, copyId, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('abortCopyBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var resourceName = createResourceName(container, blob);

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COPY_ID, copyId)
    .withQueryOption(QueryStringConstants.COMP, 'copy')
    .withHeader(HeaderConstants.COPY_ACTION, 'abort');

  webResource.withHeader(HeaderConstants.LEASE_ID, options.leaseId);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Retrieves a shared access signature token.
*
* @this {BlobService}
* @param {string}                   container                                           The container name.
* @param {string}                   [blob]                                              The blob name.
* @param {object}                   sharedAccessPolicy                                  The shared access policy.
* @param {string}                   [sharedAccessPolicy.Id]                             The signed identifier.
* @param {object}                   [sharedAccessPolicy.AccessPolicy.Permissions]       The permission type.
* @param {date|string}              [sharedAccessPolicy.AccessPolicy.Start]             The time at which the Shared Access Signature becomes valid (The UTC value will be used).
* @param {date|string}              [sharedAccessPolicy.AccessPolicy.Expiry]            The time at which the Shared Access Signature becomes expired (The UTC value will be used).
* @param {string}                   [sharedAccessPolicy.AccessPolicy.IPAddressOrRange]  An IP address or a range of IP addresses from which to accept requests. When specifying a range, note that the range is inclusive.
* @param {string}                   [sharedAccessPolicy.AccessPolicy.Protocols]         The protocols permitted for a request made with the account SAS.
*                                                                                       Possible values are both HTTPS and HTTP (https,http) or HTTPS only (https). The default value is https,http.
* @param {object}                   [headers]                                           The optional header values to set for a blob returned wth this SAS.
* @param {string}                   [headers.cacheControl]                              The optional value of the Cache-Control response header to be returned when this SAS is used.
* @param {string}                   [headers.contentType]                               The optional value of the Content-Type response header to be returned when this SAS is used.
* @param {string}                   [headers.contentEncoding]                           The optional value of the Content-Encoding response header to be returned when this SAS is used.
* @param {string}                   [headers.contentLanguage]                           The optional value of the Content-Language response header to be returned when this SAS is used.
* @param {string}                   [headers.contentDisposition]                        The optional value of the Content-Disposition response header to be returned when this SAS is used.
* @return {string}                                                                      The shared access signature query string. Note this string does not contain the leading "?".
*/
BlobService.prototype.generateSharedAccessSignature = function (container, blob, sharedAccessPolicy, headers) {
  // check if the BlobService is able to generate a shared access signature
  if (!this.storageCredentials) {
    throw new ArgumentNullError('storageCredentials');
  }

  if (!this.storageCredentials.generateSignedQueryString) {
    throw new ArgumentError('storageCredentials', SR.CANNOT_CREATE_SAS_WITHOUT_ACCOUNT_KEY);
  }

  // Validate container name. Blob name is optional.
  validate.validateArgs('generateSharedAccessSignature', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.object(sharedAccessPolicy, 'sharedAccessPolicy');
  });

  var resourceType = BlobConstants.ResourceTypes.CONTAINER;
  if (blob) {
    validate.validateArgs('generateSharedAccessSignature', function (v) {
      v.string(blob, 'blob');
    });
    resourceType = BlobConstants.ResourceTypes.BLOB;
  }

  if (sharedAccessPolicy.AccessPolicy) {
    if (!azureutil.objectIsNull(sharedAccessPolicy.AccessPolicy.Start)) {
      if (!_.isDate(sharedAccessPolicy.AccessPolicy.Start)) {
        sharedAccessPolicy.AccessPolicy.Start = new Date(sharedAccessPolicy.AccessPolicy.Start);
      }

      sharedAccessPolicy.AccessPolicy.Start = azureutil.truncatedISO8061Date(sharedAccessPolicy.AccessPolicy.Start);
    }

    if (!azureutil.objectIsNull(sharedAccessPolicy.AccessPolicy.Expiry)) {
      if (!_.isDate(sharedAccessPolicy.AccessPolicy.Expiry)) {
        sharedAccessPolicy.AccessPolicy.Expiry = new Date(sharedAccessPolicy.AccessPolicy.Expiry);
      }

      sharedAccessPolicy.AccessPolicy.Expiry = azureutil.truncatedISO8061Date(sharedAccessPolicy.AccessPolicy.Expiry);
    }
  }

  var resourceName = createResourceName(container, blob, true);
  return this.storageCredentials.generateSignedQueryString(Constants.ServiceType.Blob, resourceName, sharedAccessPolicy, null, { headers: headers, resourceType: resourceType });
};

/**
* Retrieves a blob or container URL.
*
* @param {string}                   container                The container name.
* @param {string}                   [blob]                   The blob name.
* @param {string}                   [sasToken]               The Shared Access Signature token.
* @param {boolean}                  [primary]                A boolean representing whether to use the primary or the secondary endpoint.
* @param {boolean}                  [snapshotId]             The snapshot identifier.
* @return {string}                                           The formatted URL string.
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* var sharedAccessPolicy = {
*   AccessPolicy: {
*     Permissions: azure.BlobUtilities.SharedAccessPermissions.READ,
*     Start: startDate,
*     Expiry: expiryDate
*   },
* };
*
* var sasToken = blobService.generateSharedAccessSignature(containerName, blobName, sharedAccessPolicy);
* var sasUrl = blobService.getUrl(containerName, blobName, sasToken);
*/
BlobService.prototype.getUrl = function (container, blob, sasToken, primary, snapshotId) {
  validate.validateArgs('getUrl', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
  });

  var host;
  if (!azureutil.objectIsNull(primary) && primary === false) {
    host = this.host.secondaryHost;
  } else {
    host = this.host.primaryHost;
  }

  host = azureutil.trimPortFromUri(host);
  if (host && host.lastIndexOf('/') !== (host.length - 1)) {
    host = host + '/';
  }

  var query = qs.parse(sasToken);
  if (snapshotId) {
    query[QueryStringConstants.SNAPSHOT] = snapshotId;
  }

  var fullPath = url.format({ pathname: this._getPath(createResourceName(container, blob)), query: query });
  return url.resolve(host, fullPath);
};

// Page blob methods

/**
* Creates a page blob of the specified length. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {int}                length                                        The length of the page blob in bytes.
* @param {object}             [options]                                     The request options.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {string}             [options.leaseId]                             The target blob lease identifier.
* @param {string}             [options.blobTier]                            For page blobs on premium accounts only. Set the tier of the target blob. Refer to BlobUtilities.BlobTier.PremiumPageBlobTier.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The MD5 hash of the blob content.
* @param {string}             [options.sequenceNumber]                      The blob's sequence number.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResponse}    callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise
*                                                                           `response` will contain information related to this operation.
*/
BlobService.prototype.createPageBlob = function (container, blob, length, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createPageBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.value(length, 'length');
    v.callback(callback);
  });

  if (length && length % BlobConstants.PAGE_SIZE !== 0) {
    throw new RangeError(SR.INVALID_PAGE_BLOB_LENGTH);
  }

  var options = extend(true, {}, userOptions);

  var resourceName = createResourceName(container, blob);

  var webResource = WebResource.put(resourceName)
    .withHeader(HeaderConstants.BLOB_TYPE, BlobConstants.BlobTypes.PAGE)
    .withHeader(HeaderConstants.BLOB_CONTENT_LENGTH, length)
    .withHeader(HeaderConstants.CONTENT_LENGTH, 0)
    .withHeader(HeaderConstants.ACCESS_TIER, options.blobTier)
    .withHeader(HeaderConstants.LEASE_ID, options.leaseId);

  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Uploads a page blob from a stream. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param (Stream)             stream                                        Stream to the data to store.
* @param {int}                streamLength                                  The length of the stream to upload.
* @param {object}             [options]                                     The request options.
* @param {SpeedSummary}       [options.speedSummary]                        The download tracker objects;
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             An MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads.
*                                                                           The default value is false for page blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.blobTier]                            For page blobs on premium accounts only. Set the tier of the target blob. Refer to BlobUtilities.BlobTier.PremiumPageBlobTier.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
* @return {SpeedSummary}
*/
BlobService.prototype.createPageBlobFromStream = function (container, blob, stream, streamLength, optionsOrCallback, callback) {
  return this._createBlobFromStream(container, blob, BlobConstants.BlobTypes.PAGE, stream, streamLength, optionsOrCallback, callback);
};

/**
* Provides a stream to write to a page blob. Assumes that the blob exists.
* If it does not, please create the blob using createPageBlob before calling this method or use createWriteStreamNewPageBlob.
* Please note the `Stream` returned by this API should be used with piping.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {object}             [options]                                     The request options.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads.
*                                                                           The default value is false for page blobs and true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* blobService.createPageBlob(containerName, blobName, 1024, function (err) {
*   // Pipe file to a blob
*   var stream = fs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToExistingPageBlob(containerName, blobName));
* });
*/
BlobService.prototype.createWriteStreamToExistingPageBlob = function (container, blob, optionsOrCallback, callback) {
  return this._createWriteStreamToBlob(container, blob, BlobConstants.BlobTypes.PAGE, 0, false, optionsOrCallback, callback);
};

/**
* Provides a stream to write to a page blob. Creates the blob before writing data. If the blob already exists on the service, it will be overwritten.
* Please note the `Stream` returned by this API should be used with piping.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {string}             length                                        The blob length.
* @param {object}             [options]                                     The request options.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads.
*                                                                           The default value is false for page blobs and true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.blobTier]                            For page blobs on premium accounts only. Set the tier of the target blob. Refer to BlobUtilities.BlobTier.PremiumPageBlobTier.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* blobService.createPageBlob(containerName, blobName, 1024, function (err) {
*   // Pipe file to a blob
*   var stream = fs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToNewPageBlob(containerName, blobName));
* });
*/
BlobService.prototype.createWriteStreamToNewPageBlob = function (container, blob, length, optionsOrCallback, callback) {
  return this._createWriteStreamToBlob(container, blob, BlobConstants.BlobTypes.PAGE, length, true, optionsOrCallback, callback);
};

/**
* Updates a page blob from a stream.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {Stream}             readStream                                  The read stream.
* @param {int}                rangeStart                                  The range start.
* @param {int}                rangeEnd                                    The range end.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {bool}               [options.useTransactionalMD5]               Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.transactionalContentMD5]           An optional hash value used to ensure transactional integrity for the page.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                         the page information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.createPagesFromStream = function (container, blob, readStream, rangeStart, rangeEnd, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createPagesFromStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  if ((rangeEnd - rangeStart) + 1 > BlobConstants.MAX_UPDATE_PAGE_SIZE) {
    throw new RangeError(SR.INVALID_PAGE_RANGE_FOR_UPDATE);
  }

  var self = this;
  if (azureutil.objectIsNull(options.transactionalContentMD5) && options.useTransactionalMD5) {
    azureutil.calculateMD5(readStream, BlobConstants.MAX_UPDATE_PAGE_SIZE, options, function (internalBuff, contentMD5) {
      options.transactionalContentMD5 = contentMD5;
      self._createPages(container, blob, internalBuff, null /* stream */, rangeStart, rangeEnd, options, callback);
    });
  } else {
    self._createPages(container, blob, null /* text */, readStream, rangeStart, rangeEnd, options, callback);
  }
};

/**
* Lists page ranges. Lists all of the page ranges by default, or only the page ranges over a specific range of bytes if rangeStart and rangeEnd are specified.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {object}             [options]                                   The request options.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {int}                [options.rangeStart]                        The range start.
* @param {int}                [options.rangeEnd]                          The range end.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the page ranges information, see `[Range]{@link Range}` for detailed information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.listPageRanges = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listPageRanges', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.get(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'pagelist')
    .withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);

  if (options.rangeStart && options.rangeStart % BlobConstants.PAGE_SIZE !== 0) {
    throw new RangeError(SR.INVALID_PAGE_START_OFFSET);
  }

  if (options.rangeEnd && (options.rangeEnd + 1) % BlobConstants.PAGE_SIZE !== 0) {
    throw new RangeError(SR.INVALID_PAGE_END_OFFSET);
  }

  BlobResult.setHeadersFromBlob(webResource, options);

  options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;

  var processResponseCallback = function (responseObject, next) {
    responseObject.pageRanges = null;
    if (!responseObject.error) {
      responseObject.pageRanges = [];

      var pageRanges = [];
      if (responseObject.response.body.PageList.PageRange) {
        pageRanges = responseObject.response.body.PageList.PageRange;

        if (!_.isArray(pageRanges)) {
          pageRanges = [pageRanges];
        }
      }

      pageRanges.forEach(function (pageRange) {
        var range = {
          start: parseInt(pageRange.Start, 10),
          end: parseInt(pageRange.End, 10)
        };

        responseObject.pageRanges.push(range);
      });
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.pageRanges, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Gets page ranges that have been updated or cleared since the snapshot specified by `previousSnapshotTime` was taken. Gets all of the page ranges by default, or only the page ranges over a specific range of bytes if rangeStart and rangeEnd are specified.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             previousSnapshotTime                        The previous snapshot time for comparison. Must be prior to `options.snapshotId` if it's provided.
* @param {object}             [options]                                   The request options.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {int}                [options.rangeStart]                        The range start.
* @param {int}                [options.rangeEnd]                          The range end.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the page ranges diff information, see `[RangeDiff]{@link RangeDiff}` for detailed information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.getPageRangesDiff = function (container, blob, previousSnapshotTime, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('getPageRangesDiff', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.get(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'pagelist')
    .withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId)
    .withQueryOption(QueryStringConstants.PREV_SNAPSHOT, previousSnapshotTime);

  if (options.rangeStart && options.rangeStart % BlobConstants.PAGE_SIZE !== 0) {
    throw new RangeError(SR.INVALID_PAGE_START_OFFSET);
  }

  if (options.rangeEnd && (options.rangeEnd + 1) % BlobConstants.PAGE_SIZE !== 0) {
    throw new RangeError(SR.INVALID_PAGE_END_OFFSET);
  }

  if (options.rangeEnd && (options.rangeEnd + 1) % BlobConstants.PAGE_SIZE !== 0) {
    throw new RangeError(SR.INVALID_PAGE_END_OFFSET);
  }

  BlobResult.setHeadersFromBlob(webResource, options);

  options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;

  var processResponseCallback = function (responseObject, next) {
    responseObject.pageRangesDiff = null;
    if (!responseObject.error) {
      responseObject.pageRangesDiff = [];

      if (responseObject.response.body.PageList.PageRange) {
        var updatedPageRanges = responseObject.response.body.PageList.PageRange;

        if (!_.isArray(updatedPageRanges)) {
          updatedPageRanges = [updatedPageRanges];
        }

        updatedPageRanges.forEach(function (pageRange) {
          var range = {
            start: parseInt(pageRange.Start, 10),
            end: parseInt(pageRange.End, 10),
            isCleared: false
          };

          responseObject.pageRangesDiff.push(range);
        });
      }

      if (responseObject.response.body.PageList.ClearRange) {
        var clearedPageRanges = responseObject.response.body.PageList.ClearRange;

        if (!_.isArray(clearedPageRanges)) {
          clearedPageRanges = [clearedPageRanges];
        }

        clearedPageRanges.forEach(function (pageRange) {
          var range = {
            start: parseInt(pageRange.Start, 10),
            end: parseInt(pageRange.End, 10),
            isCleared: true
          };

          responseObject.pageRangesDiff.push(range);
        });
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.pageRangesDiff, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Clears a range of pages.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {int}                rangeStart                                  The range start.
* @param {int}                rangeEnd                                    The range end.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResponse}    callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.clearPageRange = function (container, blob, rangeStart, rangeEnd, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('clearPageRange', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var request = this._updatePageBlobPagesImpl(container, blob, rangeStart, rangeEnd, BlobConstants.PageWriteOptions.CLEAR, options);

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  self.performRequest(request, null, options, processResponseCallback);
};

/**
* Resizes a page blob.
*
* @this {BlobService}
* @param {string}               container                                   The container name.
* @param {string}               blob                                        The blob name.
* @param {String}               size                                        The size of the page blob, in bytes.
* @param {object}               [options]                                   The request options.
* @param {string}               [options.leaseId]                           The blob lease identifier.
* @param {AccessConditions}     [options.accessConditions]                  The access conditions.
* @param {LocationMode}         [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                  [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                  [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                  [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}               [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}                 [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the page information.
*                                                                           `response` will contain information related to this operation.
*/
BlobService.prototype.resizePageBlob = function (container, blob, size, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('resizePageBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'properties');

  if (size && size % BlobConstants.PAGE_SIZE !== 0) {
    throw new RangeError(SR.INVALID_PAGE_BLOB_LENGTH);
  }

  webResource.withHeader(HeaderConstants.BLOB_CONTENT_LENGTH, size);

  this._setBlobPropertiesHelper({
    webResource: webResource,
    options: options,
    container: container,
    blob: blob,
    callback: callback
  });

};

/**
* Sets the page blob's sequence number.
*
* @this {BlobService}
* @param {string}               container                                   The container name.
* @param {string}               blob                                        The blob name.
* @param {SequenceNumberAction} sequenceNumberAction                        A value indicating the operation to perform on the sequence number.
*                                                                           The allowed values are defined in azure.BlobUtilities.SequenceNumberAction.
* @param {string}               sequenceNumber                              The sequence number.  The value of the sequence number must be between 0 and 2^63 - 1.
*                                                                           Set this parameter to null if this operation is an increment action.
* @param {object}               [options]                                   The request options.
* @param {AccessConditions}     [options.accessConditions]                  The access conditions.
* @param {LocationMode}         [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                  [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                  [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                  [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}               [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}                 [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the page information.
*                                                                           `response` will contain information related to this operation.
*/
BlobService.prototype.setPageBlobSequenceNumber = function (container, blob, sequenceNumberAction, sequenceNumber, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('setPageBlobSequenceNumber', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  if (sequenceNumberAction === BlobUtilities.SequenceNumberAction.INCREMENT) {
    if (!azureutil.objectIsNull(sequenceNumber)) {
      throw new ArgumentError('sequenceNumber', SR.BLOB_INVALID_SEQUENCE_NUMBER);
    }
  } else {
    if (azureutil.objectIsNull(sequenceNumber)) {
      throw new ArgumentNullError('sequenceNumber', util.format(SR.ARGUMENT_NULL_OR_EMPTY, 'sequenceNumber'));
    }
  }

  var options = extend(true, {}, userOptions);
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'properties')
    .withHeader(HeaderConstants.SEQUENCE_NUMBER_ACTION, sequenceNumberAction);

  if (sequenceNumberAction !== BlobUtilities.SequenceNumberAction.INCREMENT) {
    webResource.withHeader(HeaderConstants.SEQUENCE_NUMBER, sequenceNumber);
  }

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

// Block blob methods

/**
* Uploads a block blob from a stream. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param (Stream)             stream                                        Stream to the data to store.
* @param {int}                streamLength                                  The length of the stream to upload.
* @param {object}             [options]                                     The request options.
* @param {SpeedSummary}       [options.speedSummary]                        The download tracker objects.
* @param {int}                [options.blockSize]                           The size of each block. Maximum is 100MB.
* @param {string}             [options.blockIdPrefix]                       The prefix to be used to generate the block id.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
* @return {SpeedSummary}
*/
BlobService.prototype.createBlockBlobFromStream = function (container, blob, stream, streamLength, optionsOrCallback, callback) {
  return this._createBlobFromStream(container, blob, BlobConstants.BlobTypes.BLOCK, stream, streamLength, optionsOrCallback, callback);
};

/**
* Uploads a block blob from a text string. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {string|object}      text                                          The blob text, as a string or in a Buffer.
* @param {object}             [options]                                     The request options.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
*/
BlobService.prototype.createBlockBlobFromText = function (container, blob, text, optionsOrCallback, callback) {
  return this._createBlobFromText(container, blob, BlobConstants.BlobTypes.BLOCK, text, optionsOrCallback, callback);
};

/**
* Provides a stream to write to a block blob. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
* Please note the `Stream` returned by this API should be used with piping.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {object}             [options]                                     The request options.
* @param {int}                [options.blockSize]                           The size of each block. Maximum is 100MB.
* @param {string}             [options.blockIdPrefix]                       The prefix to be used to generate the block id.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads.
*                                                                           The default value is false for page blobs and true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* var stream = fs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToBlockBlob(containerName, blobName, { blockIdPrefix: 'block' }));
*/
BlobService.prototype.createWriteStreamToBlockBlob = function (container, blob, optionsOrCallback, callback) {
  return this._createWriteStreamToBlob(container, blob, BlobConstants.BlobTypes.BLOCK, 0, false, optionsOrCallback, callback);
};

/**
* Creates a new block to be committed as part of a blob.
*
* @this {BlobService}
* @param {string}             blockId                                   The block identifier.
* @param {string}             container                                 The container name.
* @param {string}             blob                                      The blob name.
* @param {Stream}             readStream                                The read stream.
* @param {int}                streamLength                              The stream length.
* @param {object}             [options]                                 The request options.
* @param {bool}               [options.useTransactionalMD5]             Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {string}             [options.transactionalContentMD5]         An MD5 hash of the block content. This hash is used to verify the integrity of the block during transport.
* @param {AccessConditions}   [options.accessConditions]                The access conditions.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to.
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]        The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                 A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]               Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                       The default value is false.
* @param {errorOrResponse}    callback                                  `error` will contain information
*                                                                       if an error occurs; otherwise
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype.createBlockFromStream = function (blockId, container, blob, readStream, streamLength, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createBlockFromStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.exists(readStream, 'readStream');
    v.value(streamLength, 'streamLength');
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  if (streamLength > BlobConstants.MAX_BLOCK_BLOB_BLOCK_SIZE) {
    throw new RangeError(SR.INVALID_STREAM_LENGTH);
  } else {
    this._createBlock(blockId, container, blob, null, readStream, streamLength, options, callback);
  }
};

/**
* Creates a new block to be committed as part of a blob.
*
* @this {BlobService}
* @param {string}             blockId                                   The block identifier.
* @param {string}             container                                 The container name.
* @param {string}             blob                                      The blob name.
* @param {string|buffer}      content                                   The block content.
* @param {object}             [options]                                 The request options.
* @param {bool}               [options.useTransactionalMD5]             Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {string}             [options.transactionalContentMD5]         An MD5 hash of the block content. This hash is used to verify the integrity of the block during transport.
* @param {AccessConditions}   [options.accessConditions]                The access conditions.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to.
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]        The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                 A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]               Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                       The default value is false.
* @param {errorOrResponse}    callback                                  `error` will contain information
*                                                                       if an error occurs; otherwise
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype.createBlockFromText = function (blockId, container, blob, content, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createBlockFromText', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var contentLength = (Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content));

  if (contentLength > BlobConstants.MAX_BLOCK_BLOB_BLOCK_SIZE) {
    throw new RangeError(SR.INVALID_TEXT_LENGTH);
  } else {
    this._createBlock(blockId, container, blob, content, null, contentLength, options, callback);
  }
};

/**
* Creates a new block to be committed as part of a block blob.
* @ignore
*
* @this {BlobService}
* @param {string}             blockId                                   The block identifier.
* @param {string}             container                                 The container name.
* @param {string}             blob                                      The blob name.
* @param {string|buffer}      content                                   The block content.
* @param (Stream)             stream                                    The stream to the data to store.
* @param {int}                length                                    The length of the stream or text to upload.
* @param {object}             [options]                                 The request options.
* @param {bool}               [options.useTransactionalMD5]             Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {string}             [options.transactionalContentMD5]         An MD5 hash of the block content. This hash is used to verify the integrity of the block during transport.
* @param {AccessConditions}   [options.accessConditions]                The access conditions.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to.
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]        The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                 A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]               Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                       The default value is false.
* @param {errorOrResponse}    callback                                  `error` will contain information
*                                                                       if an error occurs; otherwise
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype._createBlock = function (blockId, container, blob, content, stream, length, options, callback) {
  var resourceName = createResourceName(container, blob);

  var self = this;
  var startCreateBlock = function () {
    var webResource = WebResource.put(resourceName)
      .withQueryOption(QueryStringConstants.COMP, 'block')
      .withQueryOption(QueryStringConstants.BLOCK_ID, new Buffer(blockId).toString('base64'))
      .withHeader(HeaderConstants.CONTENT_LENGTH, length);

    BlobResult.setHeadersFromBlob(webResource, options);

    var processResponseCallback = function (responseObject, next) {
      var finalCallback = function (returnObject) {
        callback(returnObject.error, returnObject.response);
      };

      next(responseObject, finalCallback);
    };

    if (!azureutil.objectIsNull(content)) {
      self.performRequest(webResource, content, options, processResponseCallback);
    } else {
      self.performRequestOutputStream(webResource, stream, options, processResponseCallback);
    }
  };

  if (azureutil.objectIsNull(options.transactionalContentMD5) && options.useTransactionalMD5) {
    if (!azureutil.objectIsNull(content)) {
      options.transactionalContentMD5 = azureutil.getContentMd5(content);
      startCreateBlock();
    } else {
      azureutil.calculateMD5(stream, length, options, function (internalBuff, contentMD5) {
        options.transactionalContentMD5 = contentMD5;
        content = internalBuff;
        length = internalBuff.length;
        startCreateBlock();
      });
    }
  } else {
    startCreateBlock();
  }
};

/**
* Writes a blob by specifying the list of block IDs that make up the blob.
* In order to be written as part of a blob, a block must have been successfully written to the server in a prior
* createBlock operation.
* Note: If no valid list is specified in the blockList parameter, blob would be updated with empty content,
* i.e. existing blocks in the blob will be removed, this behavior is kept for backward compatibility consideration.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {object}             blockList                                     The wrapper for block ID list contains block IDs that make up the blob.
*                                                                           Three kinds of list are provided, please choose one to use according to requirement.
*                                                                           For more background knowledge, please refer to https://docs.microsoft.com/en-us/rest/api/storageservices/put-block-list
* @param {string[]}           [blockList.LatestBlocks]                      The list contains block IDs that make up the blob sequentially.
*                                                                           All the block IDs in this list will be specified within Latest element.
*                                                                           Choose this list to contain block IDs indicates that the Blob service should first search
*                                                                           the uncommitted block list, and then the committed block list for the named block.
* @param {string[]}           [blockList.CommittedBlocks]                   The list contains block IDs that make up the blob sequentially.
*                                                                           All the block IDs in this list will be specified within Committed element.
*                                                                           Choose this list to contain block IDs indicates that the Blob service should only search
*                                                                           the committed block list for the named block.
* @param {string[]}           [blockList.UncommittedBlocks]                 The list contains block IDs that make up the blob sequentially.
*                                                                           All the block IDs in this list will be specified within Uncommitted element.
*                                                                           Choose this list to contain block IDs indicates that the Blob service should only search
*                                                                           the uncommitted block list for the named block.
* @param {object}             [options]                                     The request options.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {string}             [options.leaseId]                             The target blob lease identifier.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* blobService.createBlockFromText("sampleBlockName", containerName, blobName, "sampleBlockContent", function(error) {
*   assert.equal(error, null);
*   // In this example, LatestBlocks is used, we hope the Blob service first search
*   // the uncommitted block list, and then the committed block list for the named block "sampleBlockName",
*   // and thus make sure the block is with latest content.
*   blobService.commitBlocks(containerName, blobName, { LatestBlocks: ["sampleBlockName"] }, function(error) {
*     assert.equal(error, null);
*   });
* });
*
 */
BlobService.prototype.commitBlocks = function (container, blob, blockList, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('commitBlocks', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.object(blockList, 'blockList');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var blockListXml = BlockListResult.serialize(blockList);

  var resourceName = createResourceName(container, blob);
  var options = extend(true, {}, userOptions);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'blocklist')
    .withHeader(HeaderConstants.CONTENT_LENGTH, Buffer.byteLength(blockListXml))
    .withBody(blockListXml);

  BlobResult.setPropertiesFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = new BlobResult(container, blob);
    responseObject.blobResult.list = null;
    if (!responseObject.error) {
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
      responseObject.blobResult.list = blockList;
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, webResource.body, options, processResponseCallback);
};

/**
* Retrieves the list of blocks that have been uploaded as part of a block blob.
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {BlockListFilter}    blocklisttype                               The type of block list to retrieve.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The source blob snapshot identifier.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information
*                                                                         if an error occurs; otherwise `result` will contain
*                                                                         the blocklist information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype.listBlocks = function (container, blob, blocklisttype, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listBlocks', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var resourceName = createResourceName(container, blob);
  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'blocklist')
    .withQueryOption(QueryStringConstants.BLOCK_LIST_TYPE, blocklisttype)
    .withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);

  options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;

  var processResponseCallback = function (responseObject, next) {
    responseObject.blockListResult = null;
    if (!responseObject.error) {
      responseObject.blockListResult = BlockListResult.parse(responseObject.response.body.BlockList);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blockListResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Generate a random block id prefix
*/
BlobService.prototype.generateBlockIdPrefix = function () {
  var prefix = Math.floor(Math.random() * 0x100000000).toString(16);
  return azureutil.zeroPaddingString(prefix, 8);
};

/**
* Get a block id according to prefix and block number
*/
BlobService.prototype.getBlockId = function (prefix, number) {
  return prefix + '-' + azureutil.zeroPaddingString(number, 6);
};

// Append blob methods

/**
* Creates an empty append blob. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {object}             [options]                                     The request options.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {string}             [options.leaseId]                             The target blob lease identifier.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResponse}    callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise
*                                                                           `response` will contain information related to this operation.
*/
BlobService.prototype.createOrReplaceAppendBlob = function (container, blob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('createOrReplaceAppendBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var resourceName = createResourceName(container, blob);

  var webResource = WebResource.put(resourceName)
    .withHeader(HeaderConstants.BLOB_TYPE, BlobConstants.BlobTypes.APPEND)
    .withHeader(HeaderConstants.LEASE_ID, options.leaseId)
    .withHeader(HeaderConstants.CONTENT_LENGTH, 0);

  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Uploads an append blob from a stream. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
* This API should be used strictly in a single writer scenario because the API internally uses the append-offset conditional header to avoid duplicate blocks.
* If you are guaranteed to have a single writer scenario, please look at options.absorbConditionalErrorsOnRetry and see if setting this flag to true is acceptable for you.
* If you want to append data to an already existing blob, please look at appendFromStream.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param (Stream)             stream                                        Stream to the data to store.
* @param {int}                streamLength                                  The length of the stream to upload.
* @param {object}             [options]                                     The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry.
* @param {SpeedSummary}       [options.speedSummary]                        The download tracker objects.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
* @return {SpeedSummary}
*/
BlobService.prototype.createAppendBlobFromStream = function (container, blob, stream, streamLength, optionsOrCallback, callback) {
  return this._createBlobFromStream(container, blob, BlobConstants.BlobTypes.APPEND, stream, streamLength, optionsOrCallback, callback);
};

/**
* Uploads an append blob from a text string. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
* This API should be used strictly in a single writer scenario because the API internally uses the append-offset conditional header to avoid duplicate blocks.
* If you are guaranteed to have a single writer scenario, please look at options.absorbConditionalErrorsOnRetry and see if setting this flag to true is acceptable for you.
* If you want to append data to an already existing blob, please look at appendFromText.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {string|object}      text                                          The blob text, as a string or in a Buffer.
* @param {object}             [options]                                     The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
*/
BlobService.prototype.createAppendBlobFromText = function (container, blob, text, optionsOrCallback, callback) {
  return this._createBlobFromText(container, blob, BlobConstants.BlobTypes.APPEND, text, optionsOrCallback, callback);
};

/**
* Provides a stream to write to a new append blob. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
* This API should be used strictly in a single writer scenario because the API internally uses the append-offset conditional header to avoid duplicate blocks.
* If you are guaranteed to have a single writer scenario, please look at options.absorbConditionalErrorsOnRetry and see if setting this flag to true is acceptable for you.
* Please note the `Stream` returned by this API should be used with piping.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {object}             [options]                                     The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads.
*                                                                           The default value is false for page blobs and true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResponse}    callback                                      The callback function.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* var stream = fs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToAppendBlob(containerName, blobName));
*/
BlobService.prototype.createWriteStreamToNewAppendBlob = function (container, blob, optionsOrCallback, callback) {
  return this._createWriteStreamToBlob(container, blob, BlobConstants.BlobTypes.APPEND, 0, true, optionsOrCallback, callback);
};

/**
* Provides a stream to write to an existing append blob. Assumes that the blob exists.
* If it does not, please create the blob using createAppendBlob before calling this method or use createWriteStreamToNewAppendBlob.
* This API should be used strictly in a single writer scenario because the API internally uses the append-offset conditional header to avoid duplicate blocks.
* If you are guaranteed to have a single writer scenario, please look at options.absorbConditionalErrorsOnRetry and see if setting this flag to true is acceptable for you.
* Please note the `Stream` returned by this API should be used with piping.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {object}             [options]                                     The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads.
*                                                                           The default value is false for page blobs and true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResponse}    callback                                      The callback function.
* @return {Stream}
* @example
* var azure = require('azure-storage');
* var blobService = azure.createBlobService();
* var stream = fs.createReadStream(fileNameTarget).pipe(blobService.createWriteStreamToAppendBlob(containerName, blobName));
*/
BlobService.prototype.createWriteStreamToExistingAppendBlob = function (container, blob, optionsOrCallback, callback) {
  return this._createWriteStreamToBlob(container, blob, BlobConstants.BlobTypes.APPEND, 0, false, optionsOrCallback, callback);
};

/**
* Appends to an append blob from a stream. Assumes the blob already exists on the service.
* This API should be used strictly in a single writer scenario because the API internally uses the append-offset conditional header to avoid duplicate blocks.
* If you are guaranteed to have a single writer scenario, please look at options.absorbConditionalErrorsOnRetry and see if setting this flag to true is acceptable for you.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param (Stream)             stream                                        Stream to the data to store.
* @param {int}                streamLength                                  The length of the stream to upload.
* @param {object}             [options]                                     The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry.
* @param {SpeedSummary}       [options.speedSummary]                        The download tracker objects.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
* @return {SpeedSummary}
*/
BlobService.prototype.appendFromStream = function (container, blob, stream, streamLength, optionsOrCallback, callback) {
  var options;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { options = o; callback = c; });

  validate.validateArgs('appendFromStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.exists(stream, 'stream');
    v.value(streamLength, 'streamLength');
    v.callback(callback);
  });

  return this._uploadBlobFromStream(false, container, blob, BlobConstants.BlobTypes.APPEND, stream, streamLength, options, callback);
};

/**
* Appends to an append blob from a text string. Assumes the blob already exists on the service.
* This API should be used strictly in a single writer scenario because the API internally uses the append-offset conditional header to avoid duplicate blocks.
* If you are guaranteed to have a single writer scenario, please look at options.absorbConditionalErrorsOnRetry and see if setting this flag to true is acceptable for you.
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {string|object}      text                                          The blob text, as a string or in a Buffer.
* @param {object}             [options]                                     The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                           the blob information.
*                                                                           `response` will contain information related to this operation.
*/
BlobService.prototype.appendFromText = function (container, blob, text, optionsOrCallback, callback) {
  return this._uploadBlobFromText(false, container, blob, BlobConstants.BlobTypes.APPEND, text, optionsOrCallback, callback);
};


/**
* Creates a new block from a read stream to be appended to an append blob.
* This API should be used strictly in a single writer scenario because the API internally uses the append-offset conditional header to avoid duplicate blocks.
* If you are guaranteed to have a single writer scenario, please look at options.absorbConditionalErrorsOnRetry and see if setting this flag to true is acceptable for you.
*
* @this {BlobService}
* @param {string}             container                                 The container name.
* @param {string}             blob                                      The blob name.
* @param {Stream}             readStream                                The read stream.
* @param {int}                streamLength                              The stream length.
* @param {object}             [options]                                 The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]  Specifies whether to absorb the conditional error on retry.
* @param {int}                [options.maxBlobSize]                     The max length in bytes allowed for the append blob to grow to.
* @param {int}                [options.appendPosition]                  The number indicating the byte offset to check for. The append will succeed only if the end position of the blob is equal to this number.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {string}             [options.transactionalContentMD5]         An MD5 hash of the block content. This hash is used to verify the integrity of the block during transport.
* @param {AccessConditions}   [options.accessConditions]                The access conditions.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to.
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]        The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                 A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]               Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                       The default value is false.
* @param {errorOrResult}      callback                                  `error` will contain information
*                                                                      if an error occurs; otherwise `[result]{@link BlobResult}` will contain
*                                                                      the blob information.
*                                                                      `response` will contain information related to this operation.
*/
BlobService.prototype.appendBlockFromStream = function (container, blob, readStream, streamLength, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('appendBlockFromStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.exists(readStream, 'readStream');
    v.value(streamLength, 'streamLength');
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  if (streamLength > BlobConstants.MAX_APPEND_BLOB_BLOCK_SIZE) {
    throw new RangeError(SR.INVALID_STREAM_LENGTH);
  } else {
    this._appendBlock(container, blob, null, readStream, streamLength, options, callback);
  }
};

/**
* Creates a new block from a text to be appended to an append blob.
* This API should be used strictly in a single writer scenario because the API internally uses the append-offset conditional header to avoid duplicate blocks.
* If you are guaranteed to have a single writer scenario, please look at options.absorbConditionalErrorsOnRetry and see if setting this flag to true is acceptable for you.
*
* @this {BlobService}
* @param {string}             container                                 The container name.
* @param {string}             blob                                      The blob name.
* @param {string|object}      content                                   The block text, as a string or in a Buffer.
* @param {object}             [options]                                 The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]  Specifies whether to absorb the conditional error on retry.
* @param {int}                [options.maxBlobSize]                     The max length in bytes allowed for the append blob to grow to.
* @param {int}                [options.appendPosition]                  The number indicating the byte offset to check for. The append will succeed only if the end position of the blob is equal to this number.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {string}             [options.transactionalContentMD5]         An MD5 hash of the block content. This hash is used to verify the integrity of the block during transport.
* @param {AccessConditions}   [options.accessConditions]                The access conditions.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to.
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]        The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                 A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]               Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                       The default value is false.
* @param {errorOrResponse}    callback                                  `error` will contain information
*                                                                       if an error occurs; otherwise
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype.appendBlockFromText = function (container, blob, content, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('appendBlockFromText', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var contentLength = (Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content));
  if (contentLength > BlobConstants.MAX_APPEND_BLOB_BLOCK_SIZE) {
    throw new RangeError(SR.INVALID_TEXT_LENGTH);
  } else {
    this._appendBlock(container, blob, content, null, contentLength, options, callback);
  }
};

// Private methods

/**
* Creates a new blob from a stream. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
*
* @ignore
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {BlobType}           blobType                                      The blob type.
* @param (Stream)             stream                                        Stream to the data to store.
* @param {int}                streamLength                                  The length of the stream to upload.
* @param {object}             [options]                                     The request options.
* @param {SpeedSummary}       [options.speedSummary]                        The upload tracker objects.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry. (For append blob only)
* @param {string}             [options.blockIdPrefix]                       The prefix to be used to generate the block id. (For block blob only)
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.blobTier]                            For page blobs on premium accounts only. Set the tier of the target blob. Refer to BlobUtilities.BlobTier.PremiumPageBlobTier.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      The callback function.
* @return {SpeedSummary}
*/
BlobService.prototype._createBlobFromStream = function (container, blob, blobType, stream, streamLength, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('_createBlobFromStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.blobTypeIsValid(blobType);
    v.exists(stream, 'stream');
    v.value(streamLength, 'streamLength');
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var self = this;
  var creationCallback = function (createError, createBlob, createResponse) {
    if (createError) {
      callback(createError, createBlob, createResponse);
    } else {
      self._uploadBlobFromStream(true, container, blob, blobType, stream, streamLength, options, callback);
    }
  };

  this._createBlob(container, blob, blobType, streamLength, options, creationCallback);

  return options.speedSummary;
};

/**
* Uploads a block blob or an append blob from a text string. If the blob already exists on the service, it will be overwritten.
* To avoid overwriting and instead throw an error if the blob exists, please pass in an accessConditions parameter in the options object.
*
* @ignore
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {BlobType}           blobType                                      The blob type.
* @param {string|buffer}      content                                       The blob text, as a string or in a Buffer.
* @param {object}             [options]                                     The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry. (For append blob only)
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `result` will contain
*                                                                           information about the blob.
*                                                                           `response` will contain information related to this operation.
*/
BlobService.prototype._createBlobFromText = function (container, blob, blobType, content, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('_createBlobFromText', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.blobTypeIsValid(blobType);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);

  var self = this;
  var creationCallback = function (createError, createBlob, createResponse) {
    if (createError) {
      callback(createError, createBlob, createResponse);
    } else {
      self._uploadBlobFromText(true, container, blob, blobType, content, options, callback);
    }
  };

  var contentLength = azureutil.objectIsNull(content) ? 0 : ((Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content)));
  this._createBlob(container, blob, blobType, contentLength, options, creationCallback);

  return options.speedSummary;
};

/**
* Provides a stream to write to a block blob or an append blob.
*
* @ignore
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {BlobType}           blobType                                      The blob type.
* @param {int}                length                                        The blob length.
* @param {bool}               createNewBlob                                 Specifies whether create a new blob.
* @param {object}             [options]                                     The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry. (For append blob only)
* @param {string}             [options.blockSize]                           The size of each block. Maximum is 100MB. (For block blob only)
* @param {string}             [options.blockIdPrefix]                       The prefix to be used to generate the block id. (For block blob only)
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads.
*                                                                           The default value is false for page blobs and true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.blobTier]                            For page blobs on premium accounts only. Set the tier of the target blob. Refer to BlobUtilities.BlobTier.PremiumPageBlobTier.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResponse}    callback                                      The callback function.
* @return {Stream}
*/
BlobService.prototype._createWriteStreamToBlob = function (container, blob, blobType, length, createNewBlob, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('_createWriteStreamToBlob', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.blobTypeIsValid(blobType);
  });

  var options = extend(true, {}, userOptions);

  var sizeLimitation;
  if (blobType === BlobConstants.BlobTypes.BLOCK) {
    // default to true, unless explicitly set to false
    options.storeBlobContentMD5 = options.storeBlobContentMD5 === false ? false : true;
    sizeLimitation = options.blockSize || BlobConstants.DEFAULT_WRITE_BLOCK_SIZE_IN_BYTES;
  } else if (blobType == BlobConstants.BlobTypes.PAGE) {
    sizeLimitation = BlobConstants.DEFAULT_WRITE_PAGE_SIZE_IN_BYTES;
  } else if (blobType == BlobConstants.BlobTypes.APPEND) {
    sizeLimitation = BlobConstants.DEFAULT_WRITE_BLOCK_SIZE_IN_BYTES;
  }

  var stream = new ChunkStream({ calcContentMd5: options.storeBlobContentMD5 });
  stream._highWaterMark = sizeLimitation;

  stream.pause(); //Immediately pause the stream in order to wait for the destination to getting ready

  var self = this;
  var createCallback = function (createError, createBlob, createResponse) {
    if (createError) {
      if (callback) {
        callback(createError, createBlob, createResponse);
      }
    } else {
      self._uploadBlobFromStream(createNewBlob, container, blob, blobType, stream, null, options, function (error, blob, response) {
        if (error) {
          stream.emit('error', error);
        }

        if (callback) {
          callback(error, blob, response);
        }
      });
    }
  };

  if (createNewBlob === true) {
    this._createBlob(container, blob, blobType, length, options, createCallback);
  } else {
    createCallback();
  }

  return stream;
};

/**
* Upload blob content from a stream. Assumes the blob already exists.
*
* @ignore
*
* @this {BlobService}
* @param {bool}               isNewBlob                                     Specifies whether the blob is newly created.
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {BlobType}           blobType                                      The blob type.
* @param (Stream)             stream                                        Stream to the data to store.
* @param {int}                streamLength                                  The length of the stream to upload.
* @param {object}             [options]                                     The request options.
* @param {SpeedSummary}       [options.speedSummary]                        The upload tracker objects.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry. (For append blob only)
* @param {string}             [options.blockIdPrefix]                       The prefix to be used to generate the block id. (For block blob only)
* @param {int}                [options.blockSize]                           The size of each block. Maximum is 100MB. (For block blob only)
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      The callback function.
* @return {SpeedSummary}
*/
BlobService.prototype._uploadBlobFromStream = function (isNewBlob, container, blob, blobType, stream, streamLength, optionsOrCallback, callback) {
  var options;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { options = o; callback = c; });
  options.speedSummary = options.speedSummary || new SpeedSummary(blob);

  if (blobType === BlobConstants.BlobTypes.BLOCK) {
    // default to true, unless explicitly set to false
    options.storeBlobContentMD5 = options.storeBlobContentMD5 === false ? false : true;
  }

  stream.pause();

  var self = this;
  var startUpload = function () {
    var putBlockBlobFromStream = function () {
      if (streamLength > 0 && azureutil.objectIsNull(azureutil.tryGetValueChain(options, ['contentSettings', 'contentMD5'], null)) && options.storeBlobContentMD5) {
        azureutil.calculateMD5(stream, Math.min(self.singleBlobPutThresholdInBytes, streamLength), options, function (internalBuff, contentMD5) {
          azureutil.setObjectInnerPropertyValue(options, ['contentSettings', 'contentMD5'], contentMD5);
          self._putBlockBlob(container, blob, internalBuff, null, internalBuff.length, options, callback);
        });
        stream.resume();
      } else {
        // Stream will resume when it has a pipe destination or a 'data' listener
        self._putBlockBlob(container, blob, null, stream, streamLength, options, callback);
      }
    };

    if (streamLength === null || streamLength >= self.singleBlobPutThresholdInBytes || blobType !== BlobConstants.BlobTypes.BLOCK) {
      var chunkStream = new ChunkStreamWithStream(stream, { calcContentMd5: options.storeBlobContentMD5 });
      self._uploadContentFromChunkStream(container, blob, blobType, chunkStream, streamLength, options, callback);
    } else {
      putBlockBlobFromStream();
    }
  };

  if (!isNewBlob) {
    if (options.storeBlobContentMD5 && blobType !== BlobConstants.BlobTypes.BLOCK) {
      throw new Error(SR.MD5_NOT_POSSIBLE);
    }

    if (blobType === BlobConstants.BlobTypes.APPEND || options.accessConditions) {
      // Do a getBlobProperties right at the beginning for existing blobs and use the user passed in access conditions.
      // So any pre-condition failure on the first block (in a strictly single writer scenario) is caught.
      // This call also helps us get the append position to append to if the user hasn’t specified an access condition.
      this.getBlobProperties(container, blob, options, function (error, properties, response) {
        if (error && !(options.accessConditions && options.accessConditions.EtagNonMatch === '*' && response.statusCode === 400)) {
          callback(error);
        } else {
          if (blobType === BlobConstants.BlobTypes.APPEND) {
            options.appendPosition = properties.contentLength;
          }

          startUpload();
        }
      });
    } else {
      startUpload();
    }
  } else {
    startUpload();
  }

  return options.speedSummary;
};

/**
* Upload blob content from a text. Assumes the blob already exists.
*
* @ignore
*
* @this {BlobService}
* @param {bool}               isNewBlob                                     Specifies whether the blob is newly created.
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {BlobType}           blobType                                      The blob type.
* @param (string)             content                                       The blob text, as a string or in a Buffer.
* @param {object}             [options]                                     The request options.
* @param {SpeedSummary}       [options.speedSummary]                        The upload tracker objects.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry. (For append blob only)
* @param {string}             [options.blockIdPrefix]                       The prefix to be used to generate the block id. (For block blob only)
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      The callback function.
* @return {SpeedSummary}
*/
BlobService.prototype._uploadBlobFromText = function (isNewBlob, container, blob, blobType, content, optionsOrCallback, callback) {
  var options;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { options = o; callback = c; });
  options.speedSummary = options.speedSummary || new SpeedSummary(blob);
  options[HeaderConstants.CONTENT_TYPE] = (options.contentSettings && options.contentSettings.contentType) || 'text/plain;charset="utf-8"';

  var self = this;
  var startUpload = function () {
    var operationFunc;
    var length = azureutil.objectIsNull(content) ? 0 : (Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content));

    if (blobType === BlobConstants.BlobTypes.BLOCK) {
      // default to true, unless explicitly set to false
      options.storeBlobContentMD5 = options.storeBlobContentMD5 === false ? false : true;
      operationFunc = self._putBlockBlob;

      if (length > BlobConstants.MAX_SINGLE_UPLOAD_BLOB_SIZE_IN_BYTES) {
        throw new RangeError(SR.INVALID_BLOB_LENGTH);
      }
    } else if (blobType === BlobConstants.BlobTypes.APPEND) {
      operationFunc = self._appendBlock;

      if (length > BlobConstants.MAX_APPEND_BLOB_BLOCK_SIZE) {
        throw new RangeError(SR.INVALID_TEXT_LENGTH);
      }
    }

    var finalCallback = function (error, blobResult, response) {
      if (blobType !== BlobConstants.BlobTypes.BLOCK) {
        self.setBlobProperties(container, blob, options.contentSettings, function (error, blob, response) {
          blob = extend(false, blob, blobResult);
          callback(error, blob, response);
        });
      } else {
        callback(error, blobResult, response);
      }
    };

    operationFunc.call(self, container, blob, content, null, length, options, finalCallback);
  };

  if (!isNewBlob) {
    if (options.storeBlobContentMD5 && blobType !== BlobConstants.BlobTypes.BLOCK) {
      throw new Error(SR.MD5_NOT_POSSIBLE);
    }

    if (blobType === BlobConstants.BlobTypes.APPEND || options.accessConditions) {
      // Do a getBlobProperties right at the beginning for existing blobs and use the user passed in access conditions.
      // So any pre-condition failure on the first block (in a strictly single writer scenario) is caught.
      // This call also helps us get the append position to append to if the user hasn’t specified an access condition.
      this.getBlobProperties(container, blob, options, function (error, properties) {
        if (error) {
          callback(error);
        } else {
          if (blobType === BlobConstants.BlobTypes.APPEND) {
            options.appendPosition = properties.contentLength;
          }

          startUpload();
        }
      });
    }
  } else {
    if (!azureutil.objectIsNull(content) && azureutil.objectIsNull(azureutil.tryGetValueChain(options, ['contentSettings', 'contentMD5'], null)) && options.storeBlobContentMD5) {
      azureutil.setObjectInnerPropertyValue(options, ['contentSettings', 'contentMD5'], azureutil.getContentMd5(content));
    }
    startUpload();
  }
};

/**
* Uploads a block blob from a stream.
* @ignore
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {string}             text                                          The blob text.
* @param (Stream)             stream                                        Stream to the data to store.
* @param {int}                length                                        The length of the stream or text to upload.
* @param {object}             [options]                                     The request options.
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {string}             [options.transactionalContentMD5]             The MD5 hash of the blob content. This hash is used to verify the integrity of the blob during transport.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads. The default value is true for block blobs.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {errorOrResult}      callback                                      `error` will contain information
*                                                                           if an error occurs; otherwise `result` will contain
*                                                                           information about the blob.
*                                                                           `response` will contain information related to this operation.
*/
BlobService.prototype._putBlockBlob = function (container, blob, text, stream, length, options, callback) {
  if (!options.speedSummary) {
    options.speedSummary = new SpeedSummary(blob);
  }

  var speedSummary = options.speedSummary;
  speedSummary.totalSize = length;

  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withHeader(HeaderConstants.CONTENT_TYPE, 'application/octet-stream')
    .withHeader(HeaderConstants.BLOB_TYPE, BlobConstants.BlobTypes.BLOCK)
    .withHeader(HeaderConstants.CONTENT_LENGTH, length);

  if (!azureutil.objectIsNull(text) && azureutil.objectIsNull(options.transactionalContentMD5) && options.useTransactionalMD5) {
    options.transactionalContentMD5 = azureutil.getContentMd5(text);
  }

  BlobResult.setHeadersFromBlob(webResource, options);

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
      if (options.metadata) {
        responseObject.blobResult.metadata = options.metadata;
      }
    }

    var finalCallback = function (returnObject) {
      if (!returnObject || !returnObject.error) {
        speedSummary.increment(length);
      }
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  if (!azureutil.objectIsNull(text)) {
    this.performRequest(webResource, text, options, processResponseCallback);
  } else {
    this.performRequestOutputStream(webResource, stream, options, processResponseCallback);
  }

  return options.speedSummary;
};

/**
* Appends a new block to an append blob.
*
* @ignore
*
* @this {BlobService}
* @param {string}             container                                 The container name.
* @param {string}             blob                                      The blob name.
* @param {string|buffer}      content                                   The block content.
* @param (Stream)             stream                                    The stream to the data to store.
* @param {int}                length                                    The length of the stream or content to upload.
* @param {object}             [options]                                 The request options.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]  Specifies whether to absorb the conditional error on retry.
* @param {int}                [options.maxBlobSize]                     The max length in bytes allowed for the append blob to grow to.
* @param {int}                [options.appendPosition]                  The number indicating the byte offset to check for. The append will succeed only if the end position of the blob is equal to this number.
* @param {string}             [options.leaseId]                         The target blob lease identifier.
* @param {string}             [options.transactionalContentMD5]         The blob’s MD5 hash. This hash is used to verify the integrity of the blob during transport.
* @param {bool}               [options.useTransactionalMD5]             Calculate and send/validate content MD5 for transactions.
* @param {AccessConditions}   [options.accessConditions]                The access conditions.
* @param {LocationMode}       [options.locationMode]                    Specifies the location mode used to decide which location the request should be sent to.
*                                                                       Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]             The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]        The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]        The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                       The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                       execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                 A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]               Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                       The default value is false.
* @param {errorOrResponse}    callback                                  `error` will contain information
*                                                                       if an error occurs; otherwise
*                                                                       `response` will contain information related to this operation.
*/
BlobService.prototype._appendBlock = function (container, blob, content, stream, length, options, callback) {
  var speedSummary = options.speedSummary || new SpeedSummary(blob);
  speedSummary.totalSize = length;

  var self = this;
  var startAppendBlock = function () {
    var resourceName = createResourceName(container, blob);

    var webResource = WebResource.put(resourceName)
      .withQueryOption(QueryStringConstants.COMP, 'appendblock')
      .withHeader(HeaderConstants.CONTENT_LENGTH, length)
      .withHeader(HeaderConstants.BLOB_CONDITION_MAX_SIZE, options.maxBlobSize)
      .withHeader(HeaderConstants.BLOB_CONDITION_APPEND_POSITION, options.appendPosition);

    BlobResult.setHeadersFromBlob(webResource, options);

    var processResponseCallback = function (responseObject, next) {
      responseObject.blobResult = null;
      if (!responseObject.error) {
        responseObject.blobResult = new BlobResult(container, blob);
        responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
      }

      var finalCallback = function (returnObject) {
        if (!returnObject || !returnObject.error) {
          speedSummary.increment(length);
        }
        callback(returnObject.error, returnObject.blobResult, returnObject.response);
      };

      next(responseObject, finalCallback);
    };

    if (!azureutil.objectIsNull(content)) {
      self.performRequest(webResource, content, options, processResponseCallback);
    } else {
      self.performRequestOutputStream(webResource, stream, options, processResponseCallback);
    }
  };

  if (azureutil.objectIsNull(options.transactionalContentMD5) && options.useTransactionalMD5) {
    if (!azureutil.objectIsNull(content)) {
      options.transactionalContentMD5 = azureutil.getContentMd5(content);
      startAppendBlock();
    } else {
      azureutil.calculateMD5(stream, length, options, function (internalBuff, contentMD5) {
        options.transactionalContentMD5 = contentMD5;
        content = internalBuff;
        length = internalBuff.length;
        startAppendBlock();
      });
    }
  } else {
    startAppendBlock();
  }

  return options.speedSummary;
};

/**
* Creates and dispatches lease requests.
* @ignore
*
* @this {BlobService}
* @param {object}             webResource                             The web resource.
* @param {string}             container                               The container name.
* @param {string}             blob                                    The blob name.
* @param {string}             leaseId                                 The lease identifier. Required to renew, change or release the lease.
* @param {string}             leaseAction                             The lease action (BlobConstants.LeaseOperation.*). Required.
* @param {object}             userOptions                             The request options.
* @param {int}                [userOptions.leaseBreakPeriod]          The lease break period.
* @param {string}             [userOptions.leaseDuration]             The lease duration. Default is never to expire.
* @param {string}             [userOptions.proposedLeaseId]           The proposed lease identifier. This is required for the CHANGE lease action.
* @param {LocationMode}       [userOptions.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                     Please see StorageUtilities.LocationMode for the possible values.
* @param {AccessConditions}   [options.accessConditions]              The access conditions.
* @param {int}                [userOptions.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]      The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [userOptions.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                     The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                     execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]               A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]             Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                     The default value is false.
* @param {Function(error, lease, response)}  callback                 `error` will contain information
*                                                                     if an error occurs; otherwise `lease` will contain
*                                                                     the lease information.
*                                                                     `response` will contain information related to this operation.
*/
BlobService.prototype._leaseImpl = function (container, blob, leaseId, leaseAction, options, callback) {
  var webResource;
  if (!azureutil.objectIsNull(blob)) {
    validate.validateArgs('_leaseImpl', function (v) {
      v.string(blob, 'blob');
    });
    var resourceName = createResourceName(container, blob);
    webResource = WebResource.put(resourceName);
  } else {
    webResource = WebResource.put(container)
      .withQueryOption(QueryStringConstants.RESTYPE, 'container');
  }

  webResource.withQueryOption(QueryStringConstants.COMP, 'lease')
    .withHeader(HeaderConstants.LEASE_ID, leaseId)
    .withHeader(HeaderConstants.LEASE_ACTION, leaseAction.toLowerCase())
    .withHeader(HeaderConstants.LEASE_BREAK_PERIOD, options.leaseBreakPeriod)
    .withHeader(HeaderConstants.PROPOSED_LEASE_ID, options.proposedLeaseId)
    .withHeader(HeaderConstants.LEASE_DURATION, options.leaseDuration);

  var processResponseCallback = function (responseObject, next) {
    responseObject.leaseResult = null;
    if (!responseObject.error) {
      responseObject.leaseResult = new LeaseResult(container, blob);
      responseObject.leaseResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.leaseResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Updates a page blob from text.
* @ignore
*
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             text                                        The text string.
* @param {Stream}             readStream                                  The read stream.
* @param {int}                rangeStart                                  The range start.
* @param {int}                rangeEnd                                    The range end.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.leaseId]                           The target blob lease identifier.
* @param {string}             [options.transactionalContentMD5]           An MD5 hash of the page content. This hash is used to verify the integrity of the page during transport.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {Function(error, pageBlob, response)}  callback                  `error` will contain information
*                                                                         if an error occurs; otherwise `pageBlob` will contain
*                                                                         the blob information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype._createPages = function (container, blob, text, readStream, rangeStart, rangeEnd, options, callback) {
  var request = this._updatePageBlobPagesImpl(container, blob, rangeStart, rangeEnd, BlobConstants.PageWriteOptions.UPDATE, options);

  // At this point, we have already validated that the range is less than 4MB. Therefore, we just need to calculate the contentMD5 if required.
  // Even when this is called from the createPagesFromStream method, it is pre-buffered and called with text.
  if (!azureutil.objectIsNull(text) && azureutil.objectIsNull(options.transactionalContentMD5) && options.useTransactionalMD5) {
    request.withHeader(HeaderConstants.CONTENT_MD5, azureutil.getContentMd5(text));
  }

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  if (!azureutil.objectIsNull(text)) {
    this.performRequest(request, text, options, processResponseCallback);
  } else {
    this.performRequestOutputStream(request, readStream, options, processResponseCallback);
  }
};

/**
* @ignore
*/
BlobService.prototype._updatePageBlobPagesImpl = function (container, blob, rangeStart, rangeEnd, writeMethod, options) {
  if (rangeStart && rangeStart % BlobConstants.PAGE_SIZE !== 0) {
    throw new RangeError(SR.INVALID_PAGE_START_OFFSET);
  }

  if (rangeEnd && (rangeEnd + 1) % BlobConstants.PAGE_SIZE !== 0) {
    throw new RangeError(SR.INVALID_PAGE_END_OFFSET);
  }

  // this is necessary if this is called from _uploadContentFromChunkStream->_createPages
  if (!options) {
    options = {};
  }

  options.rangeStart = rangeStart;
  options.rangeEnd = rangeEnd;

  options.contentLength = writeMethod === BlobConstants.PageWriteOptions.UPDATE ? (rangeEnd - rangeStart) + 1 : 0;

  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.put(resourceName)
    .withQueryOption(QueryStringConstants.COMP, 'page')
    .withHeader(HeaderConstants.CONTENT_TYPE, 'application/octet-stream')
    .withHeader(HeaderConstants.PAGE_WRITE, writeMethod);

  BlobResult.setHeadersFromBlob(webResource, options);

  return webResource;
};

/**
* Uploads blob content from a stream.
* For block blob, it creates a new block to be committed.
* For page blob, it writes a range of pages.
* For append blob, it appends a new block.
*
* @ignore
*
* @this {BlobService}
* @param {string}             container                                     The container name.
* @param {string}             blob                                          The blob name.
* @param {string}             blobType                                      The blob type.
* @param (Stream)             stream                                        Stream to the data to store.
* @param {int}                streamLength                                  The length of the stream to upload.
* @param {object|function}    [options]                                     The request options.
* @param {SpeedSummary}       [options.speedSummary]                        The download tracker objects;
* @param {int}                [options.parallelOperationThreadCount]        The number of parallel operations that may be performed when uploading.
* @param {bool}               [options.absorbConditionalErrorsOnRetry]      Specifies whether to absorb the conditional error on retry. (For append blob only)
* @param {int}                [options.maxBlobSize]                         The max length in bytes allowed for the append blob to grow to.
* @param {int}                [options.appendPosition]                      The number indicating the byte offset to check for. The append will succeed only if the end position of the blob is equal to this number.
* @param {bool}               [options.useTransactionalMD5]                 Calculate and send/validate content MD5 for transactions.
* @param {string}             [options.blockIdPrefix]                       The prefix to be used to generate the block id. (For block blob only)
* @param {int}                [options.blockSize]                           The size of each block. Maximum is 100MB. (For block blob only)
* @param {string}             [options.leaseId]                             The lease identifier.
* @param {object}             [options.metadata]                            The metadata key/value pairs.
* @param {bool}               [options.storeBlobContentMD5]                 Specifies whether the blob's ContentMD5 header should be set on uploads.
* @param {object}             [options.contentSettings]                     The content settings of the blob.
* @param {string}             [options.contentSettings.contentType]         The MIME content type of the blob. The default type is application/octet-stream.
* @param {string}             [options.contentSettings.contentEncoding]     The content encodings that have been applied to the blob.
* @param {string}             [options.contentSettings.contentLanguage]     The natural languages used by this resource.
* @param {string}             [options.contentSettings.cacheControl]        The Blob service stores this value but does not use or modify it.
* @param {string}             [options.contentSettings.contentDisposition]  The blob's content disposition.
* @param {string}             [options.contentSettings.contentMD5]          The blob's MD5 hash.
* @param {AccessConditions}   [options.accessConditions]                    The access conditions.
* @param {LocationMode}       [options.locationMode]                        Specifies the location mode used to decide which location the request should be sent to.
*                                                                           Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                 The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]            The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]            The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                           The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                           execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                     A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                   Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                           The default value is false.
* @param {function(error, null)}  callback                                  The callback function.
* @return {SpeedSummary}
*/

BlobService.prototype._uploadContentFromChunkStream = function (container, blob, blobType, chunkStream, streamLength, options, callback) {
  this.logger.debug(util.format('_uploadContentFromChunkStream for blob %s', blob));

  var apiName;
  var isBlockBlobUpload;
  var isPageBlobUpload;
  var isAppendBlobUpload;
  var sizeLimitation;
  var originalContentMD5 = azureutil.tryGetValueChain(options, ['contentSettings', 'contentMD5'], null);
  var parallelOperationThreadCount = options.parallelOperationThreadCount || this.parallelOperationThreadCount;

  if (blobType == BlobConstants.BlobTypes.BLOCK) {
    apiName = 'createBlockFromText';
    isBlockBlobUpload = true;

    // BlockBlob can only have 50000 blocks in maximum
    var minBlockSize = Math.ceil(streamLength / 50000);
    if (options.blockSize) {
      if (options.blockSize < minBlockSize) {
        // options.blockSize is less than the minBlockSize, error callback
        var error = new ArgumentError('options.blockSize', util.format('The minimum blockSize is %s and the provided blockSize %s is too small.', minBlockSize, options.blockSize));
        callback(error);
        return;
      } else {
        sizeLimitation = options.blockSize;
      }
    } else {
      // 4MB minimum for auto-calculated block size
      sizeLimitation = Math.max(minBlockSize, BlobConstants.DEFAULT_WRITE_BLOCK_SIZE_IN_BYTES);
    }
  } else if (blobType == BlobConstants.BlobTypes.PAGE) {
    apiName = '_createPages';
    isPageBlobUpload = true;
    sizeLimitation = BlobConstants.DEFAULT_WRITE_PAGE_SIZE_IN_BYTES;
  } else if (blobType == BlobConstants.BlobTypes.APPEND) {
    apiName = 'appendBlockFromText';
    isAppendBlobUpload = true;
    parallelOperationThreadCount = 1;
    sizeLimitation = BlobConstants.DEFAULT_WRITE_BLOCK_SIZE_IN_BYTES;
  } else {
    var error = new ArgumentError('blobType', util.format('Unknown blob type %s', blobType));
    callback(error);
    return;
  }

  chunkStream._highWaterMark = sizeLimitation;

  this._setOperationExpiryTime(options);

  // initialize the speed summary
  var speedSummary = options.speedSummary || new SpeedSummary(blob);
  speedSummary.totalSize = streamLength;

  // initialize chunk allocator
  var allocator = new ChunkAllocator(sizeLimitation, parallelOperationThreadCount, { logger: this.logger });
  chunkStream.setMemoryAllocator(allocator);
  chunkStream.setOutputLength(streamLength);

  // if this is a FileReadStream, set the allocator on that stream
  if (chunkStream._stream && chunkStream._stream.setMemoryAllocator) {
    var fileReadStreamAllocator = new ChunkAllocator(chunkStream._stream._highWaterMark, parallelOperationThreadCount, { logger: this.logger });
    chunkStream._stream.setMemoryAllocator(fileReadStreamAllocator);
  }

  // initialize batch operations
  var batchOperations = new BatchOperation(apiName, {
    callInOrder: isAppendBlobUpload,
    callbackInOrder: isAppendBlobUpload,
    logger: this.logger,
    enableReuseSocket: this.defaultEnableReuseSocket,
    operationMemoryUsage: sizeLimitation
  });
  batchOperations.setConcurrency(parallelOperationThreadCount);

  // initialize options
  var rangeOptions = {
    leaseId: options.leaseId,
    timeoutIntervalInMs: options.timeoutIntervalInMs,
    clientRequestTimeoutInMs: options.clientRequestTimeoutInMs,
    operationExpiryTime: options.operationExpiryTime,
    maxBlobSize: options.maxBlobSize,
    appendPosition: options.appendPosition || 0,
    initialAppendPosition: options.appendPosition || 0,
    absorbConditionalErrorsOnRetry: options.absorbConditionalErrorsOnRetry
  };

  // initialize block blob variables
  var blockIdPrefix = options.blockIdPrefix || this.generateBlockIdPrefix();
  var blockCount = 0;
  var blockIds = [];
  var blobResult = {};

  var self = this;
  chunkStream.on('data', function (data, range) {
    var operation = null;
    var full = false;
    var autoIncrement = speedSummary.getAutoIncrementFunction(data.length);

    if (data.length > sizeLimitation) {
      throw new RangeError(util.format(SR.EXCEEDED_SIZE_LIMITATION, sizeLimitation, data.length));
    }

    if (options.useTransactionalMD5) {
      //calculate content md5 for the current uploading block data
      var contentMD5 = azureutil.getContentMd5(data);
      rangeOptions.transactionalContentMD5 = contentMD5;
    }

    var checkLengthLimit = function () {
      if (!streamLength) return true;
      if (range.start >= streamLength) {
        self.logger.debug(util.format('Stop uploading data from %s bytes to %s bytes to blob %s because of limit %s', range.start, range.end, blob, streamLength));
        chunkStream.stop();
        return false;
      } else if (range.end >= streamLength) {
        self.logger.debug(util.format('Clip uploading data from %s bytes to %s bytes to blob %s because of limit %s', range.start, range.end, blob, streamLength));
        range.end = streamLength - 1;
        data = data.slice(0, streamLength - range.start);
        if (options.useTransactionalMD5) {
          rangeOptions.transactionalContentMD5 = azureutil.getContentMd5(data);
        }
      }
      return true;
    };

    var uploadBlockBlobChunk = function () {
      if (!checkLengthLimit()) return;
      var blockId = self.getBlockId(blockIdPrefix, blockCount);
      blockIds.push(blockId);

      operation = new BatchOperation.RestOperation(self, apiName, blockId, container, blob, data, rangeOptions, function (error) {
        if (!error) {
          autoIncrement();
        } else {
          self.logger.debug(util.format('Stop uploading data as error happens. Error: %s', util.inspect(error)));
          chunkStream.stop();
        }
        allocator.releaseBuffer(data);
        data = null;
      });

      blockCount++;
    };

    var uploadPageBlobChunk = function () {
      if (!checkLengthLimit()) return;

      if (azureutil.isBufferAllZero(data)) {
        self.logger.debug(util.format('Skip upload data from %s bytes to %s bytes to blob %s', range.start, range.end, blob));
        speedSummary.increment(data.length);
      } else {
        self.logger.debug(util.format('Upload data from %s bytes to %s bytes to blob %s', range.start, range.end, blob));
        operation = new BatchOperation.RestOperation(self, apiName, container, blob, data, null, range.start, range.end, rangeOptions, function (error) {
          if (!error) {
            autoIncrement();
          } else {
            self.logger.debug(util.format('Stop uploading data as error happens. Error: %s', util.inspect(error)));
            chunkStream.stop();
          }
          allocator.releaseBuffer(data);
          data = null;
        });
      }
    };

    var uploadAppendBlobChunk = function () {
      if (!checkLengthLimit()) return;

      rangeOptions.appendPosition = Number(rangeOptions.initialAppendPosition) + Number(range.start);

      // We cannot differentiate between max size condition failing only in the retry versus failing in the first attempt and retry.
      // So we will eliminate the latter and handle the former in the append operation callback.
      if (options.maxBlobSize && rangeOptions.appendPosition + data.length > options.maxBlobSize) {
        throw new Error(SR.MAX_BLOB_SIZE_CONDITION_NOT_MEET);
      }

      operation = new BatchOperation.RestOperation(self, apiName, container, blob, data, rangeOptions, function (error, currentBlob) {
        if (!error) {
          autoIncrement();
        } else {
          self.logger.debug(util.format('Stop uploading data as error happens. Error: %s', util.inspect(error)));
          chunkStream.stop();
        }
        blobResult = currentBlob;
        allocator.releaseBuffer(data);
        data = null;
      });
    };

    if (isBlockBlobUpload) {
      uploadBlockBlobChunk();
    } else if (isAppendBlobUpload) {
      uploadAppendBlobChunk();
    } else if (isPageBlobUpload) {
      uploadPageBlobChunk();
    }

    if (operation) {
      full = batchOperations.addOperation(operation);
      operation = null;

      if (full) {
        self.logger.debug('File stream paused');
        chunkStream.pause();
      }
    }
  });

  chunkStream.on('end', function () {
    self.logger.debug(util.format('File read stream ended for blob %s', blob));
    batchOperations.enableComplete();
  });

  batchOperations.on('drain', function () {
    self.logger.debug('file stream resume');
    chunkStream.resume();
  });

  batchOperations.on('end', function (error) {
    self.logger.debug('batch operations commited');

    speedSummary = null;
    if (error) {
      callback(error);
      return;
    }

    if (originalContentMD5) {
      options.contentSettings.contentMD5 = originalContentMD5;
    } else if (options.storeBlobContentMD5) {
      var contentMD5 = chunkStream.getContentMd5('base64');
      azureutil.setObjectInnerPropertyValue(options, ['contentSettings', 'contentMD5'], contentMD5);
    }

    if (isBlockBlobUpload) {
      //commit block list
      var blockList = { 'UncommittedBlocks': blockIds };
      self.commitBlocks(container, blob, blockList, options, function (error, blockList, response) {
        self.logger.debug(util.format('Blob %s committed', blob));

        if (error) {
          chunkStream.finish();

          callback(error);
        } else {
          blobResult['commmittedBlocks'] = blockIds;

          chunkStream.finish();
          callback(error, blobResult, response);
        }
      });
    } else {
      // upload page blob or append blob completely
      var blobProperties = options.contentSettings;
      self.setBlobProperties(container, blob, blobProperties, function (error, blob, response) {
        chunkStream.finish();
        blob = extend(false, blob, blobResult);
        callback(error, blob, response);
      });
    }
  });

  return speedSummary;
};

/**
* Checks whether or not a container exists on the service.
* @ignore
*
* @this {BlobService}
* @param {string}             container                                         The container name.
* @param {string}             primaryOnly                                       If true, the request will be executed against the primary storage location.
* @param {object}             [options]                                         The request options.
* @param {string}             [options.leaseId]                                 The lease identifier.
* @param {LocationMode}       [options.locationMode]                            Specifies the location mode used to decide which location the request should be sent to.
*                                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                     The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]                The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]                The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                         A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                       Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                               The default value is false.
* @param {Function(error, result, response)}  callback                          `error` will contain information
*                                                                               if an error occurs; otherwise `result` will contain
*                                                                               the container information including `exists` boolean member.
*                                                                               `response` will contain information related to this operation.
*/
BlobService.prototype._doesContainerExist = function (container, primaryOnly, options, callback) {
  var webResource = WebResource.head(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withHeader(HeaderConstants.LEASE_ID, options.leaseId);

  if (primaryOnly === false) {
    options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;
  }

  var processResponseCallback = function (responseObject, next) {
    responseObject.containerResult = new ContainerResult(container);
    if (!responseObject.error) {
      responseObject.containerResult.exists = true;
      responseObject.containerResult.getPropertiesFromHeaders(responseObject.response.headers);

    } else if (responseObject.error && responseObject.error.statusCode === Constants.HttpConstants.HttpResponseCodes.NotFound) {
      responseObject.error = null;
      responseObject.containerResult.exists = false;
      responseObject.response.isSuccessful = true;
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.containerResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Checks whether or not a blob exists on the service.
* @ignore
*
* @this {BlobService}
* @param {string}             container                                         The container name.
* @param {string}             blob                                              The blob name.
* @param {string}             primaryOnly                                       If true, the request will be executed against the primary storage location.
* @param {object}             [options]                                         The request options.
* @param {string}             [options.snapshotId]                              The snapshot identifier.
* @param {string}             [options.leaseId]                                 The lease identifier.
* @param {LocationMode}       [options.locationMode]                            Specifies the location mode used to decide which location the request should be sent to.
*                                                                               Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]                     The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]                The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]                The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                               The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                               execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                         A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                       Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                               The default value is false.
* @param {Function(error, result, response)}  callback                          `error` will contain information
*                                                                               if an error occurs; otherwise `result` will contain
*                                                                               the blob information including `exists` boolean member.
*                                                                               `response` will contain information related to this operation.
*/
BlobService.prototype._doesBlobExist = function (container, blob, primaryOnly, options, callback) {
  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.head(resourceName)
    .withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId)
    .withHeader(HeaderConstants.LEASE_ID, options.leaseId);

  if (primaryOnly === false) {
    options.requestLocationMode = RequestLocationMode.PRIMARY_OR_SECONDARY;
  }

  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = new BlobResult(container, blob);
    if (!responseObject.error) {
      responseObject.blobResult.exists = true;
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);

    } else if (responseObject.error && responseObject.error.statusCode === Constants.HttpConstants.HttpResponseCodes.NotFound) {
      responseObject.error = null;
      responseObject.blobResult.exists = false;
      responseObject.response.isSuccessful = true;
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* @ignore
*/
BlobService.prototype._setBlobPropertiesHelper = function (settings) {
  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;
    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(settings.container, settings.blob);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);
    }

    var finalCallback = function (returnObject) {
      settings.callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(settings.webResource, null, settings.options, processResponseCallback);
};

/**
* @ignore
*/
BlobService.prototype._validateLengthAndMD5 = function (options, responseObject) {
  var storedMD5 = responseObject.response.headers[Constants.HeaderConstants.CONTENT_MD5];
  var contentLength;

  if (!azureutil.objectIsNull(responseObject.response.headers[Constants.HeaderConstants.CONTENT_LENGTH])) {
    contentLength = parseInt(responseObject.response.headers[Constants.HeaderConstants.CONTENT_LENGTH], 10);
  }

  // If the user has not specified this option, the default value should be false.
  if (azureutil.objectIsNull(options.disableContentMD5Validation)) {
    options.disableContentMD5Validation = false;
  }

  // None of the below cases should be retried. So set the error in every case so the retry policy filter handle knows that it shouldn't be retried.
  if (options.disableContentMD5Validation === false && options.useTransactionalMD5 === true && azureutil.objectIsNull(storedMD5)) {
    responseObject.error = new StorageError(SR.MD5_NOT_PRESENT_ERROR);
    responseObject.retryable = false;
  }

  // Validate length and if required, MD5.
  // If getBlobToText called this method, then the responseObject.length and responseObject.contentMD5 are not set. Calculate them first using responseObject.response.body and then validate.
  if (azureutil.objectIsNull(responseObject.length)) {
    if (typeof responseObject.response.body == 'string') {
      responseObject.length = Buffer.byteLength(responseObject.response.body);
    } else if (Buffer.isBuffer(responseObject.response.body)) {
      responseObject.length = responseObject.response.body.length;
    }
  }

  if (!azureutil.objectIsNull(contentLength) && responseObject.length !== contentLength) {
    responseObject.error = new Error(SR.CONTENT_LENGTH_MISMATCH);
    responseObject.retryable = false;
  }

  if (options.disableContentMD5Validation === false && azureutil.objectIsNull(responseObject.contentMD5)) {
    responseObject.contentMD5 = azureutil.getContentMd5(responseObject.response.body);
  }

  if (options.disableContentMD5Validation === false && !azureutil.objectIsNull(storedMD5) && storedMD5 !== responseObject.contentMD5) {
    responseObject.error = new Error(util.format(SR.HASH_MISMATCH, storedMD5, responseObject.contentMD5));
    responseObject.retryable = false;
  }
};

/**
* @ignore
*/
BlobService.prototype._setRangeContentMD5Header = function (webResource, options) {
  if (!azureutil.objectIsNull(options.rangeStart) && options.useTransactionalMD5) {
    if (azureutil.objectIsNull(options.rangeEnd)) {
      throw new ArgumentNullError('options.rangeEndHeader', util.format(SR.ARGUMENT_NULL_OR_EMPTY, options.rangeEndHeader));
    }

    var size = parseInt(options.rangeEnd, 10) - parseInt(options.rangeStart, 10) + 1;
    if (size > BlobConstants.MAX_RANGE_GET_SIZE_WITH_MD5) {
      throw new ArgumentError('options', SR.INVALID_RANGE_FOR_MD5);
    } else {
      webResource.withHeader(HeaderConstants.RANGE_GET_CONTENT_MD5, 'true');
    }
  }
};

/**
* Downloads a blockblob, pageblob or appendblob into a range stream.
* @ignore
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {string}             blobType                                    The type of blob to download: block blob, page blob or append blob.
* @param {Stream}             writeStream                                 The write stream.
* @param {object}             [options]                                   The request options.
* @param {SpeedSummary}       [options.speedSummary]                      The download tracker objects.
* @param {int}                [options.parallelOperationThreadCount]      The number of parallel operations that may be performed when uploading.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {string}             [options.rangeStart]                        Return only the bytes of the blob in the specified range.
* @param {string}             [options.rangeEnd]                          Return only the bytes of the blob in the specified range.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {boolean}            [options.useTransactionalMD5]               When set to true, Calculate and send/validate content MD5 for transactions.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading blobs.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information if an error occurs;
*                                                                         otherwise `result` will contain the blob information.
*                                                                         `response` will contain information related to this operation.
* @return {SpeedSummary}
*/
BlobService.prototype._getBlobToRangeStream = function (container, blob, blobType, writeStream, optionsOrCallback, callback) {
  var options;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { options = o; callback = c; });

  validate.validateArgs('_getBlobToRangeStream', function (v) {
    v.string(container, 'container');
    v.string(blob, 'blob');
    v.containerNameIsValid(container);
    v.blobNameIsValid(container, blob);
    v.blobTypeIsValid(blobType);
    v.callback(callback);
  });

  var rangeStream = null;
  var isPageBlobDownload = true;

  if (blobType == BlobConstants.BlobTypes.PAGE) {
    rangeStream = new PageRangeStream(this, container, blob, options);
  } else if (blobType == BlobConstants.BlobTypes.APPEND) {
    rangeStream = new RangeStream(this, container, blob, options);
    isPageBlobDownload = false;
  } else if (blobType == BlobConstants.BlobTypes.BLOCK) {
    rangeStream = new BlockRangeStream(this, container, blob, options);
    isPageBlobDownload = false;
  }

  if (!options.speedSummary) {
    options.speedSummary = new SpeedSummary(blob);
  }

  var speedSummary = options.speedSummary;
  var parallelOperationThreadCount = options.parallelOperationThreadCount || this.parallelOperationThreadCount;
  var batchOperations = new BatchOperation('getBlobInRanges', { callbackInOrder: true, logger: this.logger, enableReuseSocket: this.defaultEnableReuseSocket });
  batchOperations.setConcurrency(parallelOperationThreadCount);

  var self = this;
  var checkMD5sum = !options.disableContentMD5Validation;
  var md5Hash = null;
  if (checkMD5sum) {
    md5Hash = new Md5Wrapper().createMd5Hash();
  }

  var savedBlobResult = null;
  var savedBlobResponse = null;

  rangeStream.on('range', function (range) {
    if (!speedSummary.totalSize) {
      speedSummary.totalSize = rangeStream.rangeSize;
    }

    var requestOptions = {
      rangeStart: range.start,
      rangeEnd: range.end,
      responseEncoding: null //Use Buffer to store the response data
    };

    var rangeSize = range.size;
    requestOptions.timeoutIntervalInMs = options.timeoutIntervalInMs;
    requestOptions.clientRequestTimeoutInMs = options.clientRequestTimeoutInMs;
    requestOptions.useTransactionalMD5 = options.useTransactionalMD5;

    if (range.dataSize === 0) {
      if (isPageBlobDownload) {
        var autoIncrement = speedSummary.getAutoIncrementFunction(rangeSize);
        //No operation to do and only wait for write zero to file in callback
        var writeZeroOperation = new BatchOperation.CommonOperation(BatchOperation.noOperation, function (error) {
          if (error) return;
          var bufferAvailable = azureutil.writeZerosToStream(writeStream, rangeSize, md5Hash, autoIncrement);
          //There is no need to pause the rangestream since we can perform http request and write disk at the same time
          self.logger.debug(util.format('Write %s bytes Zero from %s to %s', rangeSize, range.start, range.end));
          if (!bufferAvailable) {
            self.logger.debug('Write stream is full and pause batch operation');
            batchOperations.pause();
          }
        });
        batchOperations.addOperation(writeZeroOperation);
      } else {
        self.logger.debug(util.format('Can not read %s bytes to %s bytes of blob %s', range.start, range.end, blob));
      }
      return;
    }

    if (range.start > range.end) {
      return;
    }

    var operation = new BatchOperation.RestOperation(self, 'getBlobToText', container, blob, requestOptions, function (error, content, blobResult, response) {
      if (!error) {
        if (rangeSize !== content.length) {
          self.logger.warn(util.format('Request %s bytes, but server returns %s bytes', rangeSize, content.length));
        }
        //Save one of the succeeded callback parameters and use them at the final callback
        if (!savedBlobResult) {
          savedBlobResult = blobResult;
        }
        if (!savedBlobResponse) {
          savedBlobResponse = response;
        }
        var autoIncrement = speedSummary.getAutoIncrementFunction(content.length);
        var bufferAvailable = writeStream.write(content, autoIncrement);
        if (!bufferAvailable) {
          self.logger.debug('Write stream is full and pause batch operation');
          batchOperations.pause();
        }
        if (md5Hash) {
          md5Hash.update(content);
        }
        content = null;
      } else {
        self.logger.debug(util.format('Stop downloading data as error happens. Error: %s', util.inspect(error)));
        rangeStream.stop();
      }
    });

    var full = batchOperations.addOperation(operation);
    if (full) {
      self.logger.debug('Pause range stream');
      rangeStream.pause();
    }
  });

  rangeStream.on('end', function () {
    self.logger.debug('Range stream has ended.');
    batchOperations.enableComplete();
  });

  batchOperations.on('drain', function () {
    self.logger.debug('Resume range stream');
    rangeStream.resume();
  });

  writeStream.on('drain', function () {
    self.logger.debug('Resume batch operations');
    batchOperations.resume();
  });

  batchOperations.on('end', function (error) {
    self.logger.debug('Download completed!');
    if (error) {
      callback(error);
      return;
    } else {
      writeStream.end(function () {
        self.logger.debug('Write stream has ended');
        if (writeStream.close) {
          writeStream.close();
        }
        if (!savedBlobResult) {
          savedBlobResult = {};
        }

        azureutil.setObjectInnerPropertyValue(savedBlobResult, ['contentSettings', 'contentMD5'], azureutil.tryGetValueChain(options, ['contentSettings', 'contentMD5'], null));
        savedBlobResult.clientSideContentMD5 = null;
        if (md5Hash) {
          savedBlobResult.clientSideContentMD5 = md5Hash.digest('base64');
        }
        callback(error, savedBlobResult, savedBlobResponse);
      });
    }
  });

  var listOptions = {
    timeoutIntervalInMs: options.timeoutIntervalInMs,
    clientRequestTimeoutInMs: options.clientRequestTimeoutInMs,
    snapshotId: options.snapshotId,
    leaseId: options.leaseId,
    blockListFilter: BlobUtilities.BlockListFilter.COMMITTED
  };

  rangeStream.list(listOptions, function (error) {
    callback(error);
  });

  return speedSummary;
};

/**
* Downloads a blockblob or pageblob into a stream.
* @ignore
* @this {BlobService}
* @param {string}             container                                   The container name.
* @param {string}             blob                                        The blob name.
* @param {Stream}             writeStream                                 The write stream.
* @param {object}             [options]                                   The request options.
* @param {string}             [options.snapshotId]                        The snapshot identifier.
* @param {string}             [options.leaseId]                           The lease identifier.
* @param {string}             [options.rangeStart]                        Return only the bytes of the blob in the specified range.
* @param {string}             [options.rangeEnd]                          Return only the bytes of the blob in the specified range.
* @param {AccessConditions}   [options.accessConditions]                  The access conditions.
* @param {boolean}            [options.useTransactionalMD5]               When set to true, Calculate and send/validate content MD5 for transactions.
* @param {boolean}            [options.disableContentMD5Validation]       When set to true, MD5 validation will be disabled when downloading blobs.
* @param {LocationMode}       [options.locationMode]                      Specifies the location mode used to decide which location the request should be sent to.
*                                                                         Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]               The timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]          The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]          The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                         The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                         execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]                   A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]                 Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                         The default value is false.
* @param {errorOrResult}      callback                                    `error` will contain information if an error occurs;
*                                                                         otherwise `result` will contain the blob information.
*                                                                         `response` will contain information related to this operation.
*/
BlobService.prototype._getBlobToStream = function (container, blob, writeStream, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  var resourceName = createResourceName(container, blob);
  var webResource = WebResource.get(resourceName).withRawResponse();

  var options = extend(true, {}, userOptions);
  webResource.withQueryOption(QueryStringConstants.SNAPSHOT, options.snapshotId);

  BlobResult.setHeadersFromBlob(webResource, options);

  this._setRangeContentMD5Header(webResource, options);

  var self = this;
  var processResponseCallback = function (responseObject, next) {
    responseObject.blobResult = null;

    if (!responseObject.error) {
      responseObject.blobResult = new BlobResult(container, blob);
      responseObject.blobResult.metadata = self.parseMetadataHeaders(responseObject.response.headers);
      responseObject.blobResult.getPropertiesFromHeaders(responseObject.response.headers);

      self._validateLengthAndMD5(options, responseObject);
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.blobResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequestInputStream(webResource, null, writeStream, options, processResponseCallback);
};

/**
* Lists a segment containing a collection of blob items whose names begin with the specified prefix in the container.
* @ignore
* @this {BlobService}
* @param {string}             container                           The container name.
* @param {string}             prefix                              The prefix of the blob name.
* @param {object}             currentToken                        A continuation token returned by a previous listing operation. Please use 'null' or 'undefined' if this is the first operation.
* @param {ListBlobTypes}      listBlobType                        Specifies the item type of the results.
* @param {object}             [options]                           The request options.
* @param {int}                [options.maxResults]                Specifies the maximum number of blobs to return per call to Azure ServiceClient. This does NOT affect list size returned by this function. (maximum: 5000)
* @param {string}             [options.include]                   Specifies that the response should include one or more of the following subsets: '', 'metadata', 'snapshots', 'uncommittedblobs', 'copy').
*                                                                 Please find these values in BlobUtilities.BlobListingDetails. Multiple values can be added separated with a comma (,).
* @param {LocationMode}       [options.locationMode]              Specifies the location mode used to decide which location the request should be sent to.
*                                                                 Please see StorageUtilities.LocationMode for the possible values.
* @param {int}                [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
* @param {int}                [options.clientRequestTimeoutInMs]  The timeout of client requests, in milliseconds, to use for the request.
* @param {int}                [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
*                                                                 The maximum execution time interval begins at the time that the client begins building the request. The maximum
*                                                                 execution time is checked intermittently while performing requests, and before executing retries.
* @param {string}             [options.clientRequestId]           A string that represents the client request ID with a 1KB character limit.
* @param {bool}               [options.useNagleAlgorithm]         Determines whether the Nagle algorithm is used; true to use the Nagle algorithm; otherwise, false.
*                                                                 The default value is false.
* @param {errorOrResult}      callback                            `error` will contain information
*                                                                 if an error occurs; otherwise `result` will contain
*                                                                 the entries of blobs and the continuation token for the next listing operation.
*                                                                 `response` will contain information related to this operation.
*/
BlobService.prototype._listBlobsOrDircotriesSegmentedWithPrefix = function (container, prefix, currentToken, listBlobType, optionsOrCallback, callback) {
  var userOptions;
  azureutil.normalizeArgs(optionsOrCallback, callback, function (o, c) { userOptions = o; callback = c; });

  validate.validateArgs('listBlobsSegmented', function (v) {
    v.string(container, 'container');
    v.containerNameIsValid(container);
    v.callback(callback);
  });

  var options = extend(true, {}, userOptions);
  var webResource = WebResource.get(container)
    .withQueryOption(QueryStringConstants.RESTYPE, 'container')
    .withQueryOption(QueryStringConstants.COMP, 'list')
    .withQueryOption(QueryStringConstants.MAX_RESULTS, options.maxResults)
    .withQueryOptions(options,
    QueryStringConstants.DELIMITER,
    QueryStringConstants.INCLUDE);

  if (!azureutil.objectIsNull(currentToken)) {
    webResource.withQueryOption(QueryStringConstants.MARKER, currentToken.nextMarker);
  }

  webResource.withQueryOption(QueryStringConstants.PREFIX, prefix);

  options.requestLocationMode = azureutil.getNextListingLocationMode(currentToken);

  var processResponseCallback = function (responseObject, next) {
    responseObject.listBlobsResult = null;
    if (!responseObject.error) {
      responseObject.listBlobsResult = {
        entries: null,
        continuationToken: null
      };

      responseObject.listBlobsResult.entries = [];
      var results = [];

      if (listBlobType == BlobConstants.ListBlobTypes.Directory && responseObject.response.body.EnumerationResults.Blobs.BlobPrefix) {
        results = responseObject.response.body.EnumerationResults.Blobs.BlobPrefix;
        if (!_.isArray(results)) {
          results = [results];
        }
      } else if (listBlobType == BlobConstants.ListBlobTypes.Blob && responseObject.response.body.EnumerationResults.Blobs.Blob) {
        results = responseObject.response.body.EnumerationResults.Blobs.Blob;
        if (!_.isArray(results)) {
          results = [results];
        }
      }

      results.forEach(function (currentBlob) {
        var blobResult = BlobResult.parse(currentBlob);
        responseObject.listBlobsResult.entries.push(blobResult);
      });

      if (responseObject.response.body.EnumerationResults.NextMarker) {
        responseObject.listBlobsResult.continuationToken = {
          nextMarker: null,
          targetLocation: null
        };

        responseObject.listBlobsResult.continuationToken.nextMarker = responseObject.response.body.EnumerationResults.NextMarker;
        responseObject.listBlobsResult.continuationToken.targetLocation = responseObject.targetLocation;
      }
    }

    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.listBlobsResult, returnObject.response);
    };

    next(responseObject, finalCallback);
  };

  this.performRequest(webResource, null, options, processResponseCallback);
};

/**
* Create a new blob.
* @ignore
*
* @this {BlobService}
* @param {string}             container                                The container name.
* @param {string}             blob                                     The blob name.
* @param {BlobType}           blobType                                 The blob type.
* @param {int}                size                                     The blob size.
* @param {object}             [options]                                The request options.
* @param {string}             [options.blobTier]                       For page blobs on premium accounts only. Set the tier of the target blob. Refer to BlobUtilities.BlobTier.PremiumPageBlobTier.
* @param {errorOrResult}      callback                                 The callback which operates on the specific blob.
*/
BlobService.prototype._createBlob = function (container, blob, blobType, size, options, creationCallback) {
  if (blobType == BlobConstants.BlobTypes.APPEND) {
    this.createOrReplaceAppendBlob(container, blob, options, function (createError, createResponse) {
      creationCallback(createError, null, createResponse);
    });
  } else if (blobType == BlobConstants.BlobTypes.PAGE) {
    this.createPageBlob(container, blob, size, options, function (createError) {
      creationCallback(createError);
    });
  } else if (blobType == BlobConstants.BlobTypes.BLOCK) {
    creationCallback();
  }
};

/**
* The callback for {BlobService~getBlobToText}.
* @typedef {function} BlobService~blobToText
* @param {object} error      If an error occurs, the error information.
* @param {string} text       The text returned from the blob.
* @param {object} blockBlob  Information about the blob.
* @param {object} response   Information related to this operation.
*/

BlobService.SpeedSummary = SpeedSummary;

module.exports = BlobService;

}).call(this,require("buffer").Buffer)
},{"../../common/errors/errors":8,"./../../common/common.core":6,"./../../common/md5-wrapper":13,"./../../common/streams/rangestream":30,"./blobutilities":43,"./internal/blockrangestream":44,"./internal/pagerangestream":45,"./models/blobresult":46,"./models/blocklistresult":47,"./models/containerresult":48,"./models/leaseresult":49,"buffer":"buffer","extend":158,"querystring":208,"underscore":249,"url":250,"util":"util"}],49:[function(require,module,exports){
//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

// Module dependencies.
var Constants = require('./../../../common/common.core').Constants;
var HeaderConstants = Constants.HeaderConstants;


/**
* Creates a new LeaseResult object.
* @class
* The LeaseResult class is used to store the lease information.
*
 * @property  {string}                      container                         The container name.
 * @property  {string}                      blob                              The blob name.
 * @property  {string}                      id                                The lease id.
 * @property  {string}                      time                              Approximate time remaining in the lease period, in seconds.
 * @property  {string}                      etag                              The etag.
 * @property  {string}                      lastModified                      The date/time that the lease was last modified.
 *
* @constructor
* @param {string} [container]               The container name.
* @param {string} [blob]                    The blob name.
* @param {string} [id]                      The lease id.
* @param {string} [time]                    Approximate time remaining in the lease period, in seconds.
*/
function LeaseResult(container, blob, id, time) {
  if (container) {
    this.container = container;
  }

  if (blob) {
    this.blob = blob;
  }

  if (id) {
    this.id = id;
  }

  if (time) {
    this.time = time;
  }
}

LeaseResult.prototype.getPropertiesFromHeaders = function (headers) {
  var self = this;

  if (!self['id'] && headers[HeaderConstants.LEASE_ID]) {
    self['id'] = headers[HeaderConstants.LEASE_ID];
  }

  if (!self['time'] && headers[HeaderConstants.LEASE_TIME]) {
    self['time'] = parseInt(headers[HeaderConstants.LEASE_TIME], 10);
  }

  self['etag'] = headers[HeaderConstants.ETAG];
  self['lastModified'] = headers[HeaderConstants.LAST_MODIFIED.toLowerCase()];
};

module.exports = LeaseResult;
},{"./../../../common/common.core":6}],48:[function(require,module,exports){
//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

// Module dependencies.
var azureCommon = require('./../../../common/common.core');
var azureutil = azureCommon.util;
var Constants = azureCommon.Constants;

var HeaderConstants = Constants.HeaderConstants;
var BlobUtilities = require('../blobutilities');

/**
* Creates a new ContainerResult object.
* @class
* The ContainerResult class is used to store the container information.
*
 * @property  {string}                      name                                  The container name.
 * @property  {string}                      publicAccessLevel                     The public access level.
 * @property  {object}                      metadata                              The metadata key/value pair.
 * @property  {string}                      etag                                  The etag.
 * @property  {string}                      lastModified                          The date/time that the container was last modified.
 * @property  {string}                      requestId                             The request id.
 * @property  {object}                      lease                                 The lease information.
 * @property  {string}                      lease.status                          The lease status.
 * @property  {string}                      lease.state                           The lease state.
 * @property  {string}                      lease.duration                        The lease duration.
 *
* @constructor
* @param {string} [container]               The container name.
* @param {string} [publicAccessLevel]       The public access level.
*/
function ContainerResult(name, publicAccessLevel) {
  if (name) {
    this.name = name;
  }

  if (publicAccessLevel) {
    this.publicAccessLevel = publicAccessLevel;
  }
}

ContainerResult.parse = function (containerXml) {
  var containerResult = new ContainerResult();

  for (var propertyName in containerXml) {
    if (containerXml.hasOwnProperty(propertyName)) {
      if (propertyName === 'Properties') {
        //  Lift out the properties onto the main object to keep consistent across all APIs like: getContainerProperties
        azureutil.setPropertyValueFromXML(containerResult, containerXml[propertyName], true);
      } else if (propertyName === 'Metadata') {
        var resultPropertyName = azureutil.normalizePropertyNameFromXML(propertyName);
        containerResult[resultPropertyName] = {};
        azureutil.setPropertyValueFromXML(containerResult[resultPropertyName], containerXml[propertyName], false);
      } else {
        containerResult[propertyName.toLowerCase()] = containerXml[propertyName];
      }
    }
  }

  if (!containerResult.publicAccessLevel) {
    containerResult.publicAccessLevel = BlobUtilities.BlobContainerPublicAccessType.OFF;
  }

  return containerResult;
};

ContainerResult.prototype.getPropertiesFromHeaders = function (headers) {
  var self = this;

  var setContainerPropertyFromHeaders = function (containerProperty, headerProperty) {
    if (!azureutil.tryGetValueChain(self, containerProperty.split('.'), null) && headers[headerProperty.toLowerCase()]) {
      azureutil.setObjectInnerPropertyValue(self, containerProperty.split('.'), headers[headerProperty.toLowerCase()]);
    }
  };

  setContainerPropertyFromHeaders('etag', HeaderConstants.ETAG);
  setContainerPropertyFromHeaders('lastModified', HeaderConstants.LAST_MODIFIED);
  setContainerPropertyFromHeaders('lease.status', HeaderConstants.LEASE_STATUS);
  setContainerPropertyFromHeaders('lease.state', HeaderConstants.LEASE_STATE);
  setContainerPropertyFromHeaders('lease.duration', HeaderConstants.LEASE_DURATION);
  setContainerPropertyFromHeaders('requestId', HeaderConstants.REQUEST_ID);

  if (!self.publicAccessLevel) {
    self.publicAccessLevel = BlobUtilities.BlobContainerPublicAccessType.OFF;
    if (headers[HeaderConstants.BLOB_PUBLIC_ACCESS]) {
      self.publicAccessLevel = headers[HeaderConstants.BLOB_PUBLIC_ACCESS];
    }
  }

  if (self.publicAccessLevel === 'true') {
    // The container was marked for full public read access using a version prior to 2009-09-19.
    self.publicAccessLevel = BlobUtilities.BlobContainerPublicAccessType.CONTAINER;
  }
};

/**
* The container ACL settings.
* @typedef    {object}                        ContainerAclResult
* @extends    {ContainerResult}
* @property   {Object.<string, AccessPolicy>}    signedIdentifiers   The container ACL settings. See `[AccessPolicy]{@link AccessPolicy}` for detailed information.
*/

module.exports = ContainerResult;
},{"../blobutilities":43,"./../../../common/common.core":6}],47:[function(require,module,exports){
(function (Buffer){
//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

// Module dependencies.
var _ = require('underscore');

var azureCommon = require('./../../../common/common.core');
var xmlbuilder = azureCommon.xmlbuilder;
var Constants = azureCommon.Constants;

/**
* Builds an XML representation for a block list.
*
* @param  {array}  The block list.
* @return {string} The XML block list.
*/
exports.serialize = function (blockListJs) {
  var blockListDoc = xmlbuilder.create();
  blockListDoc = blockListDoc.begin(Constants.BlobConstants.BLOCK_LIST_ELEMENT, { version: '1.0', encoding: 'utf-8' });

  if (_.isArray(blockListJs.LatestBlocks)) {
    blockListJs.LatestBlocks.forEach(function (block) {
      blockListDoc = blockListDoc.ele(Constants.BlobConstants.LATEST_ELEMENT)
        .txt(new Buffer(block).toString('base64'))
        .up();
    });
  }

  if (_.isArray(blockListJs.CommittedBlocks)) {
    blockListJs.CommittedBlocks.forEach(function (block) {
      blockListDoc = blockListDoc.ele(Constants.BlobConstants.COMMITTED_ELEMENT)
        .txt(new Buffer(block).toString('base64'))
        .up();
    });
  }

  if (_.isArray(blockListJs.UncommittedBlocks)) {
    blockListJs.UncommittedBlocks.forEach(function (block) {
      blockListDoc = blockListDoc.ele(Constants.BlobConstants.UNCOMMITTED_ELEMENT)
        .txt(new Buffer(block).toString('base64'))
        .up();
    });
  }

  return blockListDoc.doc().toString();
};

exports.parse = function (blockListXml) {
  var blockListResult = {};

  if (blockListXml.CommittedBlocks && blockListXml.CommittedBlocks.Block) {
    blockListResult.CommittedBlocks = blockListXml.CommittedBlocks.Block;
    if (!_.isArray(blockListResult.CommittedBlocks)) {
      blockListResult.CommittedBlocks = [blockListResult.CommittedBlocks];
    }
    blockListResult.CommittedBlocks.forEach(function(block) {
      block.Name = new Buffer(block.Name, 'base64').toString();
    });
  }

  if (blockListXml.UncommittedBlocks && blockListXml.UncommittedBlocks.Block) {
    blockListResult.UncommittedBlocks = blockListXml.UncommittedBlocks.Block;
    if (!_.isArray(blockListResult.UncommittedBlocks)) {
      blockListResult.UncommittedBlocks = [blockListResult.UncommittedBlocks];
    }
    blockListResult.UncommittedBlocks.forEach(function(block) {
      block.Name = new Buffer(block.Name, 'base64').toString();
    });
  }

  return blockListResult;
};
}).call(this,require("buffer").Buffer)
},{"./../../../common/common.core":6,"buffer":"buffer","underscore":249}],46:[function(require,module,exports){
//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

// Module dependencies.
var _ = require('underscore');

var azureCommon = require('./../../../common/common.core');
var azureutil = azureCommon.util;
var Constants = azureCommon.Constants;
var HeaderConstants = Constants.HeaderConstants;

/**
* Creates a new BlobResult object.
* @class
* The BlobResult class is used to store the blob information.
*
 * @property  {string}                      container                             The container name.
 * @property  {string}                      name                                  The blob name.
 * @property  {object}                      metadata                              The metadata key/value pair.
 * @property  {string}                      etag                                  The etag.
 * @property  {string}                      lastModified                          The date/time that the blob was last modified.
 * @property  {string}                      contentLength                         The size of the blob in bytes.
 * @property  {string}                      blobType                              The blob type.
 * @property  {boolean}                     isIncrementalCopy                     If the blob is incremental copy blob.
 * @property  {string}                      requestId                             The request id.
 * @property  {string}                      sequenceNumber                        The current sequence number for a page blob.
 * @property  {string}                      contentRange                          The content range.
 * @property  {string}                      committedBlockCount                   The committed block count.
 * @property  {string}                      serverEncrypted                       If the blob data and application metadata are completely encrypted using the specified algorithm. true/false.
 * @property  {object}                      contentSettings                       The content settings.
 * @property  {string}                      contentSettings.contentType           The content type.
 * @property  {string}                      contentSettings.contentEncoding       The content encoding.
 * @property  {string}                      contentSettings.contentLanguage       The content language.
 * @property  {string}                      contentSettings.cacheControl          The cache control.
 * @property  {string}                      contentSettings.contentDisposition    The content disposition.
 * @property  {string}                      contentSettings.contentMD5            The content MD5 hash.
 * @property  {object}                      lease                                 The lease information.
 * @property  {string}                      lease.id                              The lease id.
 * @property  {string}                      lease.status                          The lease status.
 * @property  {string}                      lease.state                           The lease state.
 * @property  {string}                      lease.duration                        The lease duration.
 * @property  {object}                      copy                                  The copy information.
 * @property  {string}                      copy.id                               The copy id.
 * @property  {string}                      copy.status                           The copy status.
 * @property  {string}                      copy.completionTime                   The copy completion time.
 * @property  {string}                      copy.statusDescription                The copy status description.
 * @property  {string}                      copy.destinationSnapshot              The snapshot time of the last successful incremental copy snapshot for this blob.
 * @property  {string}                      copy.progress                         The copy progress.
 * @property  {string}                      copy.source                           The copy source.
 *
* @constructor
* @param {string} [container]  The container name.
* @param {string} [name]       The blob name.
*/
function BlobResult(container, name) {
  if (container) {
    this.container = container;
  }

  if (name) {
    this.name = name;
  }
}

BlobResult.parse = function (blobXml) {
  var blobResult = new BlobResult();

  for (var propertyName in blobXml) {
    if (blobXml.hasOwnProperty(propertyName)) {
      if (propertyName === 'Properties') {
        //  Lift out the properties onto the main object to keep consistent across all APIs like: getBlobProperties
        azureutil.setPropertyValueFromXML(blobResult, blobXml[propertyName], true);
      } else if (propertyName === 'Metadata') {
        var resultPropertyName = azureutil.normalizePropertyNameFromXML(propertyName);
        blobResult[resultPropertyName] = {};
        azureutil.setPropertyValueFromXML(blobResult[resultPropertyName], blobXml[propertyName], false);
      } else {
        blobResult[propertyName.toLowerCase()] = blobXml[propertyName];
      }
    }
  }

  // convert isIncrementalCopy to boolean type
  if (blobResult.isIncrementalCopy !== undefined) {
    blobResult.isIncrementalCopy = (blobResult.isIncrementalCopy === 'true');
  }

  return blobResult;
};

var headersForProperties = {
  'lastModified': 'LAST_MODIFIED',
  'etag': 'ETAG',
  'sequenceNumber': 'SEQUENCE_NUMBER',
  'blobType': 'BLOB_TYPE',
  'contentLength': 'CONTENT_LENGTH',
  'blobContentLength': 'BLOB_CONTENT_LENGTH',
  'contentRange': 'CONTENT_RANGE',
  'committedBlockCount': 'BLOB_COMMITTED_BLOCK_COUNT',
  'serverEncrypted': 'SERVER_ENCRYPTED',
  'requestId': 'REQUEST_ID',

  'range': 'RANGE',
  'blobRange': 'STORAGE_RANGE',
  'getContentMd5': 'RANGE_GET_CONTENT_MD5',
  'acceptRanges': 'ACCEPT_RANGES',
  'appendOffset': 'BLOB_APPEND_OFFSET',

  'accessTier': 'ACCESS_TIER',
  'accessTierInferred': 'ACCESS_TIER_INFERRED',
  'archiveStatus': 'ARCHIVE_STATUS',

  'isIncrementalCopy': 'INCREMENTAL_COPY',

  // ContentSettings
  'contentSettings.contentType': 'CONTENT_TYPE',
  'contentSettings.contentEncoding': 'CONTENT_ENCODING',
  'contentSettings.contentLanguage': 'CONTENT_LANGUAGE',
  'contentSettings.cacheControl': 'CACHE_CONTROL',
  'contentSettings.contentDisposition': 'CONTENT_DISPOSITION',
  'contentSettings.contentMD5': 'CONTENT_MD5',

  // Lease
  'lease.id': 'LEASE_ID',
  'lease.status': 'LEASE_STATUS',
  'lease.duration': 'LEASE_DURATION',
  'lease.state': 'LEASE_STATE',

  // Copy
  'copy.id': 'COPY_ID',
  'copy.status': 'COPY_STATUS',
  'copy.source': 'COPY_SOURCE',
  'copy.progress': 'COPY_PROGRESS',
  'copy.completionTime': 'COPY_COMPLETION_TIME',
  'copy.statusDescription': 'COPY_STATUS_DESCRIPTION',
  'copy.destinationSnapshot': 'COPY_DESTINATION_SNAPSHOT'
};

BlobResult.prototype.getPropertiesFromHeaders = function (headers) {
  var self = this;

  var setBlobPropertyFromHeaders = function (blobProperty, headerProperty) {
    if (!azureutil.tryGetValueChain(self, blobProperty.split('.'), null) && headers[headerProperty.toLowerCase()]) {
      azureutil.setObjectInnerPropertyValue(self, blobProperty.split('.'), headers[headerProperty.toLowerCase()]);

      if (blobProperty === 'copy.progress') {
        var info = azureutil.parseCopyProgress(self.copy.progress);
        self.copy.bytesCopied = parseInt(info.bytesCopied);
        self.copy.totalBytes = parseInt(info.totalBytes);
      }
    }
  };

  // For range get, 'x-ms-blob-content-md5' indicate the overall MD5 of the blob. Try to set the contentMD5 using this header if it presents
  setBlobPropertyFromHeaders('contentSettings.contentMD5', HeaderConstants.BLOB_CONTENT_MD5);

  _.chain(headersForProperties).pairs().each(function (pair) {
    var property = pair[0];
    var header = HeaderConstants[pair[1]];
    setBlobPropertyFromHeaders(property, header);
  });

  // convert isIncrementalCopy to boolean type
  if (self.isIncrementalCopy !== undefined) {
    self.isIncrementalCopy = (self.isIncrementalCopy === 'true');
  }

  // convert accessTierInferred to boolean type
  if (self.accessTierInferred !== undefined) {
    self.accessTierInferred = (self.accessTierInferred == 'true');
  }
};

/**
* This method sets the HTTP headers and is used by all methods except setBlobProperties and commitBlocks. Those 2 methods will set the x-ms-* headers using setPropertiesFromBlob.
* @ignore
*/
BlobResult.setHeadersFromBlob = function (webResource, blob) {
  var setHeaderPropertyFromBlob = function (headerProperty, blobProperty) {
    var blobPropertyValue = azureutil.tryGetValueChain(blob, blobProperty.split('.'), null);
    if (blobPropertyValue) {
      webResource.withHeader(headerProperty, blobPropertyValue);
    }
  };

  if (blob) {
    // Content-Type
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CONTENT_TYPE, 'contentSettings.contentType');

    // Content-Encoding
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CONTENT_ENCODING, 'contentSettings.contentEncoding');

    // Content-Language
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CONTENT_LANGUAGE, 'contentSettings.contentLanguage');

    // Content-Disposition
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CONTENT_DISPOSITION, 'contentSettings.contentDisposition');

    // Cache-Control
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CACHE_CONTROL, 'contentSettings.cacheControl');

    // Blob's Content-MD5
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CONTENT_MD5, 'contentSettings.contentMD5');

    // Content-Length
    setHeaderPropertyFromBlob(HeaderConstants.CONTENT_LENGTH, 'contentLength');

    // transactional Content-MD5
    setHeaderPropertyFromBlob(HeaderConstants.CONTENT_MD5, 'transactionalContentMD5');

    // Range
    if (!azureutil.objectIsNull(blob.rangeStart)) {
      var range = 'bytes=' + blob.rangeStart + '-';

      if (!azureutil.objectIsNull(blob.rangeEnd)) {
        range += blob.rangeEnd;
      }

      webResource.withHeader(HeaderConstants.RANGE, range);
    }

    // Blob Type
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_TYPE, 'blobType');

    // Lease id
    setHeaderPropertyFromBlob(HeaderConstants.LEASE_ID, 'leaseId');

    // Sequence number
    setHeaderPropertyFromBlob(HeaderConstants.SEQUENCE_NUMBER, 'sequenceNumber');
    setHeaderPropertyFromBlob(HeaderConstants.SEQUENCE_NUMBER_ACTION, 'sequenceNumberAction');

    if (blob.metadata) {
      webResource.addOptionalMetadataHeaders(blob.metadata);
    }
  }
};

/**
* This method sets the x-ms-* headers and is used by setBlobProperties and commitBlocks. All other methods will set the regular HTTP headers using setHeadersFromBlob.
* @ignore
*/
BlobResult.setPropertiesFromBlob = function (webResource, blob) {
  var setHeaderPropertyFromBlob = function (headerProperty, blobProperty) {
    var propertyValue = azureutil.tryGetValueChain(blob, blobProperty.split('.'), null);
    if (propertyValue) {
      webResource.withHeader(headerProperty, propertyValue);
    }
  };

  if (blob) {
    // Content-Type
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CONTENT_TYPE, 'contentSettings.contentType');

    // Content-Encoding
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CONTENT_ENCODING, 'contentSettings.contentEncoding');

    // Content-Language
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CONTENT_LANGUAGE, 'contentSettings.contentLanguage');

    // Content-Disposition
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CONTENT_DISPOSITION, 'contentSettings.contentDisposition');

    // Cache-Control
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CACHE_CONTROL, 'contentSettings.cacheControl');

    // Content-MD5
    setHeaderPropertyFromBlob(HeaderConstants.BLOB_CONTENT_MD5, 'contentSettings.contentMD5');

    // Lease id
    setHeaderPropertyFromBlob(HeaderConstants.LEASE_ID, 'leaseId');

    if (blob.metadata) {
      webResource.addOptionalMetadataHeaders(blob.metadata);
    }
  }
};

module.exports = BlobResult;

},{"./../../../common/common.core":6,"underscore":249}],45:[function(require,module,exports){
//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

var util = require('util');
var RangeStream = require('./../../../common/streams/rangestream');
var Constants = require('./../../../common/util/constants');

/**
* PageBlob page range stream
*/
function PageRangeStream(blobServiceClient, container, blob, options) {
  PageRangeStream['super_'].call(this, blobServiceClient, container, blob, options);

  if (options.minRangeSize) {
    this._minRangeSize = options.minRangeSize;
  } else {
    this._minRangeSize = Constants.BlobConstants.MIN_WRITE_PAGE_SIZE_IN_BYTES;
  }
  if (options.maxRangeSize) {
    this._maxRangeSize = options.maxRangeSize;
  } else {
    this._maxRangeSize = Constants.BlobConstants.DEFAULT_WRITE_PAGE_SIZE_IN_BYTES;
  }
  this._lengthHeader = Constants.HeaderConstants.BLOB_CONTENT_LENGTH;
  this._listFunc = blobServiceClient.listPageRanges;
}

util.inherits(PageRangeStream, RangeStream);

module.exports = PageRangeStream;

},{"./../../../common/streams/rangestream":30,"./../../../common/util/constants":33,"util":"util"}],44:[function(require,module,exports){
//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

var Constants = require('./../../../common/util/constants');
var EventEmitter = require('events').EventEmitter;
var BlobUtilities = require('./../blobutilities');

/**
* BlockBlob block range stream
*/
function BlockRangeStream(blobServiceClient, container, blob, options) {
  this.blobServiceClient = blobServiceClient;
  this.container = container;
  this.blob = blob;
  this._emitter = new EventEmitter();
  this._paused = false;
  this._emittedAll = false;
  this._emittedRangeType = null;
  this._emittedRangeIndex = null;
  this._offset = 0;
  this._rangelist = [];
  this._isEmitting = false;
  if (options.rangeStart) {
    this._startOffset = options.rangeStart;
  } else {
    this._startOffset = 0;
  }
  if (options.rangeEnd) {
    this._endOffset = options.rangeEnd;
  } else {
    this._endOffset = Number.MAX_VALUE;
  }
}

/**
* Add event listener
*/
BlockRangeStream.prototype.on = function (event, listener) {
  this._emitter.on(event, listener);
};

/**
* Get block list
*/
BlockRangeStream.prototype.list = function (options, callback) {
  if (!options) {
    options = {};
  }

  if (!options.blockListFilter) {
    options.blockListFilter = BlobUtilities.BlockListFilter.ALL;
  }

  var self = this;
  this.blobServiceClient.listBlocks(this.container, this.blob, options.blockListFilter, options, function (error, blocklist, response) {
    if (error) {
      callback(error);
    } else {
      var totalSize = parseInt(response.headers[Constants.HeaderConstants.BLOB_CONTENT_LENGTH], 10);
      if (!blocklist.CommittedBlocks) {
        //Convert single block blob to block blob range
        var name = 'NODESDK_BLOCKBLOB_RANGESTREAM';
        blocklist.CommittedBlocks = [{ Name : name, Size : totalSize }];
      }

      self._rangelist = blocklist;
      self._emitBlockList();
      self = blocklist = null;
    }
  });
};

/**
* Emit block ranges
*/
BlockRangeStream.prototype._emitBlockList = function () {
  if (this._paused || this._emittedAll || this._isEmitting) return;

  var self = this;
  this._getTypeList(function () {
    self._rangelist = null;
    self._emittedAll = true;
    self._emitter.emit('end');
  });
};

/**
* Get the block type list
*/
BlockRangeStream.prototype._getTypeList = function (callback) {
  this._isEmitting = true;
  try {
    var typeStart = false;
    if (this._rangelist) {
      for (var blockType in this._rangelist) {
        if (this._rangelist.hasOwnProperty(blockType)) {
          if (this._emittedRangeType === null || typeStart || this._emittedRangeType == blockType) {
            this._emittedRangeType = blockType;
            typeStart = true;
          } else if (this._emittedRangeType !== blockType) {
            continue;
          }

          if (this._paused) {
            return;
          }

          this._emitBlockRange (blockType, callback);
        }
      }
    }
  } finally {
    this._isEmitting = false;
  }
};

/**
* Get the block list
*/
BlockRangeStream.prototype._emitBlockRange  = function (blockType, callback) {
  var blockList = this._rangelist[blockType];
  var indexStart = false;
  for (var blockIndex = 0; blockIndex < blockList.length; blockIndex++) {
    if (this._emittedRangeIndex === null || indexStart || this._emittedRangeIndex === blockIndex) {
      this._emittedRangeIndex = blockIndex;
      indexStart = true;
    } else if (this._emittedRangeIndex !== blockIndex) {
      continue;
    }

    if (this._paused) {
      return;
    }

    var range = blockList[blockIndex];
    // follow the same naming convention of page ranges and json
    range.name = range.Name;
    range.type = blockType;
    range.start = this._offset;
    this._offset += parseInt(range.Size, 10);
    range.end = this._offset - 1;
    delete range.Name;
    delete range.Size;

    if (range.start > this._endOffset) {
      break;
    } else if (range.end < this._startOffset) {
      continue;
    } else {
      range.start = Math.max(range.start, this._startOffset);
      range.end = Math.min(range.end, this._endOffset);
      range.size = range.end - range.start + 1;
      range.dataSize = range.size;
      this._emitter.emit('range', range);
    }
  }

  // remove the used range and avoid memory leak
  this._rangelist[blockType] = null;

  callback();
};

/**
* Pause the stream
*/
BlockRangeStream.prototype.pause = function () {
  this._paused = true;
};

/**
* Resume the stream
*/
BlockRangeStream.prototype.resume = function () {
  this._paused = false;
  if (!this._isEmitting) {
    this._emitBlockList();
  }
};

/**
* Stop the stream
*/
BlockRangeStream.prototype.stop = function () {
  this.pause();
  this._emittedAll = true;
  this._emitter.emit('end');
};

module.exports = BlockRangeStream;

},{"./../../../common/util/constants":33,"./../blobutilities":43,"events":156}]},{},[1]);
