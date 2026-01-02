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
  const [attendanceDirection, setAttendanceDirection] = useState('IN');
  const cameraRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    // Only load status if user is authenticated and has a token
    if (user && user.id) {
      loadTodayStatus();
    }
  }, [user]);

  const loadTodayStatus = async () => {
    try {
      if (!user) return;
      
      const status = await apiService.getTodayAttendanceStatus();
      setTodayStatus(status);
      
      // Determine next action based on today's records
      if (status) {
        if (status.hasCheckedIn && !status.hasCheckedOut) {
          setAttendanceDirection('OUT');
        } else if (status.hasCheckedIn && status.hasCheckedOut) {
          // Both check-in and check-out done
          setAttendanceDirection(null);
        } else {
          setAttendanceDirection('IN');
        }
      } else {
        setAttendanceDirection('IN');
      }
    } catch (error) {
      console.error('Error loading today status:', error);
      setAttendanceDirection('IN');
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

  const handleMarkAttendance = async () => {
    if (!photo) {
      Alert.alert('Photo Required', 'Please take a photo for attendance verification.');
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.markAttendance(attendanceDirection, location, photo);
      
      const actionText = attendanceDirection === 'IN' ? 'Checked in' : 'Checked out';
      Alert.alert('Success', `${actionText} successfully!`);
      
      // Update status and reset form
      await loadTodayStatus();
      setPhoto(null);
      setLocation(null);
    } catch (error) {
      Alert.alert('Attendance Failed', error.message);
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

        <View style={styles.statusCard}>
          <Text variant="titleMedium" style={styles.statusTitle}>
            Today's Status
          </Text>
          <Text variant="bodyMedium" style={styles.statusText}>
            {todayStatus ? 
              `Last action: ${todayStatus.direction} at ${new Date(todayStatus.created_at).toLocaleTimeString()}` : 
              'No attendance marked today'
            }
          </Text>
          {attendanceDirection && (
            <Text variant="bodyLarge" style={styles.nextAction}>
              Next Action: {attendanceDirection === 'IN' ? 'Check In' : 'Check Out'}
            </Text>
          )}
          {!attendanceDirection && todayStatus && (
            <Text variant="bodyLarge" style={styles.completedAction}>
              Today's attendance completed ✓
            </Text>
          )}
        </View>

        {attendanceDirection ? (
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
                <Text>Ready to {attendanceDirection === 'IN' ? 'check in' : 'check out'}! Photo and location captured.</Text>
              </View>
            )}

            <Button
              mode="contained"
              onPress={handleMarkAttendance}
              disabled={!photo || !location || loading}
              style={[styles.button, attendanceDirection === 'OUT' ? styles.checkOutButton : styles.checkInButton]}
            >
              {loading ? <ActivityIndicator color="white" /> : 
                attendanceDirection === 'IN' ? 'CHECK IN' : 'CHECK OUT'
              }
            </Button>
          </>
        ) : (
          <View style={styles.completedCard}>
            <MaterialIcons name="check-circle" size={48} color="#059669" />
            <Text variant="titleMedium" style={styles.completedText}>
              You have completed today's attendance!
            </Text>
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
  statusCard: {
    width: '100%',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#374151',
  },
  statusText: {
    color: '#6b7280',
    marginBottom: 4,
  },
  nextAction: {
    fontWeight: 'bold',
    color: '#059669',
  },
  completedAction: {
    fontWeight: 'bold',
    color: '#059669',
  },
  completedCard: {
    width: '100%',
    padding: 24,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    gap: 12,
  },
  completedText: {
    color: '#059669',
    textAlign: 'center',
  },
  checkInButton: {
    backgroundColor: '#059669',
  },
  checkOutButton: {
    backgroundColor: '#dc2626',
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
