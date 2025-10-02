import { NativeModules, NativeEventEmitter } from "react-native";

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

// ==================== VLC Player (Disabled - not needed for DLNA casting) ====================
// VLC player has been removed to focus on DLNA casting functionality.
// The native VLC components are disabled in both Android and iOS builds.
