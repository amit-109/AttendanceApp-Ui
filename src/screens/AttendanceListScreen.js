import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, View } from 'react-native';
import { ActivityIndicator, SegmentedButtons, Text } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

export default function AttendanceListScreen() {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('all');
  const { user, cachedData, updateCachedAttendanceData, loading: authLoading } = useAuth();

  useEffect(() => {
    if (user && !authLoading) {
      // Use cached data (already transformed by AuthContext)
      setAttendanceData(cachedData.attendanceData || []);
      setLoading(false);
    }
  }, [user, authLoading, cachedData.attendanceData]);

  const loadAttendanceHistory = async (showLoading = true) => {
    if (showLoading) {
      setRefreshing(true);
    }

    try {
      let data;
      if (user.role === 1) {
        // Admin - get all attendance records
        data = await apiService.getAttendanceHistory();
      } else {
        // Employee - get own attendance records
        data = await apiService.getAttendanceByUserId(user.user_id || user.id);
      }

      if (__DEV__) {
        console.log('Attendance API raw response', data);
      }

      // Ensure data is an array
      if (!Array.isArray(data)) {
        // console.log('API returned non-array data:', data);
        if (showLoading) {
          setAttendanceData([]);
        }
        return;
      }

      // Transform backend data to match frontend expectations
      const transformedData = data.map((record, index) => {
        const rawDate =
          record.AttendanceDate ||
          record.Attendance_Date ||
          record.CreatedAt ||
          record.created_at ||
          record.DateCreated ||
          record.date_created;

        const rawInTime = record.InTime || record.in_time || record.check_in || record.CheckIn;
        const rawOutTime = record.OutTime || record.out_time || record.check_out || record.CheckOut;

        const rawPhoto =
          record.PhotoPath_IN ||
          record.photoPath_IN ||
          record.photo_path_in ||
          record.PhotoPath_OUT ||
          record.photoPath_OUT ||
          record.photo_path_out ||
          record.PhotoPath ||
          record.photo_path ||
          record.Photo ||
          record.photo;

        const date = parseDate(rawDate);
        const checkIn = parseDate(rawInTime);
        const checkOut = parseDate(rawOutTime);

        const location = {
          latitude: parseFloat(record.Latitude || record.latitude || 0),
          longitude: parseFloat(record.Longitude || record.longitude || 0),
        };

        return {
          Id: record.Id || record.id || `${record.UserId || record.user_id || 'user'}_${rawDate || index}`,
          date,
          checkIn,
          checkOut,
          status: checkIn ? 'present' : 'absent',
          location: isValidLocation(location) ? location : null,
          photo: apiService.getMediaUrl(rawPhoto),
          employee: user.role === 1 ? {
            _id: record.UserId || record.user_id,
            name: record.Name || record.UserName || record.user_name || 'Unknown',
            email: record.Email || record.UserEmail || record.user_email || 'unknown@email.com',
          } : null,
          notes: record.Notes || record.notes || null,
        };
      });

      if (__DEV__) {
        console.log('Attendance transformed data:', transformedData);
      }

      setAttendanceData(transformedData);
      // Cache the data
      await updateCachedAttendanceData(transformedData);
    } catch (error) {
      // Handle "No attendance found" as valid empty result
      if (error.message && error.message.includes('No attendance found')) {
        const emptyData = [];
        setAttendanceData(emptyData);
        await updateCachedAttendanceData(emptyData);
      } else if (showLoading) {
        Alert.alert('Error', 'Failed to load attendance history');
        console.error('Error loading attendance:', error);
        setAttendanceData([]);
      }
      // For background refresh, silently handle other errors without logging
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

  const parseDate = (value) => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
      const match = value.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
      if (match) {
        return new Date(Number(match[1]));
      }

      const numericValue = Number(value);
      if (!Number.isNaN(numericValue) && value.trim().length > 0) {
        if (value.trim().length === 10) {
          return new Date(numericValue * 1000);
        }
        return new Date(numericValue);
      }
    }

    if (typeof value === 'number') {
      if (String(value).length === 10) {
        return new Date(value * 1000);
      }
      return new Date(value);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const isValidLocation = (loc) => {
    if (!loc || typeof loc !== 'object') return false;
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return !(lat === 0 && lng === 0);
  };

  const formatDate = (dateString) => {
    const date = parseDate(dateString);
    if (!date) return 'Unknown Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = parseDate(dateString);
    if (!date) return '-';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return '#16a34a';
      case 'late':
        return '#ea580c';
      case 'absent':
        return '#dc2626';
      default:
        return '#6b7280';
    }
  };

  const renderAttendanceItem = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <View style={styles.headerLeft}>
            <Text variant="titleMedium" style={styles.date}>
              {formatDate(item.date)}
            </Text>
            {user.role === 1 && item.employee && (
              <Text variant="bodySmall" style={styles.employeeName}>
                {item.employee.name} ({item.employee.email})
              </Text>
            )}
          </View>
          <Text variant="labelSmall" style={[styles.status, { color: getStatusColor(item.status) }]}>
            {(item.status || 'UNKNOWN').toUpperCase()}
          </Text>
        </View>

        <View style={styles.times}>
          {item.checkIn && (
            <View style={styles.timeRow}>
              <MaterialIcons name="login" size={16} color="#4CAF50" />
              <Text variant="bodySmall" style={styles.timeText}>
                Check-in: {formatTime(item.checkIn)}
              </Text>
            </View>
          )}

          {item.checkOut && (
            <View style={styles.timeRow}>
              <MaterialIcons name="logout" size={16} color="#FF9800" />
              <Text variant="bodySmall" style={styles.timeText}>
                Check-out: {formatTime(item.checkOut)}
              </Text>
            </View>
          )}
        </View>

        {isValidLocation(item.location) && (
          <View style={styles.location}>
            <MaterialIcons name="location-on" size={16} color="#2196F3" />
            <Text variant="bodySmall" style={styles.locationText}>
              {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
            </Text>
          </View>
        )}

        {item.photo && (
          <View style={styles.photoContainer}>
            <Text variant="bodySmall" style={styles.photoLabel}>Attendance Photo:</Text>
            <Image
              source={{ uri: item.photo }}
              style={styles.photo}
              onError={(event) => {
                console.log('Attendance photo load failed:', item.photo, event?.nativeEvent?.error);
              }}
            />
          </View>
        )}

        {item.notes && (
          <Text variant="bodySmall" style={styles.notes}>
            Note: {item.notes}
          </Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading attendance history...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Attendance History
        </Text>
        
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
      </View>

      {attendanceData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="event-busy" size={64} color="#9CA3AF" />
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            No Attendance Records
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            No attendance records found for your account.
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    color: '#6b7280',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  segmentedButtons: {
    marginTop: 8,
  },
  listContainer: {
    padding: 16,
  },
  item: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemContent: {
    padding: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  date: {
    fontWeight: '600',
    color: '#1f2937',
  },
  employeeName: {
    color: '#6b7280',
    marginTop: 4,
  },
  status: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  times: {
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timeText: {
    marginLeft: 8,
    color: '#4b5563',
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    marginLeft: 8,
    color: '#4b5563',
  },
  photoContainer: {
    marginTop: 8,
  },
  photoLabel: {
    color: '#6b7280',
    marginBottom: 4,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  notes: {
    marginTop: 8,
    color: '#6b7280',
    fontStyle: 'italic',
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
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
  },
});
