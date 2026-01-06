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
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [todayStatus, setTodayStatus] = useState(null);
  const [attendanceDirection, setAttendanceDirection] = useState('IN');
  const cameraRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    // Only load status if user is authenticated and has a token
    if (user && user.id) {
      loadTodayStatus();
      requestPermissions();
    }
  }, [user]);

  const requestPermissions = async () => {
    try {
      // Request camera permission
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(cameraStatus === 'granted');

      // Request location permission
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(locationStatus === 'granted');
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

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



  const takePhotoAndLocation = async () => {
    try {
      // Step 1: Check camera permission
      if (!hasCameraPermission) {
        const { status } = await Camera.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is required to take attendance photos.');
          return null;
        }
        setHasCameraPermission(true);
      }

      // Step 2: Take photo automatically
      setShowCamera(true);

      // Wait for camera to initialize
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (!cameraRef.current) {
        console.error('Camera not available');
        setShowCamera(false);
        Alert.alert('Error', 'Camera not ready. Please try again.');
        return null;
      }

      const photoData = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });

      setShowCamera(false);

      // Step 3: Check location permission
      if (!hasLocationPermission) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Location permission is required to mark attendance.');
          return null;
        }
        setHasLocationPermission(true);
      }

      // Step 4: Get location
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });

      // Return the captured data directly
      return {
        photoUri: photoData.uri,
        locationCoords: loc.coords
      };
    } catch (error) {
      console.error('Capture failed:', error);
      setShowCamera(false);
      Alert.alert('Capture Failed', `Failed to capture photo or location: ${error.message}. Please try again.`);
      return null;
    }
  };

  const handleMarkAttendance = async () => {
    setLoading(true);
    setLoadingMessage('Initializing...');

    try {
      // Automatically take photo and get location
      setLoadingMessage('Capturing photo and location...');
      const capturedData = await takePhotoAndLocation();

      if (!capturedData) {
        setLoading(false);
        setLoadingMessage('');
        return;
      }

      const { photoUri, locationCoords } = capturedData;

      // Validate data
      setLoadingMessage('Validating data...');
      if (!photoUri || !locationCoords) {
        Alert.alert('Validation Error', 'Photo or location data is missing. Please try again.');
        setLoading(false);
        setLoadingMessage('');
        return;
      }

      // Mark attendance
      setLoadingMessage('Marking attendance...');
      const result = await apiService.markAttendance(attendanceDirection, locationCoords, photoUri);

      const actionText = attendanceDirection === 'IN' ? 'Checked in' : 'Checked out';

      // Success feedback
      setLoadingMessage('Success!');
      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert(
        '✅ Attendance Marked',
        `${actionText} successfully at ${new Date().toLocaleTimeString()}!`,
        [{ text: 'OK' }]
      );

      // Update status
      await loadTodayStatus();

    } catch (error) {
      console.error('Attendance error:', error);
      Alert.alert('❌ Attendance Failed', error.message || 'Please try again.');
    } finally {
      setLoading(false);
      setLoadingMessage('');
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
          <Text style={styles.cameraText}>Taking photo...</Text>
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
              onPress={handleMarkAttendance}
              disabled={loading}
              style={[styles.button, attendanceDirection === 'OUT' ? styles.checkOutButton : styles.checkInButton]}
            >
              {loading ? <ActivityIndicator color="white" /> :
                attendanceDirection === 'IN' ? 'CHECK IN' : 'CHECK OUT'
              }
            </Button>

            {loading && loadingMessage && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color="#059669" />
                <Text style={styles.loadingText}>{loadingMessage}</Text>
              </View>
            )}
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
    alignItems: 'center',
  },
  cameraText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingCard: {
    width: '100%',
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0ea5e9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#0ea5e9',
    fontSize: 14,
    fontWeight: '500',
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
