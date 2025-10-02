// RNByronDLNAModuleEnhanced.java
// Enhanced version with DLNA Controller (DMC) functionality for casting to devices
// Includes retry logic and timeout handling

package byron.dlna;

import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.zxt.dlna.application.BaseApplication;
import com.zxt.dlna.dmc.DMCControl;
import com.zxt.dlna.dmr.ZxtMediaRenderer;
import com.zxt.dlna.dms.MediaServer;

import org.fourthline.cling.android.AndroidUpnpService;
import org.fourthline.cling.android.AndroidUpnpServiceImpl;
import org.fourthline.cling.model.action.ActionInvocation;
import org.fourthline.cling.model.message.UpnpResponse;
import org.fourthline.cling.model.meta.Device;
import org.fourthline.cling.model.meta.LocalDevice;
import org.fourthline.cling.model.meta.RemoteDevice;
import org.fourthline.cling.model.meta.Service;
import org.fourthline.cling.model.types.UDAServiceType;
import org.fourthline.cling.model.types.UDN;
import org.fourthline.cling.registry.DefaultRegistryListener;
import org.fourthline.cling.registry.Registry;
import org.fourthline.cling.support.avtransport.callback.Play;
import org.fourthline.cling.support.avtransport.callback.SetAVTransportURI;
import org.greenrobot.eventbus.EventBus;
import org.greenrobot.eventbus.Subscribe;
import org.greenrobot.eventbus.ThreadMode;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Collection;
import java.util.concurrent.atomic.AtomicBoolean;

public class RNByronDLNAModuleEnhanced extends ReactContextBaseJavaModule {

    private static final String TAG = "RNByronDLNA";
    private static final int MAX_RETRIES = 3;
    private static final long INITIAL_RETRY_DELAY = 1000; // 1 second
    private static final int CAST_TIMEOUT_MS = 30000; // 30 seconds
    private static final String EVENT_CAST_PROGRESS = "dlna-cast-progress";

    private final ReactApplicationContext reactContext;
    private AndroidUpnpService upnpService;
    private MediaServer mediaServer;
    private ZxtMediaRenderer mediaRenderer;
    public String friendlyName = "";

    private final ServiceConnection serviceConnection = new ServiceConnection() {

        @Override
        public void onServiceConnected(ComponentName className, IBinder service) {
            upnpService = (AndroidUpnpService) service;
            BaseApplication.upnpService = upnpService;
            Log.v(TAG, "upnpService start");

            // Register device listener for discovery
            upnpService.getRegistry().addListener(registryListener);

            try {
                mediaServer = new MediaServer(reactContext, friendlyName);
                upnpService.getRegistry().addDevice(mediaServer.getDevice());
                mediaRenderer = new ZxtMediaRenderer(1, reactContext, friendlyName);
                upnpService.getRegistry().addDevice(mediaRenderer.getDevice());
                Log.v(TAG, "start media device success");
            } catch (Exception ex) {
                Log.e(TAG, "start media device failed", ex);
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName componentName) {
            upnpService = null;
            mediaServer = null;
            mediaRenderer = null;
            Log.v(TAG, "upnpService close");
        }
    };

    // Registry listener for device discovery
    private final DefaultRegistryListener registryListener = new DefaultRegistryListener() {
        @Override
        public void remoteDeviceAdded(Registry registry, RemoteDevice device) {
            Log.d(TAG, "Remote device added: " + device.getDetails().getFriendlyName());
            // Emit event to React Native if it's a MediaRenderer
            if (isMediaRenderer(device)) {
                sendDeviceDiscoveredEvent(device);
            }
        }

        @Override
        public void remoteDeviceRemoved(Registry registry, RemoteDevice device) {
            Log.d(TAG, "Remote device removed: " + device.getDetails().getFriendlyName());
            sendDeviceRemovedEvent(device);
        }

        @Override
        public void localDeviceAdded(Registry registry, LocalDevice device) {
            Log.d(TAG, "Local device added: " + device.getDetails().getFriendlyName());
        }
    };

    public RNByronDLNAModuleEnhanced(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        EventBus.getDefault().register(this);
    }

    @NonNull
    @Override
    public String getName() {
        return "RNByronDLNA";
    }

    @ReactMethod
    public void startService(String name) {
        fetchInetAddress();
        friendlyName = name;
        Intent intent = new Intent(reactContext, AndroidUpnpServiceImpl.class);
        reactContext.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
        reactContext.startService(intent);
    }

    @ReactMethod
    public void closeService() {
        if (upnpService != null && registryListener != null) {
            upnpService.getRegistry().removeListener(registryListener);
        }
        Intent intent = new Intent(reactContext, AndroidUpnpServiceImpl.class);
        reactContext.stopService(intent);
        if (upnpService != null) {
            try {
                reactContext.unbindService(serviceConnection);
            } catch (Exception e) {
                Log.e(TAG, "Error unbinding service", e);
            }
        }
    }

    /**
     * Discover DLNA devices (MediaRenderers) on the network
     * Returns a Promise that resolves to an array of devices
     */
    @ReactMethod
    public void addListener(String eventName) {
        // Required for RN EventEmitter - kept for compatibility
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Required for RN EventEmitter - kept for compatibility
    }

    @ReactMethod
    public void discoverDevices(Promise promise) {
        if (upnpService == null) {
            promise.reject("SERVICE_NOT_STARTED",
                "DLNA service not started. Call startService('Your App Name') before discovering devices.",
                null);
            return;
        }

        try {
            WritableArray devicesArray = Arguments.createArray();

            // Get all devices from registry
            Collection<Device> devices = upnpService.getRegistry().getDevices();

            for (Device device : devices) {
                if (isMediaRenderer(device)) {
                    WritableMap deviceMap = createDeviceMap(device);
                    devicesArray.pushMap(deviceMap);
                }
            }

            Log.d(TAG, "Discovered " + devicesArray.size() + " MediaRenderer devices");
            promise.resolve(devicesArray);

        } catch (Exception e) {
            Log.e(TAG, "Error discovering devices", e);
            promise.reject("DISCOVERY_ERROR", "Failed to discover devices: " + e.getMessage(), e);
        }
    }

    /**
     * Cast video to a specific DLNA device (like Samsung TV) with retry logic
     * @param deviceId - UDN of the device
     * @param videoUrl - URL of the video to cast
     * @param title - Optional title for the media
     * @param promise - Promise to resolve/reject
     */
    @ReactMethod
    public void castToDevice(String deviceId, String videoUrl, String title, Promise promise) {
        try {
            validateVideoUrl(videoUrl, promise);
        } catch (IllegalArgumentException e) {
            return; // Already rejected by validateVideoUrl
        }

        castToDeviceWithRetry(deviceId, videoUrl, title, promise, 1);
    }

    /**
     * Internal method for casting with retry logic and exponential backoff
     */
    private void castToDeviceWithRetry(String deviceId, String videoUrl, String title, Promise promise, int attemptNumber) {
        if (attemptNumber > MAX_RETRIES) {
            promise.reject("MAX_RETRIES_EXCEEDED",
                "Failed to cast after " + MAX_RETRIES + " attempts. " +
                "Device may be offline or incompatible. Try restarting the device and discovering again.",
                null);
            return;
        }

        if (upnpService == null) {
            promise.reject("SERVICE_NOT_STARTED",
                "DLNA service not started. Call startService('Your App Name') before casting.",
                null);
            return;
        }

        try {
            // Find device by UDN
            Device device = upnpService.getRegistry().getDevice(UDN.valueOf(deviceId), false);

            if (device == null) {
                promise.reject("DEVICE_NOT_FOUND",
                    "Device with ID '" + deviceId + "' not found. " +
                    "Device may have gone offline or discovery needs to be re-run. " +
                    "Try calling discoverDevices() again.",
                    null);
                return;
            }

            String deviceName = device.getDetails().getFriendlyName();

            // Emit connecting progress
            emitCastProgress("connecting", "Connecting to device...", deviceName);

            // Find AVTransport service
            Service avTransportService = device.findService(new UDAServiceType("AVTransport"));

            if (avTransportService == null) {
                promise.reject("SERVICE_NOT_AVAILABLE",
                    "Device '" + deviceName + "' does not support AVTransport service. " +
                    "This device cannot play media via DLNA. " +
                    "Only MediaRenderer devices with AVTransport are supported.",
                    null);
                return;
            }

            // Generate DIDL-Lite metadata
            String metadata = generateDIDLMetadata(videoUrl, title != null ? title : "Video");

            // Setup timeout handler
            Handler timeoutHandler = new Handler(Looper.getMainLooper());
            final AtomicBoolean operationCompleted = new AtomicBoolean(false);

            Runnable timeoutRunnable = () -> {
                if (!operationCompleted.get()) {
                    Log.e(TAG, "Cast operation timed out after 30 seconds on attempt " + attemptNumber);
                    retryOrFail(deviceId, videoUrl, title, promise, attemptNumber, "Operation timed out");
                }
            };

            timeoutHandler.postDelayed(timeoutRunnable, CAST_TIMEOUT_MS);

            // Set AV Transport URI
            upnpService.getControlPoint().execute(
                new SetAVTransportURI(avTransportService, videoUrl, metadata) {
                    @Override
                    public void success(ActionInvocation invocation) {
                        Log.d(TAG, "SetAVTransportURI success on attempt " + attemptNumber + ", now playing...");

                        // Emit buffering progress
                        emitCastProgress("buffering", "Loading media on TV...", deviceName);

                        // After setting URI, send Play command
                        upnpService.getControlPoint().execute(
                            new Play(avTransportService) {
                                @Override
                                public void success(ActionInvocation invocation) {
                                    if (operationCompleted.compareAndSet(false, true)) {
                                        timeoutHandler.removeCallbacks(timeoutRunnable);
                                        Log.d(TAG, "Play command success on attempt " + attemptNumber);

                                        // Emit playing progress
                                        emitCastProgress("playing", "Media is now playing", deviceName);

                                        promise.resolve(true);
                                    }
                                }

                                @Override
                                public void failure(ActionInvocation invocation,
                                                  UpnpResponse operation,
                                                  String defaultMsg) {
                                    if (operationCompleted.compareAndSet(false, true)) {
                                        timeoutHandler.removeCallbacks(timeoutRunnable);
                                        Log.e(TAG, "Play command failed on attempt " + attemptNumber + ": " + defaultMsg);

                                        String errorMsg = "Play command failed: " + defaultMsg + ". " +
                                            "Device may not support the media format or is busy.";
                                        retryOrFail(deviceId, videoUrl, title, promise, attemptNumber, errorMsg);
                                    }
                                }
                            }
                        );
                    }

                    @Override
                    public void failure(ActionInvocation invocation,
                                      UpnpResponse operation,
                                      String defaultMsg) {
                        if (operationCompleted.compareAndSet(false, true)) {
                            timeoutHandler.removeCallbacks(timeoutRunnable);
                            Log.e(TAG, "SetAVTransportURI failed on attempt " + attemptNumber + ": " + defaultMsg);

                            String errorMsg = "Failed to load media: " + defaultMsg + ". " +
                                "Check that the URL is accessible from the TV's network.";
                            retryOrFail(deviceId, videoUrl, title, promise, attemptNumber, errorMsg);
                        }
                    }
                }
            );

        } catch (Exception e) {
            Log.e(TAG, "Exception on attempt " + attemptNumber + ": " + e.getMessage(), e);
            String errorMsg = "Network error while casting: " + e.getMessage() + ". " +
                "Check that both devices are on the same WiFi network.";
            retryOrFail(deviceId, videoUrl, title, promise, attemptNumber, errorMsg);
        }
    }

    /**
     * Helper method to retry or fail based on attempt number
     */
    private void retryOrFail(String deviceId, String videoUrl, String title, Promise promise, int attemptNumber, String errorMsg) {
        if (attemptNumber >= MAX_RETRIES) {
            Log.e(TAG, errorMsg + " - Max retries (" + MAX_RETRIES + ") exceeded");
            promise.reject("CAST_FAILED", errorMsg + " after " + MAX_RETRIES + " attempts");
            return;
        }

        long delay = INITIAL_RETRY_DELAY * (long) Math.pow(2, attemptNumber - 1);
        Log.w(TAG, "Cast attempt " + attemptNumber + " failed: " + errorMsg + ". Retrying in " + delay + "ms (attempt " + (attemptNumber + 1) + "/" + MAX_RETRIES + ")");

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            castToDeviceWithRetry(deviceId, videoUrl, title, promise, attemptNumber + 1);
        }, delay);
    }

    /**
     * Control playback on a device (play, pause, stop)
     */
    @ReactMethod
    public void controlPlayback(String deviceId, String action, Promise promise) {
        if (upnpService == null) {
            promise.reject("SERVICE_NOT_STARTED",
                "DLNA service not started. Call startService('Your App Name') before controlling playback.",
                null);
            return;
        }

        try {
            Device device = upnpService.getRegistry().getDevice(UDN.valueOf(deviceId), false);

            if (device == null) {
                promise.reject("DEVICE_NOT_FOUND",
                    "Device with ID '" + deviceId + "' not found. " +
                    "Device may have gone offline. Try discovering devices again.",
                    null);
                return;
            }

            String deviceName = device.getDetails().getFriendlyName();
            Service avTransportService = device.findService(new UDAServiceType("AVTransport"));

            if (avTransportService == null) {
                promise.reject("SERVICE_NOT_AVAILABLE",
                    "Device '" + deviceName + "' does not support AVTransport service. " +
                    "Cannot control playback on this device.",
                    null);
                return;
            }

            switch (action.toLowerCase()) {
                case "play":
                    upnpService.getControlPoint().execute(
                        new Play(avTransportService) {
                            @Override
                            public void success(ActionInvocation invocation) {
                                promise.resolve(true);
                            }
                            @Override
                            public void failure(ActionInvocation invocation, UpnpResponse operation, String defaultMsg) {
                                promise.reject("ACTION_FAILED", defaultMsg);
                            }
                        }
                    );
                    break;

                case "pause":
                    upnpService.getControlPoint().execute(
                        new org.fourthline.cling.support.avtransport.callback.Pause(avTransportService) {
                            @Override
                            public void success(ActionInvocation invocation) {
                                promise.resolve(true);
                            }
                            @Override
                            public void failure(ActionInvocation invocation, UpnpResponse operation, String defaultMsg) {
                                promise.reject("ACTION_FAILED", defaultMsg);
                            }
                        }
                    );
                    break;

                case "stop":
                    upnpService.getControlPoint().execute(
                        new org.fourthline.cling.support.avtransport.callback.Stop(avTransportService) {
                            @Override
                            public void success(ActionInvocation invocation) {
                                promise.resolve(true);
                            }
                            @Override
                            public void failure(ActionInvocation invocation, UpnpResponse operation, String defaultMsg) {
                                promise.reject("ACTION_FAILED", defaultMsg);
                            }
                        }
                    );
                    break;

                default:
                    promise.reject("INVALID_ACTION",
                        "Invalid action: '" + action + "'. " +
                        "Valid actions are: 'play', 'pause', 'stop'.",
                        null);
            }

        } catch (Exception e) {
            promise.reject("CONTROL_ERROR",
                "Failed to control playback: " + e.getMessage() + ". " +
                "Device may be offline or unreachable.",
                e);
        }
    }

    // ==================== Original Methods ====================

    @ReactMethod
    public void isInstalledApp(String packagename, Promise promise) {
        PackageInfo packageInfo;
        try {
            packageInfo = reactContext.getPackageManager().getPackageInfo(packagename, 0);
        }catch (PackageManager.NameNotFoundException e) {
            packageInfo = null;
            e.printStackTrace();
        }
        promise.resolve(packageInfo != null);
    }

    @ReactMethod
    public void startApp(String packageName) {
        PackageManager packageManager = reactContext.getPackageManager();
        Intent intent = packageManager.getLaunchIntentForPackage(packageName);
        reactContext.startActivity(intent);
    }

    @SuppressWarnings("UnusedDeclaration")
    @Subscribe(threadMode = ThreadMode.MAIN_ORDERED)
    public void onNativeAsync(NativeAsyncEvent event) {
        WritableMap params = Arguments.createMap();
        params.putString("url", event.url);
        params.putString("title", event.title);
        params.putString("type", event.type);
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("dlna-player", params);
    }

    // ==================== Helper Methods ====================

    private boolean isMediaRenderer(Device device) {
        if (device == null) return false;
        Service avTransportService = device.findService(new UDAServiceType("AVTransport"));
        return avTransportService != null;
    }

    private WritableMap createDeviceMap(Device device) {
        WritableMap map = Arguments.createMap();

        map.putString("id", device.getIdentity().getUdn().toString());
        map.putString("name", device.getDetails().getFriendlyName());
        map.putString("manufacturer", device.getDetails().getManufacturerDetails() != null ?
            device.getDetails().getManufacturerDetails().getManufacturer() : "Unknown");
        map.putString("modelName", device.getDetails().getModelDetails() != null ?
            device.getDetails().getModelDetails().getModelName() : "Unknown");
        map.putString("type", device.getType().getType());

        return map;
    }

    private void sendDeviceDiscoveredEvent(Device device) {
        WritableMap deviceMap = createDeviceMap(device);
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("dlna-device-found", deviceMap);
    }

    private void sendDeviceRemovedEvent(Device device) {
        WritableMap params = Arguments.createMap();
        params.putString("id", device.getIdentity().getUdn().toString());
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("dlna-device-lost", params);
    }

    private String generateDIDLMetadata(String url, String title) {
        String escapedUrl = escapeXml(url);
        String escapedTitle = escapeXml(title);

        // Determine protocol info based on file extension
        String protocolInfo;
        if (url.endsWith(".m3u8") || url.contains(".m3u8?")) {
            protocolInfo = "http-get:*:application/vnd.apple.mpegurl:*";
        } else if (url.endsWith(".mp4")) {
            protocolInfo = "http-get:*:video/mp4:*";
        } else {
            protocolInfo = "http-get:*:video/*:*";
        }

        return "<DIDL-Lite xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\" " +
               "xmlns:dc=\"http://purl.org/dc/elements/1.1/\" " +
               "xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\" " +
               "xmlns:dlna=\"urn:schemas-dlna-org:metadata-1-0/\">" +
               "<item id=\"1\" parentID=\"0\" restricted=\"1\">" +
               "<dc:title>" + escapedTitle + "</dc:title>" +
               "<upnp:class>object.item.videoItem</upnp:class>" +
               "<res protocolInfo=\"" + protocolInfo + "\">" + escapedUrl + "</res>" +
               "</item>" +
               "</DIDL-Lite>";
    }

    private String escapeXml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace("\"", "&quot;")
                   .replace("'", "&apos;");
    }

    private void emitCastProgress(String stage, String message, String deviceName) {
        WritableMap progressData = Arguments.createMap();
        progressData.putString("stage", stage); // "connecting", "buffering", "playing"
        progressData.putString("message", message);
        progressData.putString("deviceName", deviceName);
        progressData.putDouble("timestamp", System.currentTimeMillis());

        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(EVENT_CAST_PROGRESS, progressData);
    }

    private void validateVideoUrl(String url, Promise promise) throws IllegalArgumentException {
        if (url == null || url.isEmpty()) {
            promise.reject("INVALID_URL",
                "Video URL cannot be empty. " +
                "Please provide a valid HTTP or HTTPS URL.",
                null);
            throw new IllegalArgumentException("Invalid URL");
        }

        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            promise.reject("INVALID_URL",
                "Invalid video URL: '" + url + "'. " +
                "URL must start with http:// or https://.",
                null);
            throw new IllegalArgumentException("Invalid URL");
        }

        // Warn about HTTPS with Samsung TVs
        if (url.startsWith("https://")) {
            Log.w(TAG, "WARNING: HTTPS URLs may not work with some Samsung TV models. Consider using HTTP.");
        }
    }

    private void fetchInetAddress() {
        new Thread(new Runnable() {
            @SuppressLint("DefaultLocale")
            @Override
            public void run() {
                WifiManager wifiManager = (WifiManager) reactContext.getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
                WifiInfo wifiInfo = wifiManager.getConnectionInfo();
                int ipAddress = wifiInfo.getIpAddress();
                InetAddress inetAddress;
                try {
                    inetAddress = InetAddress.getByName(String.format("%d.%d.%d.%d",
                            (ipAddress & 0xff), (ipAddress >> 8 & 0xff),
                            (ipAddress >> 16 & 0xff), (ipAddress >> 24 & 0xff)));
                    BaseApplication.setLocalIpAddress(inetAddress);
                    BaseApplication.setHostName(inetAddress.getHostName());
                    BaseApplication.setHostAddress(inetAddress.getHostAddress());
                } catch (UnknownHostException e) {
                    Log.e(TAG, "inetAddress failed", e);
                }
            }
        }).start();
    }

    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        try {
            if (EventBus.getDefault().isRegistered(this)) {
                EventBus.getDefault().unregister(this);
            }
            if (upnpService != null && registryListener != null) {
                upnpService.getRegistry().removeListener(registryListener);
            }
        } catch (Exception e) {
            Log.e(TAG, "Cleanup error", e);
        }
    }
}
