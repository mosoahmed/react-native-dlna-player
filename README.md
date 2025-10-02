# react-native-dlna-player

A React Native library for DLNA/UPnP media casting. Cast videos to smart TVs (Samsung, LG, Sony, etc.) and discover DLNA devices on your network.

## Features

- 📺 **DLNA Casting**: Cast videos to smart TVs and DLNA-enabled devices
- 🔍 **Device Discovery**: Automatically discover DLNA MediaRenderers on your network
- 🎮 **Playback Control**: Control playback (play, pause, stop) on remote devices
- 🔄 **Auto-Retry**: Automatic retry logic with exponential backoff for reliable casting
- 📊 **Progress Events**: Real-time casting progress notifications (connecting, buffering, playing)
- 🌐 **HLS Support**: Stream HLS videos to Samsung Smart TVs and compatible devices
- ✨ **TypeScript**: Full TypeScript definitions included

## Installation

Install directly from GitHub:

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

### 2. HLS Streaming to Samsung TV

```javascript
import React, { useEffect, useState } from 'react';
import { View, Button, Text, Alert } from 'react-native';
import {
  startService,
  discoverDevices,
  castToDevice,
  findSamsungTV,
  ByronEmitter,
  castProgressEventName,
} from '@byron-react-native/dlna-player';

export default function HLSStreamingExample() {
  const [samsungTV, setSamsungTV] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    startService('HLS Streaming App');

    // Listen for casting progress
    const progressListener = ByronEmitter.addListener(
      castProgressEventName,
      (event) => {
        setProgress(`${event.stage}: ${event.message}`);
        console.log('Cast progress:', event);
      }
    );

    // Auto-discover Samsung TV
    discoverDevices().then((devices) => {
      const tv = findSamsungTV(devices);
      if (tv) {
        setSamsungTV(tv);
        Alert.alert('Samsung TV Found', tv.name);
      }
    });

    return () => {
      progressListener.remove();
    };
  }, []);

  const streamHLS = async () => {
    if (!samsungTV) {
      Alert.alert('Error', 'No Samsung TV found');
      return;
    }

    setIsStreaming(true);

    try {
      // HLS live stream example
      await castToDevice(
        samsungTV.id,
        'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        'HLS Live Stream'
      );

      Alert.alert('Success', 'HLS stream started on Samsung TV!');
    } catch (error) {
      console.error('HLS streaming error:', error);
      Alert.alert('Error', `Failed to stream: ${error.message}`);
    } finally {
      setIsStreaming(false);
    }
  };

  const streamVOD = async () => {
    if (!samsungTV) return;

    setIsStreaming(true);

    try {
      // HLS VOD example
      await castToDevice(
        samsungTV.id,
        'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
        'Apple HLS Demo'
      );

      Alert.alert('Success', 'HLS VOD started!');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
        HLS Streaming to Samsung TV
      </Text>

      {samsungTV ? (
        <Text style={{ marginBottom: 20 }}>
          Connected to: {samsungTV.name}
        </Text>
      ) : (
        <Text style={{ marginBottom: 20, color: 'red' }}>
          No Samsung TV found
        </Text>
      )}

      {progress && (
        <Text style={{ marginBottom: 20, color: 'blue' }}>
          Status: {progress}
        </Text>
      )}

      <Button
        title="Stream HLS Live"
        onPress={streamHLS}
        disabled={!samsungTV || isStreaming}
      />

      <View style={{ height: 10 }} />

      <Button
        title="Stream HLS VOD"
        onPress={streamVOD}
        disabled={!samsungTV || isStreaming}
      />

      <Text style={{ marginTop: 20, fontSize: 12, color: '#666' }}>
        Note: HLS streaming requires Samsung Smart TV 2018+ or compatible DLNA device
      </Text>
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
- HLS (.m3u8) on compatible DLNA devices

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


## TypeScript Support

Full TypeScript definitions are included:

```typescript
import {
  DLNADevice,
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

- HLS format may not be supported by all DLNA devices
- Try MP4/AVI formats for broader compatibility

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