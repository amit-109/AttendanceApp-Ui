import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, FAB, Modal, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

export default function LeaveManagementScreen() {
  const [leaves, setLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('myLeaves');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  
  // Form state
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  const { user } = useAuth();

  useEffect(() => {
    // Only load data if user is authenticated and has a token
    if (user && user.id) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadData = async () => {
    try {
      if (!user) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const [leavesData, typesData] = await Promise.all([
        apiService.getAttendanceHistory(), // This will include leave data
        apiService.getLeaveTypes()
      ]);
      
      setLeaves(Array.isArray(leavesData) ? leavesData : []);
      setLeaveTypes(Array.isArray(typesData) ? typesData : []);
    } catch (error) {
      console.error('Error loading leave data:', error);
      if (user) {
        Alert.alert('Error', 'Failed to load leave data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async () => {
    if (!selectedLeaveType || !dateFrom || !dateTo || !leaveReason) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setApplyLoading(true);
    try {
      await apiService.applyForLeave({
        leave_type_id: parseInt(selectedLeaveType),
        date_from: dateFrom,
        date_to: dateTo,
        leave_reason: leaveReason
      });

      Alert.alert('Success', 'Leave application submitted successfully');
      setShowApplyModal(false);
      resetForm();
      loadData();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to apply for leave');
    } finally {
      setApplyLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedLeaveType('');
    setDateFrom('');
    setDateTo('');
    setLeaveReason('');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
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

  const renderLeaveItem = ({ item }) => (
    <Card style={styles.leaveCard}>
      <Card.Content>
        <View style={styles.leaveHeader}>
          <View style={styles.leaveInfo}>
            <Text variant="titleMedium">{item.leave_type || 'Leave'}</Text>
            <Text variant="bodySmall" style={styles.dateRange}>
              {formatDate(item.date_from)} - {formatDate(item.date_to)}
            </Text>
          </View>
          <Chip 
            mode="outlined" 
            textStyle={{ color: getStatusColor(item.status) }}
            style={{ borderColor: getStatusColor(item.status) }}
          >
            {item.status || 'Pending'}
          </Chip>
        </View>

        {item.leave_reason && (
          <Text variant="bodyMedium" style={styles.reason}>
            Reason: {item.leave_reason}
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading leave data...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Leave Management
      </Text>

      {leaves.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="event-note" size={48} color="#9CA3AF" />
          <Text variant="bodyLarge" style={styles.emptyText}>
            No leave applications found
          </Text>
          <Text variant="bodySmall" style={styles.emptySubtext}>
            Apply for leave using the + button below
          </Text>
        </View>
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={(item, index) => (item.id || item.Id || index).toString()}
          renderItem={renderLeaveItem}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadData}
          contentContainerStyle={styles.listContainer}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowApplyModal(true)}
      />

      <Portal>
        <Modal
          visible={showApplyModal}
          onDismiss={() => setShowApplyModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="headlineSmall" style={styles.modalTitle}>
            Apply for Leave
          </Text>

          <View style={styles.formContainer}>
            <Text variant="bodyMedium" style={styles.fieldLabel}>
              Leave Type *
            </Text>
            <View style={styles.leaveTypeContainer}>
              {leaveTypes.map((type, index) => (
                <Chip
                  key={type.id || index}
                  mode={selectedLeaveType === (type.id || index).toString() ? 'flat' : 'outlined'}
                  selected={selectedLeaveType === (type.id || index).toString()}
                  onPress={() => setSelectedLeaveType((type.id || index).toString())}
                  style={styles.leaveTypeChip}
                >
                  {type.leave_type}
                </Chip>
              ))}
            </View>

            <TextInput
              label="From Date (YYYY-MM-DD) *"
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="2024-01-15"
              style={styles.input}
            />

            <TextInput
              label="To Date (YYYY-MM-DD) *"
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="2024-01-17"
              style={styles.input}
            />

            <TextInput
              label="Reason *"
              value={leaveReason}
              onChangeText={setLeaveReason}
              multiline
              numberOfLines={3}
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => {
                  setShowApplyModal(false);
                  resetForm();
                }}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleApplyLeave}
                loading={applyLoading}
                disabled={applyLoading}
                style={styles.modalButton}
              >
                Apply
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#374151',
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
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
    padding: 32,
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
  listContainer: {
    paddingBottom: 80,
  },
  leaveCard: {
    marginBottom: 12,
    elevation: 2,
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  leaveInfo: {
    flex: 1,
    marginRight: 12,
  },
  dateRange: {
    color: '#6b7280',
    marginTop: 4,
  },
  employeeName: {
    color: '#9ca3af',
    marginTop: 4,
  },
  reason: {
    color: '#374151',
    marginTop: 8,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#374151',
  },
  formContainer: {
    gap: 16,
  },
  fieldLabel: {
    fontWeight: 'bold',
    color: '#374151',
  },
  leaveTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  leaveTypeChip: {
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'white',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
  },
});