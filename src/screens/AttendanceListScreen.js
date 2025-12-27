import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, View } from 'react-native';
import { ActivityIndicator, SegmentedButtons, Text } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

export default function AttendanceListScreen() {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadAttendanceHistory();
    }
  }, [user]);

  const loadAttendanceHistory = async () => {
    try {
      const data = await apiService.getAttendanceHistory(user.role);
      setAttendanceData(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load attendance history');
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
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

  const groupByMonth = (data) => {
    const grouped = {};
    data.forEach(item => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(item);
    });
    return grouped;
  };

  const getMonthlySummary = (monthData) => {
    const totalDays = monthData.length;
    const presentDays = monthData.filter(item => item.status === 'present').length;
    const lateDays = monthData.filter(item => item.status === 'late').length;
    const absentDays = monthData.filter(item => item.status === 'absent').length;
    const workingDays = presentDays + lateDays;

    return {
      totalDays,
      presentDays,
      lateDays,
      absentDays,
      workingDays,
      attendancePercentage: totalDays > 0 ? ((workingDays / totalDays) * 100).toFixed(1) : 0
    };
  };

  const formatMonth = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const renderAttendanceItem = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.itemContent}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="titleMedium" style={styles.date}>
              {formatDate(item.date)}
            </Text>
            {user.role === 'admin' && item.employee && (
              <Text variant="bodySmall" style={styles.employeeName}>
                {item.employee.name} ({item.employee.email})
              </Text>
            )}
          </View>
          <Text variant="labelSmall" style={[styles.status, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
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

        {item.location && (
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
            <Image source={{ uri: item.photo }} style={styles.photo} />
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

  const renderMonthlyItem = ({ item: monthKey }) => {
    const monthData = groupedData[monthKey];
    const summary = getMonthlySummary(monthData);

    return (
      <View style={styles.monthItem}>
        <View style={styles.monthHeader}>
          <Text variant="titleMedium" style={styles.monthTitle}>
            {formatMonth(monthKey)}
          </Text>
          <Text variant="bodyLarge" style={styles.percentage}>
            {summary.attendancePercentage}%
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text variant="headlineSmall" style={styles.statNumber}>{summary.totalDays}</Text>
            <Text variant="bodySmall" style={styles.statLabel}>Total Days</Text>
          </View>
          <View style={styles.stat}>
            <Text variant="headlineSmall" style={[styles.statNumber, { color: '#16a34a' }]}>{summary.presentDays}</Text>
            <Text variant="bodySmall" style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.stat}>
            <Text variant="headlineSmall" style={[styles.statNumber, { color: '#ea580c' }]}>{summary.lateDays}</Text>
            <Text variant="bodySmall" style={styles.statLabel}>Late</Text>
          </View>
          <View style={styles.stat}>
            <Text variant="headlineSmall" style={[styles.statNumber, { color: '#dc2626' }]}>{summary.absentDays}</Text>
            <Text variant="bodySmall" style={styles.statLabel}>Absent</Text>
          </View>
        </View>
      </View>
    );
  };

  const groupedData = groupByMonth(attendanceData);
  const monthKeys = Object.keys(groupedData).sort().reverse(); // Most recent first

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" />
          <Text variant="bodyLarge" style={styles.loadingText}>Loading attendance history...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Attendance History
        </Text>

        <Text variant="bodyMedium" style={styles.welcome}>
          Welcome, {user?.name}
        </Text>

        <SegmentedButtons
          value={viewMode}
          onValueChange={setViewMode}
          buttons={[
            { value: 'all', label: 'All Records' },
            { value: 'monthly', label: 'Monthly View' },
          ]}
          style={styles.segmentedButtons}
        />

        {attendanceData.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="event-note" size={48} color="#9CA3AF" />
            <Text variant="bodyLarge" style={styles.emptyText}>
              No attendance records found
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              Your attendance history will appear here once you start marking attendance
            </Text>
          </View>
        ) : viewMode === 'monthly' ? (
          <FlatList
            data={monthKeys}
            keyExtractor={(item) => item}
            renderItem={renderMonthlyItem}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadAttendanceHistory}
          />
        ) : (
          <FlatList
            data={attendanceData}
            keyExtractor={(item) => item._id}
            renderItem={renderAttendanceItem}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadAttendanceHistory}
          />
        )}
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
    gap: 16,
  },
  title: {
    textAlign: 'center',
    color: '#374151',
  },
  welcome: {
    textAlign: 'center',
    color: '#6b7280',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#6b7280',
  },
  empty: {
    backgroundColor: '#f3f4f6',
    padding: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    marginTop: 8,
  },
  emptySubtext: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  item: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemContent: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  employeeName: {
    color: '#6b7280',
    marginTop: 2,
  },
  date: {
    color: '#374151',
  },
  status: {
    fontWeight: 'bold',
  },
  times: {
    flexDirection: 'row',
    gap: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: '#6b7280',
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: '#9ca3af',
  },
  photoContainer: {
    marginTop: 8,
  },
  photoLabel: {
    color: '#6b7280',
    marginBottom: 4,
  },
  photo: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  notes: {
    color: '#6b7280',
    fontStyle: 'italic',
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  monthItem: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthTitle: {
    color: '#374151',
  },
  percentage: {
    color: '#16a34a',
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 12,
  },
});
