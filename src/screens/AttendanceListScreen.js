import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, SegmentedButtons, Text } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { isValidLocation, parseDate, transformAttendanceRecords } from '../utils/attendance';

const SURFACE = '#f4f8f5';
const CARD = '#ffffff';
const PRIMARY = '#1f8f55';
const PRIMARY_DARK = '#0d5c3d';
const CHECK_OUT = '#f97316';
const TEXT = '#14213d';
const MUTED = '#6b7280';
const BORDER = '#d9e5dc';

export default function AttendanceListScreen() {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('all');
  const { user, cachedData, updateCachedAttendanceData, loading: authLoading } = useAuth();

  useEffect(() => {
    if (user && !authLoading) {
      setAttendanceData(cachedData.attendanceData || []);
      setLoading(false);
    }
  }, [user, authLoading, cachedData.attendanceData]);

  const loadAttendanceHistory = async (showLoading = true) => {
    if (showLoading) {
      setRefreshing(true);
    }

    try {
      const data = user.role === 1
        ? await apiService.getAttendanceHistory()
        : await apiService.getAttendanceByUserId(user.user_id || user.id);

      if (!Array.isArray(data)) {
        if (showLoading) {
          setAttendanceData([]);
        }
        return;
      }

      const transformedData = transformAttendanceRecords(data, user, (path) => apiService.getMediaUrl(path));
      setAttendanceData(transformedData);
      await updateCachedAttendanceData(transformedData);
    } catch (error) {
      if (error.message && error.message.includes('No attendance found')) {
        const emptyData = [];
        setAttendanceData(emptyData);
        await updateCachedAttendanceData(emptyData);
      } else if (showLoading) {
        Alert.alert('Error', 'Failed to load attendance history');
        console.error('Error loading attendance:', error);
        setAttendanceData([]);
      }
    } finally {
      if (showLoading) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const onRefresh = () => {
    loadAttendanceHistory(true);
  };

  const formatDate = (value) => {
    const date = parseDate(value);
    if (!date) return 'Unknown date';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (value) => {
    const date = parseDate(value);
    if (!date) return 'Not marked';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusMeta = (status) => {
    switch (status) {
      case 'completed':
        return { label: 'Completed', color: PRIMARY_DARK, backgroundColor: '#dbf5e5' };
      case 'present':
        return { label: 'Checked In', color: PRIMARY, backgroundColor: '#e8f8ef' };
      default:
        return { label: 'No Record', color: MUTED, backgroundColor: '#eef2f4' };
    }
  };

  const openMap = async (location) => {
    if (!isValidLocation(location)) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      Linking.openURL(url);
    }
  };

  const renderLocation = (location) => {
    if (!isValidLocation(location)) {
      return (
        <View style={styles.metaRow}>
          <MaterialIcons name="location-on" size={16} color={MUTED} />
          <Text style={styles.metaText}>Location not available</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity onPress={() => openMap(location)} activeOpacity={0.85} style={styles.locationButton}>
        <MaterialIcons name="location-on" size={16} color="#0f766e" />
        <Text style={styles.locationButtonText}>
          {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPhoto = (photo) => (
    photo ? (
      <Image
        source={{ uri: photo }}
        style={styles.eventPhoto}
        resizeMode="cover"
        onError={(event) => {
          console.log('Attendance photo load failed:', photo, event?.nativeEvent?.error);
        }}
      />
    ) : (
      <View style={styles.photoPlaceholder}>
        <MaterialIcons name="photo-camera" size={20} color="#9ca3af" />
        <Text style={styles.photoPlaceholderText}>No photo</Text>
      </View>
    )
  );

  const renderEventCard = (label, icon, accentColor, time, location, photo) => (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={[styles.eventIconWrap, { backgroundColor: `${accentColor}18` }]}>
          <MaterialIcons name={icon} size={20} color={accentColor} />
        </View>
        <View style={styles.eventHeaderText}>
          <Text style={styles.eventLabel}>{label}</Text>
          <Text style={styles.eventTime}>{formatTime(time)}</Text>
        </View>
      </View>

      {renderLocation(location)}
      {renderPhoto(photo)}
    </View>
  );

  const renderAttendanceItem = ({ item }) => {
    const statusMeta = getStatusMeta(item.status);

    return (
      <View style={styles.cardShell}>
        <LinearGradient colors={['#ffffff', '#f7fbf8']} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.date}>{formatDate(item.date || item.checkIn || item.checkOut)}</Text>
              {user.role === 1 && item.employee && (
                <Text style={styles.employeeName}>
                  {item.employee.name} • {item.employee.email}
                </Text>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.backgroundColor }]}>
              <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          </View>

          <View style={styles.timelineRow}>
            {renderEventCard('Check In', 'login', PRIMARY, item.checkIn, item.checkInLocation, item.checkInPhoto)}
            {renderEventCard('Check Out', 'logout', CHECK_OUT, item.checkOut, item.checkOutLocation, item.checkOutPhoto)}
          </View>

          {item.notes ? (
            <View style={styles.noteBox}>
              <MaterialIcons name="notes" size={16} color="#475569" />
              <Text style={styles.noteText}>{item.notes}</Text>
            </View>
          ) : null}
        </LinearGradient>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading attendance history...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1f8f55', '#157347']} style={styles.hero}>
        <Text style={styles.heroEyebrow}>SecuryScope</Text>
        <Text style={styles.heroTitle}>Attendance History</Text>
        <Text style={styles.heroSubtitle}>
          Review daily check-in and check-out time, photo, and location in one place.
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        {user.role === 1 && (
          <SegmentedButtons
            value={viewMode}
            onValueChange={setViewMode}
            buttons={[
              { value: 'all', label: 'All Records' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'employees', label: 'By Employee' },
            ]}
            style={styles.segmentedButtons}
          />
        )}

        {attendanceData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="event-busy" size={64} color="#9CA3AF" />
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              No Attendance Records
            </Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              No attendance records were found yet for this account.
            </Text>
          </View>
        ) : (
          <FlatList
            data={attendanceData}
            renderItem={renderAttendanceItem}
            keyExtractor={(item, index) => (item.Id || index).toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SURFACE,
  },
  loadingText: {
    marginTop: 16,
    color: MUTED,
  },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroEyebrow: {
    color: '#d1fae5',
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    color: '#ffffff',
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#d7f7e5',
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  content: {
    flex: 1,
    marginTop: -12,
  },
  segmentedButtons: {
    marginHorizontal: 16,
    marginBottom: 6,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12,
  },
  cardShell: {
    marginBottom: 16,
    borderRadius: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  card: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  date: {
    color: TEXT,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  employeeName: {
    color: MUTED,
    marginTop: 6,
    fontSize: 13,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timelineRow: {
    gap: 12,
  },
  eventCard: {
    borderWidth: 1,
    borderColor: '#e8eeea',
    borderRadius: 18,
    padding: 14,
    backgroundColor: CARD,
    marginBottom: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventHeaderText: {
    flex: 1,
  },
  eventLabel: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
  },
  eventTime: {
    color: MUTED,
    marginTop: 2,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaText: {
    color: MUTED,
    marginLeft: 8,
    fontSize: 13,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ecfeff',
    borderRadius: 999,
    marginBottom: 12,
  },
  locationButtonText: {
    color: '#0f766e',
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  eventPhoto: {
    width: '100%',
    height: 170,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  photoPlaceholder: {
    height: 90,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    color: '#94a3b8',
    marginTop: 6,
    fontSize: 13,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
  },
  noteText: {
    flex: 1,
    color: '#475569',
    marginLeft: 8,
    lineHeight: 19,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: MUTED,
    textAlign: 'center',
  },
});
