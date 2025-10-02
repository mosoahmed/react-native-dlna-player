/**
 * Example React Native App - DLNA Casting to Samsung TV
 *
 * This example demonstrates:
 * 1. Starting DLNA service
 * 2. Discovering devices on network
 * 3. Finding Samsung TV
 * 4. Casting video to Samsung TV
 * 5. Controlling playback (play/pause/stop)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';

import {
  startService,
  closeService,
  discoverDevices,
  castToDevice,
  controlPlayback,
  findSamsungTV,
  filterDevices,
  ByronEmitter,
  deviceFoundEventName,
  deviceLostEventName,
  dlnaEventName,
} from 'react-native-dlna-player';

const SAMPLE_VIDEOS = [
  {
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: 'Big Buck Bunny',
  },
  {
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    title: 'Elephants Dream',
  },
  {
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    title: 'For Bigger Blazes',
  },
];

export default function CastingExample() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [serviceStarted, setServiceStarted] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [castingStatus, setCastingStatus] = useState('');

  useEffect(() => {
    // Start DLNA service on mount
    initializeDLNA();

    // Listen for device discovery events
    const deviceFoundListener = ByronEmitter.addListener(
      deviceFoundEventName,
      (device) => {
        console.log('New device found:', device.name);
        setDevices((prev) => {
          // Avoid duplicates
          if (prev.some((d) => d.id === device.id)) {
            return prev;
          }
          return [...prev, device];
        });
      }
    );

    const deviceLostListener = ByronEmitter.addListener(
      deviceLostEventName,
      ({ id }) => {
        console.log('Device lost:', id);
        setDevices((prev) => prev.filter((d) => d.id !== id));
        if (selectedDevice?.id === id) {
          setSelectedDevice(null);
        }
      }
    );

    // Listen for incoming DLNA media (when phone acts as renderer)
    const dlnaListener = ByronEmitter.addListener(dlnaEventName, (event) => {
      console.log('Received DLNA media:', event);
      Alert.alert(
        'Incoming Media',
        `Received: ${event.title}\nURL: ${event.url}`,
        [{ text: 'OK' }]
      );
    });

    // Cleanup on unmount
    return () => {
      deviceFoundListener.remove();
      deviceLostListener.remove();
      dlnaListener.remove();
      closeService();
    };
  }, []);

  const initializeDLNA = async () => {
    try {
      startService('React Native DLNA App');
      setServiceStarted(true);
      console.log('DLNA service started');

      // Auto-discover devices after 1 second
      setTimeout(() => {
        handleDiscoverDevices();
      }, 1000);
    } catch (error) {
      console.error('Failed to start DLNA service:', error);
      Alert.alert('Error', 'Failed to start DLNA service');
    }
  };

  const handleDiscoverDevices = async () => {
    if (!serviceStarted) {
      Alert.alert('Error', 'DLNA service not started');
      return;
    }

    setIsDiscovering(true);
    try {
      const discoveredDevices = await discoverDevices();
      setDevices(discoveredDevices);

      if (discoveredDevices.length === 0) {
        Alert.alert(
          'No Devices Found',
          'Make sure your TV is on the same WiFi network and DLNA is enabled'
        );
      } else {
        Alert.alert(
          'Discovery Complete',
          `Found ${discoveredDevices.length} device(s)`
        );

        // Auto-select Samsung TV if found
        const samsung = findSamsungTV(discoveredDevices);
        if (samsung) {
          setSelectedDevice(samsung);
        }
      }
    } catch (error) {
      console.error('Discovery error:', error);
      Alert.alert('Discovery Error', error.message);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleCastVideo = async (videoUrl, title) => {
    if (!selectedDevice) {
      Alert.alert('No Device Selected', 'Please select a device first');
      return;
    }

    setIsCasting(true);
    setCastingStatus(`Casting "${title}" to ${selectedDevice.name}...`);

    try {
      await castToDevice(selectedDevice.id, videoUrl, title);
      setCastingStatus(`✓ Now playing on ${selectedDevice.name}`);
      Alert.alert(
        'Success',
        `Video is now playing on ${selectedDevice.name}!`
      );
    } catch (error) {
      console.error('Casting error:', error);
      setCastingStatus(`✗ Failed to cast: ${error.message}`);
      Alert.alert('Casting Error', error.message);
    } finally {
      setIsCasting(false);
    }
  };

  const handleControl = async (action) => {
    if (!selectedDevice) {
      Alert.alert('No Device Selected', 'Please select a device first');
      return;
    }

    try {
      await controlPlayback(selectedDevice.id, action);
      setCastingStatus(`✓ ${action.toUpperCase()} command sent`);
    } catch (error) {
      console.error('Control error:', error);
      Alert.alert('Control Error', error.message);
    }
  };

  const handleCastCustomUrl = async () => {
    if (!customUrl) {
      Alert.alert('Error', 'Please enter a video URL');
      return;
    }

    await handleCastVideo(customUrl, 'Custom Video');
  };

  const renderDevice = ({ item }) => {
    const isSelected = selectedDevice?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.deviceCard, isSelected && styles.deviceCardSelected]}
        onPress={() => setSelectedDevice(item)}
      >
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{item.name}</Text>
          <Text style={styles.deviceDetail}>{item.manufacturer}</Text>
          <Text style={styles.deviceDetail}>{item.modelName}</Text>
        </View>
        {isSelected && <Text style={styles.selectedBadge}>✓ SELECTED</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>DLNA Casting to Samsung TV</Text>
        <Text style={styles.subtitle}>
          {serviceStarted ? '● Service Running' : '○ Service Stopped'}
        </Text>
      </View>

      {/* Discovery Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Discover Devices</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={handleDiscoverDevices}
          disabled={isDiscovering}
        >
          {isDiscovering ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>🔍 Discover Devices</Text>
          )}
        </TouchableOpacity>

        {devices.length > 0 && (
          <View style={styles.devicesContainer}>
            <Text style={styles.devicesTitle}>
              Found {devices.length} device(s):
            </Text>
            <FlatList
              data={devices}
              renderItem={renderDevice}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}
      </View>

      {/* Selected Device Section */}
      {selectedDevice && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Selected Device</Text>
          <View style={styles.selectedDeviceCard}>
            <Text style={styles.selectedDeviceName}>
              {selectedDevice.name}
            </Text>
            <Text style={styles.selectedDeviceInfo}>
              {selectedDevice.manufacturer} - {selectedDevice.modelName}
            </Text>
          </View>
        </View>
      )}

      {/* Sample Videos Section */}
      {selectedDevice && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Cast Sample Videos</Text>
          {SAMPLE_VIDEOS.map((video, index) => (
            <TouchableOpacity
              key={index}
              style={styles.videoButton}
              onPress={() => handleCastVideo(video.url, video.title)}
              disabled={isCasting}
            >
              <Text style={styles.videoButtonText}>
                📺 {video.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Custom URL Section */}
      {selectedDevice && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Cast Custom Video</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter video URL (http://...)"
            value={customUrl}
            onChangeText={setCustomUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={handleCastCustomUrl}
            disabled={isCasting || !customUrl}
          >
            <Text style={styles.buttonText}>🎬 Cast Custom Video</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Playback Controls Section */}
      {selectedDevice && castingStatus.includes('Now playing') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Playback Controls</Text>
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => handleControl('play')}
            >
              <Text style={styles.controlButtonText}>▶️ PLAY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => handleControl('pause')}
            >
              <Text style={styles.controlButtonText}>⏸️ PAUSE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => handleControl('stop')}
            >
              <Text style={styles.controlButtonText}>⏹️ STOP</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Status Section */}
      {castingStatus && (
        <View style={styles.statusSection}>
          <Text style={styles.statusText}>{castingStatus}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  section: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  devicesContainer: {
    marginTop: 15,
  },
  devicesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
  },
  deviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  deviceCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#e8f5e9',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
  },
  deviceDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  selectedBadge: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 12,
  },
  selectedDeviceCard: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  selectedDeviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 5,
  },
  selectedDeviceInfo: {
    fontSize: 14,
    color: '#666',
  },
  videoButton: {
    backgroundColor: '#FF5722',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  videoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    backgroundColor: '#607D8B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusSection: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  statusText: {
    fontSize: 14,
    color: '#333',
  },
});
