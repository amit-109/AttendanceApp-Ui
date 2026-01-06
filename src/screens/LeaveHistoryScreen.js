import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

export default function LeaveHistoryScreen() {
  const [leaveData, setLeaveData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, cachedData, updateCachedLeaveData, loading: authLoading } = useAuth();

  useEffect(() => {
    if (user && !authLoading) {
      // Use cached data (already refreshed by AuthContext on app launch)
      setLeaveData(cachedData.leaveData || []);
      setLoading(false);
    }
  }, [user, authLoading, cachedData.leaveData]);

  const loadLeaveHistory = async (showLoading = true) => {
    if (showLoading) {
      setRefreshing(true);
    }

    try {
      const data = await apiService.getLeaveHistory();
      setLeaveData(data);
      // Cache the data
      await updateCachedLeaveData(data);
    } catch (error) {
      // Handle "No leaves found" as valid empty result for both background and user refresh
      if (error.message && (error.message.includes('No leaves found') || error.message.includes('No data found'))) {
        console.log('Treating leave error as empty data');
        const emptyData = [];
        setLeaveData(emptyData);
        await updateCachedLeaveData(emptyData);
      } else if (showLoading) {
        Alert.alert('Error', 'Failed to load leave history');
        console.error('Error loading leave history:', error);
      } else {
        // For background refresh, silently handle other errors
        console.log('Background leave refresh failed silently:', error.message);
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
    loadLeaveHistory(true);
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
    switch (status?.toLowerCase()) {
      case 'approved':
        return '#16a34a';
      case 'rejected':
        return '#dc2626';
      case 'applied':
      case 'pending':
        return '#ea580c';
      default:
        return '#6b7280';
    }
  };

  const getLeaveTypeLabel = (type) => {
    // Backend returns leave type name directly
    return type || 'Leave';
  };

  const renderLeaveItem = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text variant="titleMedium" style={styles.leaveType}>
          {getLeaveTypeLabel(item.LeaveType)}
        </Text>
        <Text variant="labelSmall" style={[styles.status, { color: getStatusColor(item.ApprovalStatus) }]}>
          {item.ApprovalStatus?.toUpperCase()}
        </Text>
      </View>

      <View style={styles.dateContainer}>
        <View style={styles.dateItem}>
          <MaterialIcons name="date-range" size={16} color="#6b7280" />
          <Text variant="bodySmall" style={styles.dateText}>
            From: {formatDate(item.DateFrom)}
          </Text>
        </View>
        <View style={styles.dateItem}>
          <MaterialIcons name="date-range" size={16} color="#6b7280" />
          <Text variant="bodySmall" style={styles.dateText}>
            To: {formatDate(item.DateTo)}
          </Text>
        </View>
      </View>

      <Text variant="bodyMedium" style={styles.reason}>
        {item.LeaveReason}
      </Text>

      {item.Comments && (
        <View style={styles.commentsContainer}>
          <MaterialIcons name="comment" size={16} color="#6b7280" />
          <Text variant="bodySmall" style={styles.comments}>
            {item.Comments}
          </Text>
        </View>
      )}

      <Text variant="bodySmall" style={styles.appliedDate}>
        Applied on: {formatDate(item.DateCreated)}
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
            keyExtractor={(item, index) => (item._id || item.id || index).toString()}
            renderItem={renderLeaveItem}
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
