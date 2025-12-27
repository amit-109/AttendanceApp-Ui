import { MaterialIcons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

export default function MarkAttendanceScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [todayStatus, setTodayStatus] = useState(null);
  const cameraRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadTodayStatus();
    }
  }, [user]);

  const loadTodayStatus = async () => {
    try {
      const status = await apiService.getTodayStatus();
      setTodayStatus(status);
    } catch (error) {
      console.error('Error loading today status:', error);
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    if (status === 'granted') {
      setShowCamera(true);
    } else {
      Alert.alert('Camera permission required', 'Please enable camera permission to take attendance photos.');
    }
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photoData = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: false,
        });
        setPhoto(photoData.uri);
        setShowCamera(false);
        Alert.alert('Success', 'Photo captured successfully');
      } catch (error) {
        Alert.alert('Error', 'Failed to capture photo');
      }
    }
  };

  const getLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location permission required', 'Please enable location permission for attendance tracking.');
      return;
    }
    let loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
    Alert.alert('Success', 'Location captured');
  };

  const handleCheckIn = async () => {
    if (!photo) {
      Alert.alert('Photo Required', 'Please take a photo for attendance verification.');
      return;
    }

    setLoading(true);
    try {
      // Convert photo to base64
      let photoData = null;
      if (photo) {
        const response = await fetch(photo);
        const blob = await response.blob();
        photoData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }

      const result = await apiService.checkIn(location, photoData);
      Alert.alert('Success', 'Checked in successfully!');
      setTodayStatus({ status: 'checked_in', attendance: result.attendance });
      // Reset for next check-in
      setPhoto(null);
      setLocation(null);
    } catch (error) {
      Alert.alert('Check-in Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      const result = await apiService.checkOut();
      Alert.alert('Success', 'Checked out successfully!');
      setTodayStatus({ status: 'checked_out', attendance: result.attendance });
    } catch (error) {
      Alert.alert('Check-out Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraControls}>
            <TouchableOpacity
              onPress={() => setShowCamera(false)}
              style={styles.cameraButton}
            >
              <MaterialIcons name="close" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={takePhoto}
              style={[styles.cameraButton, styles.captureButton]}
            >
              <MaterialIcons name="camera" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Mark Attendance
        </Text>

        <Text variant="bodyLarge" style={styles.welcome}>
          Welcome, {user?.name}
        </Text>

        {!todayStatus || todayStatus.status === 'not_checked_in' ? (
          <>
            <Button
              mode="contained"
              onPress={requestCameraPermission}
              disabled={!!photo}
              icon="camera"
              style={styles.button}
            >
              {photo ? 'Photo Captured ✓' : 'Take Attendance Photo'}
            </Button>

            <Button
              mode="contained"
              onPress={getLocation}
              disabled={!!location}
              icon="map-marker"
              style={styles.button}
            >
              {location ? 'Location Captured ✓' : 'Get Location'}
            </Button>

            {photo && location && (
              <View style={styles.alert}>
                <Text>Ready to check in! Photo and location captured.</Text>
              </View>
            )}

            <Button
              mode="contained"
              onPress={handleCheckIn}
              disabled={!photo || !location || loading}
              style={styles.button}
            >
              {loading ? <ActivityIndicator color="white" /> : 'CHECK IN'}
            </Button>
          </>
        ) : todayStatus.status === 'checked_in' ? (
          <>
            <View style={styles.alert}>
              <Text>You are currently checked in. Ready to check out?</Text>
            </View>

            <Button
              mode="contained"
              onPress={handleCheckOut}
              disabled={loading}
              style={styles.button}
            >
              {loading ? <ActivityIndicator color="white" /> : 'CHECK OUT'}
            </Button>
          </>
        ) : (
          <View style={styles.alert}>
            <Text>You have completed today's attendance!</Text>
          </View>
        )}

        <Button
          mode="outlined"
          onPress={() => navigation.navigate('AttendanceList')}
          style={styles.button}
        >
          View Attendance History
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 24,
  },
  title: {
    color: '#374151',
  },
  welcome: {
    color: '#6b7280',
    textAlign: 'center',
  },
  button: {
    width: '100%',
  },
  alert: {
    width: '100%',
    padding: 12,
    backgroundColor: '#d1fae5',
    borderRadius: 8,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  cameraButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    backgroundColor: '#4CAF50',
  },
});
