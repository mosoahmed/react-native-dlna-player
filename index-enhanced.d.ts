// TypeScript definitions for react-native-dlna-player (Enhanced with Casting)

import { Component } from 'react';
import { ViewStyle } from 'react-native';
import { NativeEventEmitter } from 'react-native';

// ==================== DLNA Device Types ====================

/**
 * Represents a discovered DLNA device (MediaRenderer)
 */
export interface DLNADevice {
  /**
   * Unique device identifier (UDN - Unique Device Name)
   * @example "uuid:12345678-1234-1234-1234-123456789abc"
   */
  id: string;

  /**
   * Human-readable device name
   * @example "Samsung TV", "Living Room TV"
   */
  name: string;

  /**
   * Device manufacturer
   * @example "Samsung", "LG", "Sony"
   */
  manufacturer: string;

  /**
   * Device model name
   * @example "UN65KS8000", "OLED65C9PUA"
   */
  modelName: string;

  /**
   * Device type (usually "MediaRenderer" for TVs)
   */
  type: string;
}

/**
 * Filter criteria for filtering discovered devices
 */
export interface DeviceFilter {
  /**
   * Filter by manufacturer (case-insensitive partial match)
   */
  manufacturer?: string;

  /**
   * Filter by device name (case-insensitive partial match)
   */
  name?: string;
}

// ==================== DLNA Service Functions ====================

/**
 * Start the DLNA service
 * This initializes both the MediaRenderer (for receiving media) and
 * the ControlPoint (for discovering and casting to other devices)
 *
 * @param name - Friendly name for this device (will appear on network)
 *
 * @example
 * startService('My Phone');
 */
export function startService(name: string): void;

/**
 * Stop the DLNA service and cleanup resources
 *
 * @example
 * closeService();
 */
export function closeService(): void;

/**
 * Discover DLNA devices (MediaRenderers) on the local network
 * This scans for devices like Samsung TVs, smart speakers, etc.
 *
 * @returns Promise that resolves to array of discovered devices
 * @throws Error if DLNA service is not started
 *
 * @example
 * const devices = await discoverDevices();
 * console.log('Found devices:', devices);
 * devices.forEach(device => {
 *   console.log(`${device.name} (${device.manufacturer})`);
 * });
 */
export function discoverDevices(): Promise<DLNADevice[]>;

/**
 * Cast video to a DLNA device (like Samsung TV)
 *
 * Supported formats:
 * - MP4 (H.264/AAC) - Best compatibility across all devices
 * - HLS (.m3u8) - Supported on Samsung TV 2018+ models and modern smart TVs
 * - Use HTTP for better compatibility (HTTPS may fail on older models)
 *
 * @param deviceId - The device UUID (from discoverDevices)
 * @param videoUrl - URL of the video to cast (HTTP/HTTPS)
 * @param title - Optional title for the media (default: 'Video')
 * @returns Promise that resolves to true if casting succeeded
 * @throws Error if device not found, invalid URL, or casting fails
 *
 * @example MP4 Video
 * const devices = await discoverDevices();
 * const samsungTV = devices.find(d => d.name.includes('Samsung'));
 *
 * if (samsungTV) {
 *   await castToDevice(
 *     samsungTV.id,
 *     'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
 *     'Big Buck Bunny'
 *   );
 * }
 *
 * @example HLS Streaming
 * await castToDevice(
 *   samsungTV.id,
 *   'http://example.com/livestream.m3u8',
 *   'Live Stream'
 * );
 *
 * @example HTTPS Warning
 * // HTTPS may not work on older Samsung TVs - use HTTP when possible
 * await castToDevice(
 *   samsungTV.id,
 *   'http://example.com/video.mp4', // Preferred over https://
 *   'My Video'
 * );
 */
export function castToDevice(
  deviceId: string,
  videoUrl: string,
  title?: string
): Promise<boolean>;

/**
 * Control playback on a DLNA device
 *
 * @param deviceId - The device UUID
 * @param action - The playback action ('play', 'pause', or 'stop')
 * @returns Promise that resolves to true if command succeeded
 * @throws Error if device not found or command fails
 *
 * @example
 * // Pause playback
 * await controlPlayback(deviceId, 'pause');
 *
 * // Resume playback
 * await controlPlayback(deviceId, 'play');
 *
 * // Stop playback
 * await controlPlayback(deviceId, 'stop');
 */
export function controlPlayback(
  deviceId: string,
  action: 'play' | 'pause' | 'stop'
): Promise<boolean>;

// ==================== Helper Functions ====================

/**
 * Find the first Samsung TV from a list of discovered devices
 *
 * @param devices - Array of devices from discoverDevices()
 * @returns The first Samsung TV found, or null if none found
 *
 * @example
 * const devices = await discoverDevices();
 * const samsungTV = findSamsungTV(devices);
 *
 * if (samsungTV) {
 *   console.log('Found Samsung TV:', samsungTV.name);
 *   await castToDevice(samsungTV.id, videoUrl);
 * } else {
 *   console.log('No Samsung TV found');
 * }
 */
export function findSamsungTV(devices: DLNADevice[]): DLNADevice | null;

/**
 * Filter devices by manufacturer or name
 *
 * @param devices - Array of devices
 * @param filter - Filter criteria
 * @returns Filtered array of devices
 *
 * @example
 * const devices = await discoverDevices();
 *
 * // Find all Samsung devices
 * const samsungDevices = filterDevices(devices, { manufacturer: 'Samsung' });
 *
 * // Find all devices with "TV" in the name
 * const tvs = filterDevices(devices, { name: 'TV' });
 *
 * // Combine filters
 * const samsungTVs = filterDevices(devices, {
 *   manufacturer: 'Samsung',
 *   name: 'TV'
 * });
 */
export function filterDevices(
  devices: DLNADevice[],
  filter: DeviceFilter
): DLNADevice[];

// ==================== App Utilities (Original) ====================

/**
 * Check if an app is installed (by package name on Android, URL scheme on iOS)
 * @param packageName - Package name (Android) or URL scheme (iOS)
 * @returns Promise that resolves to true if app is installed
 */
export function isInstalledApp(packageName: string): Promise<boolean>;

/**
 * Launch an installed app (by package name on Android, URL scheme on iOS)
 * @param packageName - Package name (Android) or URL scheme (iOS)
 */
export function startApp(packageName: string): void;

// ==================== Event Emitters ====================

/**
 * Event emitter for DLNA events
 */
export const ByronEmitter: NativeEventEmitter;

/**
 * Event name for receiving media URLs (when device acts as renderer)
 */
export const dlnaEventName: 'dlna-player';

/**
 * Event name for device discovery notifications
 */
export const deviceFoundEventName: 'dlna-device-found';

/**
 * Event name for device removal notifications
 */
export const deviceLostEventName: 'dlna-device-lost';

/**
 * Event name for casting progress notifications
 *
 * @example
 * import { ByronEmitter, castProgressEventName } from 'react-native-dlna-player';
 *
 * ByronEmitter.addListener(castProgressEventName, (progress) => {
 *   console.log(`${progress.stage}: ${progress.message}`);
 *   console.log(`Device: ${progress.deviceName}`);
 * });
 */
export const castProgressEventName: 'dlna-cast-progress';

/**
 * DLNA player event data (when receiving media as renderer)
 */
export interface DLNAPlayerEvent {
  /** URL of the media to play */
  url: string;
  /** Title of the media */
  title: string;
  /** Media type */
  type: string;
}

/**
 * Device found event data
 */
export interface DeviceFoundEvent extends DLNADevice {}

/**
 * Device lost event data
 */
export interface DeviceLostEvent {
  /** Device ID that was removed */
  id: string;
}

/**
 * Cast progress event data
 */
export interface CastProgressEvent {
  /** Progress stage */
  stage: 'connecting' | 'buffering' | 'playing';
  /** Human-readable progress message */
  message: string;
  /** Name of the device being cast to */
  deviceName: string;
  /** Timestamp in milliseconds */
  timestamp: number;
}

/**
 * Enhanced error codes with context
 */
export enum DLNAErrorCode {
  /** Invalid video URL format */
  INVALID_URL = 'INVALID_URL',
  /** Device not found or went offline */
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  /** DLNA service not started */
  SERVICE_NOT_STARTED = 'SERVICE_NOT_STARTED',
  /** Device doesn't support required service */
  SERVICE_NOT_AVAILABLE = 'SERVICE_NOT_AVAILABLE',
  /** Network communication error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Operation timed out */
  TIMEOUT = 'TIMEOUT',
  /** Maximum retry attempts exceeded */
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  /** Cast operation failed */
  CAST_FAILED = 'CAST_FAILED',
  /** Invalid playback action */
  INVALID_ACTION = 'INVALID_ACTION',
  /** Playback control failed */
  ACTION_FAILED = 'ACTION_FAILED',
  /** Controller not initialized */
  CONTROLLER_NOT_INITIALIZED = 'CONTROLLER_NOT_INITIALIZED',
  /** General control error */
  CONTROL_ERROR = 'CONTROL_ERROR'
}

// ==================== VLC Player Component (Original) ====================

export enum ScaleType {
  SURFACE_BEST_FIT = 0,
  SURFACE_FIT_SCREEN = 1,
  SURFACE_FILL = 2,
  SURFACE_16_9 = 3,
  SURFACE_4_3 = 4,
  SURFACE_ORIGINAL = 5,
}

export enum EventType {
  Buffering = 259,
  EncounteredError = 266,
  EndReached = 265,
  Playing = 260,
  Paused = 261,
  PositionChanged = 268,
  Stopped = 262,
}

export interface VlcPlayerSource {
  uri: string;
  options?: string[];
}

export interface VlcEventData {
  type: EventType;
  currentTime?: number;
  duration?: number;
  position?: number;
}

export interface ByronPlayerProps {
  source: VlcPlayerSource;
  paused?: boolean;
  time?: number;
  rate?: ScaleType;
  volume?: number;
  aspectRatio?: string;
  style?: ViewStyle;
  onBuffering?: () => void;
  onError?: () => void;
  onEndReached?: () => void;
  onPlaying?: (event: VlcEventData) => void;
  onPaused?: () => void;
  onProgress?: (event: VlcEventData) => void;
  onStopped?: () => void;
}

export class ByronPlayer extends Component<ByronPlayerProps> {
  setNativeProps(nativeProps: object): void;
}

// ==================== Usage Examples ====================

/**
 * Complete example of casting to Samsung TV:
 *
 * @example
 * import {
 *   startService,
 *   discoverDevices,
 *   castToDevice,
 *   findSamsungTV,
 *   controlPlayback,
 *   ByronEmitter,
 *   deviceFoundEventName
 * } from 'react-native-dlna-player';
 *
 * // 1. Start DLNA service
 * startService('My React Native App');
 *
 * // 2. Listen for device discovery events (optional)
 * ByronEmitter.addListener(deviceFoundEventName, (device) => {
 *   console.log('New device found:', device.name);
 * });
 *
 * // 3. Discover devices
 * const devices = await discoverDevices();
 * console.log(`Found ${devices.length} devices`);
 *
 * // 4. Find Samsung TV
 * const samsungTV = findSamsungTV(devices);
 *
 * if (!samsungTV) {
 *   alert('No Samsung TV found on network');
 *   return;
 * }
 *
 * // 5. Cast video to Samsung TV
 * try {
 *   await castToDevice(
 *     samsungTV.id,
 *     'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
 *     'Big Buck Bunny'
 *   );
 *   console.log('Video casting to Samsung TV!');
 *
 *   // 6. Control playback
 *   setTimeout(() => controlPlayback(samsungTV.id, 'pause'), 10000); // Pause after 10s
 *   setTimeout(() => controlPlayback(samsungTV.id, 'play'), 15000);  // Resume after 15s
 *
 * } catch (error) {
 *   console.error('Failed to cast:', error);
 * }
 */
