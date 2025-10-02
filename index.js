import React, { useRef } from "react";
import { requireNativeComponent, View, Dimensions } from "react-native";
import { NativeModules, NativeEventEmitter } from "react-native";

const { width } = Dimensions.get("window");

const RNByronDLNA = NativeModules.RNByronDLNA || {};

// ==================== Original API ====================

export const startService = (name) => {
  if (RNByronDLNA.startService) {
    RNByronDLNA.startService(name);
  }
};

export const closeService = () => {
  if (RNByronDLNA.closeService) {
    RNByronDLNA.closeService();
  }
};

export const isInstalledApp = (name) => {
  if (RNByronDLNA.isInstalledApp) {
    return RNByronDLNA.isInstalledApp(name);
  }
};

export const startApp = (name) => {
  if (RNByronDLNA.startApp) {
    RNByronDLNA.startApp(name);
  }
};

// ==================== NEW CASTING API ====================

/**
 * Discover DLNA devices (MediaRenderers) on the network
 * @returns {Promise<Array<DLNADevice>>} Array of discovered devices
 *
 * @example
 * const devices = await discoverDevices();
 * console.log('Found devices:', devices);
 * // [{ id: 'uuid:...', name: 'Samsung TV', manufacturer: 'Samsung', ... }]
 */
export const discoverDevices = () => {
  if (RNByronDLNA.discoverDevices) {
    return RNByronDLNA.discoverDevices();
  }
  return Promise.reject(new Error('discoverDevices not available'));
};

/**
 * Cast video to a DLNA device (like Samsung TV) with automatic retry
 *
 * This method automatically retries up to 3 times with exponential backoff
 * (1s, 2s, 4s delays) if the initial cast fails.
 *
 * Timeout: 30 seconds per attempt
 *
 * @param {string} deviceId - Device UUID from discoverDevices()
 * @param {string} videoUrl - HTTP/HTTPS URL (HLS supported on Samsung 2018+)
 * @param {string} [title='Video'] - Media title
 * @returns {Promise<boolean>} Resolves when casting succeeds
 * @throws {Error} INVALID_URL, DEVICE_NOT_FOUND, TIMEOUT, MAX_RETRIES_EXCEEDED, CAST_FAILED
 *
 * @example
 * const devices = await discoverDevices();
 * const samsungTV = devices.find(d => d.name.includes('Samsung'));
 *
 * try {
 *   await castToDevice(samsungTV.id, 'http://example.com/video.mp4', 'My Video');
 *   console.log('Successfully cast to TV');
 * } catch (error) {
 *   if (error.code === 'MAX_RETRIES_EXCEEDED') {
 *     console.error('Failed after 3 attempts');
 *   } else if (error.code === 'TIMEOUT') {
 *     console.error('Operation timed out');
 *   }
 * }
 */
export const castToDevice = (deviceId, videoUrl, title = 'Video') => {
  if (RNByronDLNA.castToDevice) {
    return RNByronDLNA.castToDevice(deviceId, videoUrl, title);
  }
  return Promise.reject(new Error('castToDevice not available'));
};

/**
 * Control playback on a device
 * @param {string} deviceId - The device UUID
 * @param {'play'|'pause'|'stop'} action - The playback action
 * @returns {Promise<boolean>} True if command succeeded
 *
 * @example
 * await controlPlayback(deviceId, 'pause');
 * await controlPlayback(deviceId, 'play');
 * await controlPlayback(deviceId, 'stop');
 */
export const controlPlayback = (deviceId, action) => {
  if (RNByronDLNA.controlPlayback) {
    return RNByronDLNA.controlPlayback(deviceId, action);
  }
  return Promise.reject(new Error('controlPlayback not available'));
};

// ==================== Event Emitters ====================

export const dlnaEventName = "dlna-player";
export const deviceFoundEventName = "dlna-device-found";
export const deviceLostEventName = "dlna-device-lost";

/**
 * Event name for casting progress notifications
 *
 * Progress stages: 'connecting', 'buffering', 'playing'
 *
 * @example
 * ByronEmitter.addListener(castProgressEventName, (progress) => {
 *   console.log(`${progress.stage}: ${progress.message}`);
 *   console.log(`Device: ${progress.deviceName}`);
 *   console.log(`Timestamp: ${new Date(progress.timestamp)}`);
 * });
 */
export const castProgressEventName = "dlna-cast-progress";

export const ByronEmitter = new NativeEventEmitter(RNByronDLNA);

// ==================== Helper Functions ====================

/**
 * Find Samsung TV from discovered devices
 * @param {Array<DLNADevice>} devices - Array of devices from discoverDevices()
 * @returns {DLNADevice|null} The first Samsung TV found, or null
 *
 * @example
 * const devices = await discoverDevices();
 * const samsungTV = findSamsungTV(devices);
 * if (samsungTV) {
 *   await castToDevice(samsungTV.id, videoUrl);
 * }
 */
export const findSamsungTV = (devices) => {
  return devices.find(d =>
    d.name.toLowerCase().includes('samsung') ||
    d.manufacturer.toLowerCase().includes('samsung')
  ) || null;
};

/**
 * Filter devices by type or manufacturer
 * @param {Array<DLNADevice>} devices - Array of devices
 * @param {Object} filter - Filter criteria
 * @param {string} [filter.manufacturer] - Filter by manufacturer
 * @param {string} [filter.name] - Filter by name (partial match)
 * @returns {Array<DLNADevice>} Filtered devices
 *
 * @example
 * const devices = await discoverDevices();
 * const samsungDevices = filterDevices(devices, { manufacturer: 'Samsung' });
 * const tvs = filterDevices(devices, { name: 'TV' });
 */
export const filterDevices = (devices, filter) => {
  return devices.filter(device => {
    if (filter.manufacturer) {
      if (!device.manufacturer.toLowerCase().includes(filter.manufacturer.toLowerCase())) {
        return false;
      }
    }
    if (filter.name) {
      if (!device.name.toLowerCase().includes(filter.name.toLowerCase())) {
        return false;
      }
    }
    return true;
  });
};

// ==================== VLC Player (Original) ====================

const invertKeyValues = (obj) => {
  return Object.keys(obj).reduce((acc, key) => {
    acc[obj[key]] = key;
    return acc;
  }, {});
};

const RNByronVlc = requireNativeComponent("RNByronVlc");

export const ScaleType = {
  SURFACE_BEST_FIT: 0,
  SURFACE_FIT_SCREEN: 1,
  SURFACE_FILL: 2,
  SURFACE_16_9: 3,
  SURFACE_4_3: 4,
  SURFACE_ORIGINAL: 5,
};

export const EventType = {
  Buffering: 259,
  EncounteredError: 266,
  EndReached: 265,
  Playing: 260,
  Paused: 261,
  PositionChanged: 268,
  Stopped: 262,
};

const RNByronPlayer = React.forwardRef((props, ref) => {
  const viewRef = useRef(null);

  React.useImperativeHandle(ref, () => ({
    setNativeProps: (nativeProps) => {
      viewRef.current?.setNativeProps(nativeProps);
    },
  }));

  const onEventVlc = (event) => {
    const data = event.nativeEvent;
    switch (data.type) {
      case EventType.Buffering:
        props.onBuffering && props.onBuffering();
        break;
      case EventType.EncounteredError:
        props.onError && props.onError();
        break;
      case EventType.EndReached:
        props.onEndReached && props.onEndReached();
        break;
      case EventType.Playing:
        props.onPlaying && props.onPlaying(data);
        break;
      case EventType.Paused:
        props.onPaused && props.onPaused();
        break;
      case EventType.PositionChanged:
        props.onProgress && props.onProgress(data);
        break;
      case EventType.Stopped:
        props.onStopped && props.onStopped();
        break;
    }
  };

  const onLayout = (e) => {
    const layout = e.nativeEvent.layout;
    viewRef.current?.setNativeProps({
      style: {
        width: layout.width,
        height: layout.height,
      },
    });
  };

  const style = props.style || {};
  const source = props.source || {};
  const options = source.options ? source.options : ["--rtsp-tcp", "-vvv"];
  const uri = source.uri || "";
  if (!uri) return null;

  const nativeProps = Object.assign({}, props, {
    source: { uri, options },
    style: {
      width: style.width || width,
      height: style.height || 240,
    },
  });
  return (
    <View style={style} onLayout={onLayout}>
      <RNByronVlc
        ref={viewRef}
        source={{ uri, options }}
        onEventVlc={onEventVlc}
        {...nativeProps}
      />
    </View>
  );
});

export const ByronPlayer = React.memo(RNByronPlayer);
