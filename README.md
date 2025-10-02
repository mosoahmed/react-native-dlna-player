# react-native-dlna-player

A React Native library for DLNA/UPnP media casting and VLC-based video playback. Cast videos to smart TVs (Samsung, LG, Sony, etc.), discover DLNA devices on your network, and play media with advanced VLC player support.

## Features

- 📺 **DLNA Casting**: Cast videos to smart TVs and DLNA-enabled devices
- 🔍 **Device Discovery**: Automatically discover DLNA MediaRenderers on your network
- 🎮 **Playback Control**: Control playback (play, pause, stop) on remote devices
- 📱 **DLNA Renderer**: Turn your phone into a DLNA MediaRenderer to receive casts
- 🎬 **VLC Player**: Embedded VLC player for local video playback with advanced controls
- 🔄 **Auto-Retry**: Automatic retry logic with exponential backoff for reliable casting
- 📊 **Progress Events**: Real-time casting progress notifications (connecting, buffering, playing)
- 🌐 **HLS Support**: Stream HLS videos to Samsung Smart TVs (2018+)
- ✨ **TypeScript**: Full TypeScript definitions included

## Installation

### From npm

```bash
npm install @byron-react-native/dlna-player --save
# or
yarn add @byron-react-native/dlna-player
```

### From GitHub (Enhanced Fork)

To install the enhanced version with full DLNA casting features directly from GitHub:

```bash
npm install github:mosoahmed/react-native-dlna-player
# or
yarn add github:mosoahmed/react-native-dlna-player
```

Or add to your `package.json`:

```json
{
  "dependencies": {
    "@byron-react-native/dlna-player": "github:mosoahmed/react-native-dlna-player"
  }
}
```

You can also specify a specific branch or commit:

```bash
npm install github:mosoahmed/react-native-dlna-player#main
npm install github:mosoahmed/react-native-dlna-player#f23a4ff
```

### React Native 0.60+

Linking is automatic. Run pod install for iOS:

```bash
cd ios && pod install && cd ..
```

### React Native < 0.60

```bash
react-native link react-native-dlna-player
```

## Quick Start

### 1. Basic DLNA Casting to Samsung TV

```javascript
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import {
  startService,
  closeService,
  discoverDevices,
  castToDevice,
  findSamsungTV,
  controlPlayback,
  ByronEmitter,
  deviceFoundEventName,
} from '@byron-react-native/dlna-player';

export default function App() {
  const [devices, setDevices] = useState([]);
  const [samsungTV, setSamsungTV] = useState(null);

  useEffect(() => {
    // Start DLNA service
    startService('My DLNA App');

    // Listen for device discovery
    const listener = ByronEmitter.addListener(deviceFoundEventName, (device) => {
      console.log('Found device:', device.name);
      setDevices((prev) => [...prev, device]);
    });

    return () => {
      listener.remove();
      closeService();
    };
  }, []);

  const handleDiscover = async () => {
    const foundDevices = await discoverDevices();
    setDevices(foundDevices);

    // Auto-find Samsung TV
    const samsung = findSamsungTV(foundDevices);
    if (samsung) {
      setSamsungTV(samsung);
      console.log('Found Samsung TV:', samsung.name);
    }
  };

  const handleCast = async () => {
    if (!samsungTV) {
      alert('No Samsung TV found');
      return;
    }

    try {
      await castToDevice(
        samsungTV.id,
        'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        'Big Buck Bunny'
      );
      alert('Video is now playing on your TV!');
    } catch (error) {
      console.error('Cast failed:', error);
      alert(`Failed to cast: ${error.message}`);
    }
  };

  const handleControl = async (action) => {
    if (samsungTV) {
      await controlPlayback(samsungTV.id, action);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Button title="Discover Devices" onPress={handleDiscover} />
      <Text>Found {devices.length} devices</Text>
      {samsungTV && <Text>Samsung TV: {samsungTV.name}</Text>}

      <Button title="Cast Video" onPress={handleCast} disabled={!samsungTV} />

      <View style={{ flexDirection: 'row', marginTop: 20 }}>
        <Button title="Play" onPress={() => handleControl('play')} />
        <Button title="Pause" onPress={() => handleControl('pause')} />
        <Button title="Stop" onPress={() => handleControl('stop')} />
      </View>
    </View>
  );
}
```

### 2. VLC Player for Local Playback

```javascript
import React, { useRef } from 'react';
import { View, Button } from 'react-native';
import { ByronPlayer, EventType } from '@byron-react-native/dlna-player';

export default function VlcPlayerExample() {
  const playerRef = useRef(null);

  const handlePlay = () => {
    playerRef.current?.setNativeProps({ paused: false });
  };

  const handlePause = () => {
    playerRef.current?.setNativeProps({ paused: true });
  };

  return (
    <View style={{ flex: 1 }}>
      <ByronPlayer
        ref={playerRef}
        source={{
          uri: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
          options: ['--rtsp-tcp', '-vvv'],
        }}
        style={{ width: '100%', height: 300 }}
        paused={false}
        volume={100}
        onPlaying={(event) => {
          console.log('Playing:', event.currentTime, '/', event.duration);
        }}
        onProgress={(event) => {
          console.log('Progress:', event.position);
        }}
        onError={() => console.error('Playback error')}
        onEndReached={() => console.log('Video ended')}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 }}>
        <Button title="Play" onPress={handlePlay} />
        <Button title="Pause" onPress={handlePause} />
      </View>
    </View>
  );
}
```

## API Reference

### DLNA Casting Functions

#### `startService(serviceName: string): void`

Starts the DLNA service and makes your device discoverable.

```javascript
startService('My DLNA App');
```

#### `closeService(): void`

Stops the DLNA service.

```javascript
closeService();
```

#### `discoverDevices(): Promise<DLNADevice[]>`

Discovers DLNA MediaRenderer devices on the network.

```javascript
const devices = await discoverDevices();
console.log(devices);
// [
//   {
//     id: 'uuid:12345-6789-...',
//     name: '[TV] Samsung 7 Series (55)',
//     manufacturer: 'Samsung Electronics',
//     modelName: 'UE55NU7400',
//     modelDescription: 'Samsung TV NS',
//   }
// ]
```

#### `castToDevice(deviceId: string, videoUrl: string, title?: string): Promise<boolean>`

Casts a video to a DLNA device with automatic retry (3 attempts, 30s timeout per attempt).

**Supported formats:**
- MP4, AVI, MKV, MOV
- HLS (.m3u8) on Samsung Smart TVs (2018+)

```javascript
try {
  await castToDevice(
    'uuid:12345-6789-...',
    'http://example.com/video.mp4',
    'My Video Title'
  );
} catch (error) {
  if (error.code === 'MAX_RETRIES_EXCEEDED') {
    console.error('Failed after 3 attempts');
  } else if (error.code === 'TIMEOUT') {
    console.error('Operation timed out');
  }
}
```

**Error codes:**
- `INVALID_URL` - URL is not valid
- `DEVICE_NOT_FOUND` - Device not available
- `TIMEOUT` - Operation timed out (30s)
- `MAX_RETRIES_EXCEEDED` - Failed after 3 attempts
- `CAST_FAILED` - Generic casting failure

#### `controlPlayback(deviceId: string, action: 'play' | 'pause' | 'stop'): Promise<boolean>`

Controls playback on a remote device.

```javascript
await controlPlayback(deviceId, 'play');
await controlPlayback(deviceId, 'pause');
await controlPlayback(deviceId, 'stop');
```

### Helper Functions

#### `findSamsungTV(devices: DLNADevice[]): DLNADevice | null`

Finds the first Samsung TV in a device list.

```javascript
const devices = await discoverDevices();
const samsungTV = findSamsungTV(devices);
```

#### `filterDevices(devices: DLNADevice[], filter: { manufacturer?: string, name?: string }): DLNADevice[]`

Filters devices by manufacturer or name.

```javascript
const samsungDevices = filterDevices(devices, { manufacturer: 'Samsung' });
const tvs = filterDevices(devices, { name: 'TV' });
```

### Events

#### `ByronEmitter: NativeEventEmitter`

Event emitter for DLNA events.

```javascript
import { ByronEmitter, deviceFoundEventName, deviceLostEventName, dlnaEventName, castProgressEventName } from '@byron-react-native/dlna-player';

// Device discovered
ByronEmitter.addListener(deviceFoundEventName, (device) => {
  console.log('New device:', device.name);
});

// Device lost
ByronEmitter.addListener(deviceLostEventName, ({ id }) => {
  console.log('Device lost:', id);
});

// Incoming DLNA media (when phone acts as renderer)
ByronEmitter.addListener(dlnaEventName, (event) => {
  console.log('Received media:', event.title, event.url);
});

// Casting progress notifications
ByronEmitter.addListener(castProgressEventName, (progress) => {
  console.log(`${progress.stage}: ${progress.message}`);
  // Stages: 'connecting', 'buffering', 'playing'
});
```

### VLC Player Component

#### `<ByronPlayer>`

VLC-based video player component.

**Props:**

```typescript
interface VlcProps {
  source: {
    uri: string;
    options?: string[]; // VLC options (default: ['--rtsp-tcp', '-vvv'])
  };
  style?: ViewStyle;
  paused?: boolean;
  volume?: number; // 0-100
  rate?: ScaleType; // Video scaling
  time?: number; // Seek to time (ms)
  aspectRatio?: string;

  // Event callbacks
  onPlaying?: (event: VlcEvent) => void;
  onPaused?: () => void;
  onStopped?: () => void;
  onBuffering?: () => void;
  onError?: () => void;
  onEndReached?: () => void;
  onProgress?: (event: VlcEvent) => void;
}

interface VlcEvent {
  currentTime: number; // milliseconds
  duration: number; // milliseconds
  position: number; // 0.0 - 1.0
  type: EventType;
}
```

**Example:**

```javascript
<ByronPlayer
  ref={playerRef}
  source={{ uri: 'http://example.com/video.mp4' }}
  style={{ width: '100%', height: 300 }}
  paused={false}
  volume={50}
  rate={ScaleType.SURFACE_BEST_FIT}
  onPlaying={(e) => console.log(`Playing: ${e.currentTime}ms / ${e.duration}ms`)}
  onProgress={(e) => console.log(`Progress: ${(e.position * 100).toFixed(1)}%`)}
/>
```

**Scale Types:**

```javascript
ScaleType.SURFACE_BEST_FIT
ScaleType.SURFACE_FIT_SCREEN
ScaleType.SURFACE_FILL
ScaleType.SURFACE_16_9
ScaleType.SURFACE_4_3
ScaleType.SURFACE_ORIGINAL
```

**Control playback:**

```javascript
const playerRef = useRef(null);

// Play
playerRef.current?.setNativeProps({ paused: false });

// Pause
playerRef.current?.setNativeProps({ paused: true });

// Seek to 30 seconds
playerRef.current?.setNativeProps({ time: 30000 });

// Set volume to 75%
playerRef.current?.setNativeProps({ volume: 75 });

// Change aspect ratio
playerRef.current?.setNativeProps({ rate: ScaleType.SURFACE_16_9 });
```

### Utility Functions

#### `isInstalledApp(bundleId: string): Promise<boolean>`

Checks if an app is installed (iOS/Android).

```javascript
const hasVLC = await isInstalledApp('org.videolan.vlc');
```

#### `startApp(bundleId: string): void`

Launches an external app.

```javascript
startApp('org.videolan.vlc');
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import {
  DLNADevice,
  VlcEvent,
  VlcProps,
  ScaleType,
  EventType,
} from '@byron-react-native/dlna-player';
```

## Complete Example

See the [full example](./example/CastingExample.js) for a comprehensive implementation including:
- Device discovery with real-time updates
- Samsung TV auto-detection
- Multiple video casting
- Custom URL casting
- Playback controls
- Status monitoring
- Error handling

## Troubleshooting

### Samsung TV not discovered

1. Ensure TV and phone are on the same WiFi network
2. Enable DLNA/AllShare on your Samsung TV (Settings → General → External Device Manager → Device Connect Manager)
3. Restart DLNA service: `closeService()` then `startService()`

### Casting fails with TIMEOUT

- Samsung TVs may take 10-30 seconds to respond
- The library automatically retries 3 times with exponential backoff
- Check if video URL is accessible from your network

### HLS streaming not working

- HLS is only supported on Samsung Smart TVs (2018+)
- Older models may only support MP4/AVI formats

### VLC player shows black screen

- Check if video URL is accessible
- Try different VLC options: `['--rtsp-tcp']` or `[]`
- Listen to `onError` callback for details

## Requirements

- React Native >= 0.60.0
- iOS >= 10.0
- Android >= 5.0 (API 21)

## License

MIT

## Credits

Original library by [Byron](https://github.com/472647301/react-native-dlna-player)

## Screenshots

<img src="https://github.com/472647301/react-native-dlna-player/blob/main/screenshots/ios.png?raw=true" width="360">
<img src="https://github.com/472647301/react-native-dlna-player/blob/main/screenshots/android.png?raw=true" width="375">