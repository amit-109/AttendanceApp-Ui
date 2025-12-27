import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

export default function LeaveHistoryScreen() {
  const [leaveData, setLeaveData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadLeaveHistory();
  }, []);

  const loadLeaveHistory = async () => {
    try {
      const data = await apiService.getLeaveHistory();
      setLeaveData(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load leave history');
      console.error('Error loading leave history:', error);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return '#16a34a';
      case 'rejected':
        return '#dc2626';
      case 'pending':
        return '#ea580c';
      default:
        return '#6b7280';
    }
  };

  const getLeaveTypeLabel = (type) => {
    const types = {
      sick: 'Sick Leave',
      casual: 'Casual Leave',
      annual: 'Annual Leave',
      maternity: 'Maternity Leave',
      paternity: 'Paternity Leave',
      other: 'Other',
    };
    return types[type] || type;
  };

  const renderLeaveItem = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text variant="titleMedium" style={styles.leaveType}>
          {getLeaveTypeLabel(item.leaveType)}
        </Text>
        <Text variant="labelSmall" style={[styles.status, { color: getStatusColor(item.status) }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>

      <View style={styles.dateContainer}>
        <View style={styles.dateItem}>
          <MaterialIcons name="date-range" size={16} color="#6b7280" />
          <Text variant="bodySmall" style={styles.dateText}>
            From: {formatDate(item.startDate)}
          </Text>
        </View>
        <View style={styles.dateItem}>
          <MaterialIcons name="date-range" size={16} color="#6b7280" />
          <Text variant="bodySmall" style={styles.dateText}>
            To: {formatDate(item.endDate)}
          </Text>
        </View>
      </View>

      <Text variant="bodyMedium" style={styles.reason}>
        {item.reason}
      </Text>

      {item.comments && (
        <View style={styles.commentsContainer}>
          <MaterialIcons name="comment" size={16} color="#6b7280" />
          <Text variant="bodySmall" style={styles.comments}>
            {item.comments}
          </Text>
        </View>
      )}

      <Text variant="bodySmall" style={styles.appliedDate}>
        Applied on: {formatDate(item.createdAt)}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" />
          <Text variant="bodyLarge" style={styles.loadingText}>Loading leave history...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Leave History
        </Text>

        <Text variant="bodyMedium" style={styles.welcome}>
          Welcome, {user?.name}
        </Text>

        {leaveData.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="beach-access" size={48} color="#9CA3AF" />
            <Text variant="bodyLarge" style={styles.emptyText}>
              No leave requests found
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              Your leave history will appear here once you apply for leave
            </Text>
          </View>
        ) : (
          <FlatList
            data={leaveData}
            keyExtractor={(item) => item._id}
            renderItem={renderLeaveItem}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadLeaveHistory}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#374151',
  },
  welcome: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#6b7280',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 32,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyText: {
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  item: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leaveType: {
    color: '#374151',
  },
  status: {
    fontWeight: 'bold',
  },
  dateContainer: {
    marginBottom: 12,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateText: {
    color: '#6b7280',
    marginLeft: 8,
  },
  reason: {
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
  },
  commentsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  comments: {
    color: '#6b7280',
    marginLeft: 8,
    flex: 1,
    fontStyle: 'italic',
  },
  appliedDate: {
    color: '#9ca3af',
    textAlign: 'right',
  },
});