// RNByronDLNAEnhanced.mm
// Enhanced version with DLNA Controller (DMC) functionality for casting to devices
// Includes retry logic and timeout handling

#import "RNByronDLNA.h"
#if !TARGET_IPHONE_SIMULATOR
#include <Platinum/Platinum.h>
#include "Platinum/PltMediaRenderer.h"
#include "Platinum/PltMediaController.h"
#include "Platinum/PltCtrlPoint.h"
#endif

#define MAX_RETRIES 3
#define INITIAL_RETRY_DELAY 1.0
#define CAST_TIMEOUT 30.0

NSString *const CAST_PROGRESS_EVENT = @"dlna-cast-progress";

@implementation RNByronDLNA
{
#if !TARGET_IPHONE_SIMULATOR
    PLT_UPnP *upnp;
    PLT_MediaRenderer *renderer;
    PLT_MediaRendererDelegateMy *delegateCPP; // Fixed: heap allocation

    // Controller components for casting
    PLT_CtrlPoint *ctrlPoint;
    PLT_MediaController *mediaController;

    // Store discovered devices
    NSMutableDictionary<NSString*, NSValue*> *discoveredDevices;
#endif
}

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

-(id)init
{
    if (self = [super init]) {
#if !TARGET_IPHONE_SIMULATOR
        // Set up Neptune logging
        NPT_LogManager::GetDefault().Configure("plist:.level=INFO;.handlers=ConsoleHandler;.ConsoleHandler.outputs=2;"
                                               ".ConsoleHandler.colors=false;.ConsoleHandler.filter=59");
        upnp = new PLT_UPnP();
        discoveredDevices = [NSMutableDictionary dictionary];

        // Initialize delegate (heap allocation to prevent dangling pointer)
        delegateCPP = new PLT_MediaRendererDelegateMy();
#endif
    }
    return self;
}

-(void)dealloc
{
#if !TARGET_IPHONE_SIMULATOR
    if (upnp && upnp->IsRunning()) {
        upnp->Stop();
    }
    delete upnp;
    delete renderer;
    delete delegateCPP;
    delete ctrlPoint;
    delete mediaController;
#endif
}

- (NSArray<NSString *> *)supportedEvents
{
    return @[CAST_PROGRESS_EVENT, @"dlna-player", @"dlna-device-found", @"dlna-device-lost"];
}

// Required for RN EventEmitter - kept for compatibility
RCT_EXPORT_METHOD(addListener:(NSString *)eventName)
{
    // Keep empty - required by RN event emitter
}

RCT_EXPORT_METHOD(removeListeners:(NSInteger)count)
{
    // Keep empty - required by RN event emitter
}

RCT_EXPORT_METHOD(startService:(NSString *)serverName)
{
#if !TARGET_IPHONE_SIMULATOR
    if (!upnp->IsRunning()) {
        const char * serverNameChar = [serverName UTF8String];
        NSString * uuid = [[UIDevice currentDevice].identifierForVendor UUIDString];
        const char * uuidChar = [uuid UTF8String];

        // Create renderer (for receiving media)
        renderer = new PLT_MediaRenderer(serverNameChar, false, uuidChar);
        renderer->SetByeByeFirst(false);
        delegateCPP->owner = self;
        renderer->SetDelegate(delegateCPP);
        PLT_DeviceHostReference device(renderer);
        upnp->AddDevice(device);

        // Create control point (for casting TO devices)
        ctrlPoint = new PLT_CtrlPoint();
        mediaController = new PLT_MediaController(ctrlPoint);
        upnp->AddCtrlPoint(ctrlPoint);

        upnp->Start();
        NSLog(@"UPnP Service started with Controller support!");
    }
#endif
}

RCT_EXPORT_METHOD(closeService)
{
#if !TARGET_IPHONE_SIMULATOR
    if (upnp && upnp->IsRunning()) {
        upnp->Stop();
        NSLog(@"UPnP Service stopped!");
    }
    [discoveredDevices removeAllObjects];
#endif
}

/**
 * Discover DLNA devices (MediaRenderers) on the network
 */
RCT_EXPORT_METHOD(discoverDevices:(RCTPromiseResolveBlock)resolve
                         rejecter:(RCTPromiseRejectBlock)reject)
{
#if !TARGET_IPHONE_SIMULATOR
    if (!upnp || !upnp->IsRunning()) {
        reject(@"SERVICE_NOT_STARTED",
               @"DLNA service not started. Call startService('Your App Name') before discovering devices.",
               nil);
        return;
    }

    if (!ctrlPoint) {
        reject(@"CONTROLLER_NOT_INITIALIZED", @"Control point not initialized", nil);
        return;
    }

    // Clear previous discoveries
    [discoveredDevices removeAllObjects];

    // Get all discovered media renderers
    NPT_List<PLT_DeviceDataReference> devices;
    ctrlPoint->GetMediaRenderers(devices);

    NSMutableArray *devicesArray = [NSMutableArray array];

    NPT_List<PLT_DeviceDataReference>::Iterator iterator = devices.GetFirstItem();
    while (iterator) {
        PLT_DeviceDataReference device = *iterator;

        NSString *uuid = [NSString stringWithUTF8String:device->GetUUID()];
        NSString *name = [NSString stringWithUTF8String:device->GetFriendlyName()];
        NSString *manufacturer = @"Unknown";
        NSString *modelName = @"Unknown";

        if (device->GetManufacturer()) {
            manufacturer = [NSString stringWithUTF8String:device->GetManufacturer()];
        }
        if (device->GetModelName()) {
            modelName = [NSString stringWithUTF8String:device->GetModelName()];
        }

        NSDictionary *deviceInfo = @{
            @"id": uuid,
            @"name": name,
            @"manufacturer": manufacturer,
            @"modelName": modelName,
            @"type": @"MediaRenderer"
        };

        [devicesArray addObject:deviceInfo];

        // Store device reference for later use
        [discoveredDevices setObject:[NSValue valueWithPointer:device] forKey:uuid];

        ++iterator;
    }

    NSLog(@"Discovered %lu MediaRenderer devices", (unsigned long)devicesArray.count);
    resolve(devicesArray);

#else
    reject(@"SIMULATOR_NOT_SUPPORTED", @"DLNA not supported on simulator", nil);
#endif
}

/**
 * Cast video to a specific DLNA device (like Samsung TV) with retry logic
 */
RCT_EXPORT_METHOD(castToDevice:(NSString *)deviceId
                      videoUrl:(NSString *)url
                         title:(NSString *)title
                      resolver:(RCTPromiseResolveBlock)resolve
                      rejecter:(RCTPromiseRejectBlock)reject)
{
#if !TARGET_IPHONE_SIMULATOR
    // Validate video URL
    NSString *validationError = nil;
    if (![self validateVideoUrl:url errorMessage:&validationError]) {
        reject(@"INVALID_URL", validationError, nil);
        return;
    }

    [self castToDeviceWithRetry:deviceId
                       videoUrl:url
                          title:title
                       resolver:resolve
                       rejecter:reject
                  attemptNumber:1];
#else
    reject(@"SIMULATOR_NOT_SUPPORTED", @"DLNA not supported on simulator", nil);
#endif
}

/**
 * Internal method for casting with retry logic and exponential backoff
 */
-(void)castToDeviceWithRetry:(NSString*)deviceId
                     videoUrl:(NSString*)url
                        title:(NSString*)title
                     resolver:(RCTPromiseResolveBlock)resolve
                     rejecter:(RCTPromiseRejectBlock)reject
                attemptNumber:(int)attemptNumber
{
#if !TARGET_IPHONE_SIMULATOR
    if (attemptNumber > MAX_RETRIES) {
        reject(@"MAX_RETRIES_EXCEEDED",
               [NSString stringWithFormat:@"Failed to cast after %d attempts. Device may be offline or incompatible. Try restarting the device and discovering again.", MAX_RETRIES],
               nil);
        return;
    }

    if (!upnp || !upnp->IsRunning()) {
        reject(@"SERVICE_NOT_STARTED",
               @"DLNA service not started. Call startService('Your App Name') before casting.",
               nil);
        return;
    }

    if (!mediaController) {
        reject(@"CONTROLLER_NOT_INITIALIZED", @"Media controller not initialized", nil);
        return;
    }

    // Find device by UUID
    NSValue *deviceValue = [discoveredDevices objectForKey:deviceId];
    if (!deviceValue) {
        // Try to discover devices first
        NPT_List<PLT_DeviceDataReference> devices;
        ctrlPoint->GetMediaRenderers(devices);

        NPT_List<PLT_DeviceDataReference>::Iterator iterator = devices.GetFirstItem();
        bool found = false;

        while (iterator) {
            PLT_DeviceDataReference device = *iterator;
            NSString *uuid = [NSString stringWithUTF8String:device->GetUUID()];

            if ([uuid isEqualToString:deviceId]) {
                deviceValue = [NSValue valueWithPointer:device];
                [discoveredDevices setObject:deviceValue forKey:deviceId];
                found = true;
                break;
            }
            ++iterator;
        }

        if (!found) {
            reject(@"DEVICE_NOT_FOUND",
                   [NSString stringWithFormat:@"Device with ID '%@' not found. Device may have gone offline or discovery needs to be re-run. Try calling discoverDevices() again.", deviceId],
                   nil);
            return;
        }
    }

    PLT_DeviceDataReference device = (PLT_DeviceDataReference)[deviceValue pointerValue];
    NSString *friendlyName = [NSString stringWithUTF8String:device->GetFriendlyName()];

    // Emit connecting progress
    [self emitCastProgress:@"connecting"
                   message:@"Connecting to device..."
                deviceName:friendlyName];

    // Generate DIDL-Lite metadata
    NSString *safeTitle = title ? title : @"Video";
    NSString *metadata = [self generateDIDLMetadata:url title:safeTitle];

    const char *urlChar = [url UTF8String];
    const char *metadataChar = [metadata UTF8String];

    // Setup timeout handler
    __block BOOL operationCompleted = NO;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(CAST_TIMEOUT * NSEC_PER_SEC)),
                  dispatch_get_main_queue(), ^{
        if (!operationCompleted) {
            NSLog(@"Cast operation timed out after %.0f seconds on attempt %d", CAST_TIMEOUT, attemptNumber);
            [self retryOrFail:deviceId
                     videoUrl:url
                        title:title
                     resolver:resolve
                     rejecter:reject
                attemptNumber:attemptNumber
                        error:@"Operation timed out"];
        }
    });

    // Set AV Transport URI
    NPT_Result result = mediaController->SetAVTransportURI(
        device,
        0, // Instance ID
        urlChar,
        metadataChar,
        NULL // Callback (NULL for synchronous)
    );

    if (NPT_FAILED(result)) {
        operationCompleted = YES;
        NSLog(@"SetAVTransportURI failed on attempt %d", attemptNumber);
        NSString *errorMsg = [NSString stringWithFormat:@"Failed to load media. Check that the URL is accessible from the TV's network. Device: %@", friendlyName];
        [self retryOrFail:deviceId
                 videoUrl:url
                    title:title
                 resolver:resolve
                 rejecter:reject
            attemptNumber:attemptNumber
                    error:errorMsg];
        return;
    }

    // Emit buffering progress
    [self emitCastProgress:@"buffering"
                   message:@"Loading media on TV..."
                deviceName:friendlyName];

    // Give device time to process URI
    [NSThread sleepForTimeInterval:0.5];

    // Send Play command
    result = mediaController->Play(device, 0, "1", NULL);

    if (NPT_FAILED(result)) {
        operationCompleted = YES;
        NSLog(@"Play command failed on attempt %d", attemptNumber);
        NSString *errorMsg = [NSString stringWithFormat:@"Play command failed. Device may not support the media format or is busy. Device: %@", friendlyName];
        [self retryOrFail:deviceId
                 videoUrl:url
                    title:title
                 resolver:resolve
                 rejecter:reject
            attemptNumber:attemptNumber
                    error:errorMsg];
        return;
    }

    operationCompleted = YES;

    // Emit playing progress
    [self emitCastProgress:@"playing"
                   message:@"Media is now playing"
                deviceName:friendlyName];

    NSLog(@"Successfully cast video on attempt %d: %@", attemptNumber, safeTitle);
    resolve(@YES);
#endif
}

/**
 * Helper method to retry or fail based on attempt number
 */
-(void)retryOrFail:(NSString*)deviceId
          videoUrl:(NSString*)url
             title:(NSString*)title
          resolver:(RCTPromiseResolveBlock)resolve
          rejecter:(RCTPromiseRejectBlock)reject
     attemptNumber:(int)attemptNumber
             error:(NSString*)errorMsg
{
    if (attemptNumber >= MAX_RETRIES) {
        NSLog(@"%@ - Max retries (%d) exceeded", errorMsg, MAX_RETRIES);
        reject(@"CAST_FAILED",
               [NSString stringWithFormat:@"%@ after %d attempts", errorMsg, MAX_RETRIES],
               nil);
        return;
    }

    double delay = INITIAL_RETRY_DELAY * pow(2, attemptNumber - 1);
    NSLog(@"Cast attempt %d failed: %@. Retrying in %.1f seconds (attempt %d/%d)",
          attemptNumber, errorMsg, delay, attemptNumber + 1, MAX_RETRIES);

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)),
                  dispatch_get_main_queue(), ^{
        [self castToDeviceWithRetry:deviceId
                           videoUrl:url
                              title:title
                           resolver:resolve
                           rejecter:reject
                      attemptNumber:attemptNumber + 1];
    });
}

/**
 * Control playback on a device (play, pause, stop)
 */
RCT_EXPORT_METHOD(controlPlayback:(NSString *)deviceId
                           action:(NSString *)action
                         resolver:(RCTPromiseResolveBlock)resolve
                         rejecter:(RCTPromiseRejectBlock)reject)
{
#if !TARGET_IPHONE_SIMULATOR
    if (!mediaController) {
        reject(@"CONTROLLER_NOT_INITIALIZED",
               @"Media controller not initialized. Call startService('Your App Name') first.",
               nil);
        return;
    }

    NSValue *deviceValue = [discoveredDevices objectForKey:deviceId];
    if (!deviceValue) {
        reject(@"DEVICE_NOT_FOUND",
               [NSString stringWithFormat:@"Device with ID '%@' not found. Device may have gone offline. Try discovering devices again.", deviceId],
               nil);
        return;
    }

    PLT_DeviceDataReference device = (PLT_DeviceDataReference)[deviceValue pointerValue];
    NPT_Result result;

    if ([action isEqualToString:@"play"]) {
        result = mediaController->Play(device, 0, "1", NULL);
    } else if ([action isEqualToString:@"pause"]) {
        result = mediaController->Pause(device, 0, NULL);
    } else if ([action isEqualToString:@"stop"]) {
        result = mediaController->Stop(device, 0, NULL);
    } else {
        reject(@"INVALID_ACTION",
               [NSString stringWithFormat:@"Invalid action: '%@'. Valid actions are: 'play', 'pause', 'stop'.", action],
               nil);
        return;
    }

    if (NPT_FAILED(result)) {
        NSString *friendlyName = [NSString stringWithUTF8String:device->GetFriendlyName()];
        reject(@"ACTION_FAILED",
               [NSString stringWithFormat:@"Failed to execute action '%@' on device '%@'. Device may be offline or unreachable.", action, friendlyName],
               nil);
        return;
    }

    resolve(@YES);

#else
    reject(@"SIMULATOR_NOT_SUPPORTED", @"DLNA not supported on simulator", nil);
#endif
}

// ==================== Original Methods ====================

RCT_EXPORT_METHOD(isInstalledApp:(NSString *)URLScheme
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject)
{
    NSURL* url;
    if ([URLScheme containsString:@"://"]) {
        url = [NSURL URLWithString:[NSString stringWithFormat:@"%@",URLScheme]];
    } else {
        url = [NSURL URLWithString:[NSString stringWithFormat:@"%@://",URLScheme]];
    }
    if ([[UIApplication sharedApplication] canOpenURL:url]){
        resolve(@(YES));
    } else {
        resolve(@(NO));
    }
}

RCT_EXPORT_METHOD(startApp:(NSString *)URLScheme)
{
    NSURL* url;
    if ([URLScheme containsString:@"://"]) {
        url = [NSURL URLWithString:[NSString stringWithFormat:@"%@",URLScheme]];
    } else {
        url = [NSURL URLWithString:[NSString stringWithFormat:@"%@://",URLScheme]];
    }
    if ([[UIApplication sharedApplication] canOpenURL:url]){
        [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
    }
}

// ==================== Helper Methods ====================

- (NSString *)generateDIDLMetadata:(NSString *)url title:(NSString *)title
{
    NSString *escapedUrl = [self escapeXml:url];
    NSString *escapedTitle = [self escapeXml:title];

    // Determine protocol info based on file extension
    NSString *protocolInfo;
    if ([url hasSuffix:@".m3u8"] || [url containsString:@".m3u8?"]) {
        protocolInfo = @"http-get:*:application/vnd.apple.mpegurl:*";
    } else if ([url hasSuffix:@".mp4"]) {
        protocolInfo = @"http-get:*:video/mp4:*";
    } else {
        protocolInfo = @"http-get:*:video/*:*";
    }

    return [NSString stringWithFormat:
        @"<DIDL-Lite xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\" "
        @"xmlns:dc=\"http://purl.org/dc/elements/1.1/\" "
        @"xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\" "
        @"xmlns:dlna=\"urn:schemas-dlna-org:metadata-1-0/\">"
        @"<item id=\"1\" parentID=\"0\" restricted=\"1\">"
        @"<dc:title>%@</dc:title>"
        @"<upnp:class>object.item.videoItem</upnp:class>"
        @"<res protocolInfo=\"%@\">%@</res>"
        @"</item>"
        @"</DIDL-Lite>",
        escapedTitle, protocolInfo, escapedUrl];
}

- (NSString *)escapeXml:(NSString *)text
{
    if (!text) return @"";

    NSString *escaped = [text stringByReplacingOccurrencesOfString:@"&" withString:@"&amp;"];
    escaped = [escaped stringByReplacingOccurrencesOfString:@"<" withString:@"&lt;"];
    escaped = [escaped stringByReplacingOccurrencesOfString:@">" withString:@"&gt;"];
    escaped = [escaped stringByReplacingOccurrencesOfString:@"\"" withString:@"&quot;"];
    escaped = [escaped stringByReplacingOccurrencesOfString:@"'" withString:@"&apos;"];

    return escaped;
}

-(void)emitCastProgress:(NSString*)stage
                message:(NSString*)message
             deviceName:(NSString*)deviceName
{
    [self sendEventWithName:CAST_PROGRESS_EVENT body:@{
        @"stage": stage,
        @"message": message,
        @"deviceName": deviceName,
        @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
    }];
}

- (BOOL)validateVideoUrl:(NSString *)url errorMessage:(NSString **)errorMessage
{
    if (!url || url.length == 0) {
        if (errorMessage) {
            *errorMessage = @"Video URL cannot be empty. Please provide a valid HTTP or HTTPS URL.";
        }
        return NO;
    }

    if (![url hasPrefix:@"http://"] && ![url hasPrefix:@"https://"]) {
        if (errorMessage) {
            *errorMessage = [NSString stringWithFormat:@"Invalid video URL: '%@'. URL must start with http:// or https://.", url];
        }
        return NO;
    }

    if ([url hasPrefix:@"https://"]) {
        NSLog(@"WARNING: HTTPS URLs may not work with some Samsung TV models. Consider using HTTP.");
    }

    return YES;
}

#if !TARGET_IPHONE_SIMULATOR
#pragma mark - MediaRendererDelegate

-(void)OnGetCurrentConnectionInfo:(PLT_ActionReference*)action
{

}

// AVTransport
-(void) OnNext:(PLT_ActionReference*)action
{

}

-(void) OnPause:(PLT_ActionReference*)action
{

}

-(void) OnPlay:(PLT_ActionReference*)action
{

}

-(void) OnPrevious:(PLT_ActionReference*)action
{

}

-(void) OnSeek:(PLT_ActionReference*)action
{

}

-(void) OnStop:(PLT_ActionReference*)action
{

}

-(void) OnSetAVTransportURI:(PLT_ActionReference*)action
{
    NPT_String currentURI;
    (*action)->GetArgumentValue("CurrentURI", currentURI);
    NSString *url = [NSString stringWithUTF8String:currentURI];

    NPT_String currentURIMetaData;
    (*action)->GetArgumentValue("CurrentURIMetaData", currentURIMetaData);

    PLT_MediaObjectListReference medias;
    PLT_Didl::FromDidl(currentURIMetaData, medias);
    if (medias.IsNull()) {
        return;
    }
    int count = medias->GetItemCount();
    if (count == 0) {
        return;
    }
    PLT_MediaObject * media = *medias->GetFirstItem();
    NSString *title = [NSString stringWithUTF8String:media->m_Title];
    [self sendEventWithName:@"dlna-player" body:@{@"url":url,@"title":title}];
}

-(void) OnSetPlayMode:(PLT_ActionReference*)action
{

}

// RenderingControl
-(void) OnSetVolume:(PLT_ActionReference*)action
{

}

-(void) OnSetVolumeDB:(PLT_ActionReference*)action
{

}

-(void) OnGetVolumeDBRange:(PLT_ActionReference*)action
{

}

-(void) OnSetMute:(PLT_ActionReference*)action
{

}
#endif

@end
