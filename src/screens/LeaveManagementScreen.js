import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, FAB, Modal, Portal, Text, TextInput } from 'react-native-paper';
import Toast from 'react-native-toast-message';
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
  const [dateFrom, setDateFrom] = useState(new Date());
  const [dateTo, setDateTo] = useState(new Date());
  const [leaveReason, setLeaveReason] = useState('');
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);

  const { user, cachedData, loading: authLoading, updateCachedLeaveData } = useAuth();

  useEffect(() => {
    // Only load data if user is authenticated and auth loading is complete
    if (user && user.id && !authLoading) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, authLoading, cachedData.leaveData]);

  const loadData = async (isRefresh = false) => {
    try {
      if (!user) {
        setLoading(false);
        return;
      }

      // For refresh, show loading indicator, for initial load use existing loading state
      if (isRefresh) {
        setLoading(true);
      }

      // Load leave types first (this should work for all authenticated users)
      const typesData = await apiService.getLeaveTypes();
      // console.log('Loaded leave types:', typesData);
      const activeTypes = Array.isArray(typesData) ? typesData.filter(type => type.IsActive === 1) : [];
      // console.log('Filtered active leave types:', activeTypes);
      setLeaveTypes(activeTypes);

      // For refresh or if no cached data, fetch fresh leave data
      if (isRefresh || !cachedData.leaveData || cachedData.leaveData.length === 0) {
        console.log('Fetching fresh leave data for refresh or initial load');
        const leavesData = await apiService.getLeaveHistory();
        console.log('Fetched fresh leave data:', leavesData);

        // Handle leave data based on user role
        let userLeaves = [];
        if (Array.isArray(leavesData)) {
          if (user.role === 1) {
            // Admin sees all leaves
            userLeaves = leavesData;
          } else {
            // Employee sees only their own leaves (should be filtered by backend)
            userLeaves = leavesData;
          }
        }
        setLeaves(userLeaves);

        // Update cache with fresh data
        if (Array.isArray(leavesData)) {
          await updateCachedLeaveData(leavesData);
        }
      } else {
        // Use cached leave data for initial load
        console.log('Using cached leave data for initial load');
        let userLeaves = [];
        if (Array.isArray(cachedData.leaveData)) {
          if (user.role === 1) {
            // Admin sees all leaves
            userLeaves = cachedData.leaveData;
          } else {
            // Employee sees only their own leaves (should be filtered by backend)
            userLeaves = cachedData.leaveData;
          }
        }
        setLeaves(userLeaves);
      }

    } catch (error) {
      console.error('Error loading leave data:', error);
      // Handle general errors (like leave types failing)
      if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        console.log('Authentication token invalid - redirecting to login');
        // Token is invalid, user needs to login again
        Alert.alert('Session Expired', 'Please login again', [
          {
            text: 'OK',
            onPress: () => {
              // This will be handled by navigation logic
            },
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to load data. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async () => {
    try {
      if (!selectedLeaveType || !dateFrom || !dateTo || !leaveReason) {
        Toast.show({
          type: 'error',
          text1: 'Missing Information',
          text2: 'Please fill all required fields',
        });
        return;
      }

      if (leaveReason.length < 5) {
        Toast.show({
          type: 'error',
          text1: 'Reason Too Short',
          text2: 'Reason must be at least 5 characters',
        });
        return;
      }

      // Ensure dates are Date objects
      const start = dateFrom instanceof Date ? dateFrom : new Date(dateFrom);
      const end = dateTo instanceof Date ? dateTo : new Date(dateTo);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      console.log('Date validation:', {
        start: start.toISOString(),
        end: end.toISOString(),
        today: today.toISOString()
      });

      if (start < today) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Date',
          text2: 'Start date cannot be in the past',
        });
        return;
      }

      // Special validation for Earn Leave - must apply 48 hours in advance
      const selectedType = leaveTypes.find(type => (type.Id || type.id)?.toString() === selectedLeaveType);
      if (selectedType && (selectedType.LeaveType || selectedType.leave_type)?.toLowerCase().includes('earn')) {
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
        twoDaysFromNow.setHours(0, 0, 0, 0);

        if (start < twoDaysFromNow) {
          Toast.show({
            type: 'error',
            text1: 'Advance Notice Required',
            text2: 'Earn Leave must be applied at least 48 hours in advance',
          });
          return;
        }
      }

      if (end < start) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Date Range',
          text2: 'End date must be after start date',
        });
        return;
      }

      const formattedData = {
        leave_type_id: parseInt(selectedLeaveType),
        date_from: formatISODate(start),
        date_to: formatISODate(end),
        leave_reason: leaveReason.trim()
      };

      // console.log('Submitting leave application:', formattedData);

      setApplyLoading(true);

      await apiService.applyForLeave(formattedData);

      Toast.show({
        type: 'success',
        text1: 'Leave Application Submitted',
        text2: 'Your leave request has been sent for approval',
      });

      // Refresh cached leave data with the new application
      try {
        const freshLeaveData = await apiService.getLeaveHistory();
        if (Array.isArray(freshLeaveData)) {
          await updateCachedLeaveData(freshLeaveData);
        }
      } catch (refreshError) {
        console.error('Error refreshing leave data after application:', refreshError);
      }

      setShowApplyModal(false);
      resetForm();
    } catch (error) {
      console.error('Leave application error:', error);
      const errorMessage = error.response?.data?.error ||
                          error.response?.data?.message ||
                          error.message ||
                          'Failed to apply for leave';

      Toast.show({
        type: 'error',
        text1: 'Application Failed',
        text2: errorMessage,
      });
    } finally {
      setApplyLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedLeaveType('');
    setDateFrom(new Date());
    setDateTo(new Date());
    setLeaveReason('');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatISODate = (date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  const onFromDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || dateFrom;
    setShowFromDatePicker(Platform.OS === 'ios');
    setDateFrom(currentDate);
  };

  const onToDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || dateTo;
    setShowToDatePicker(Platform.OS === 'ios');
    setDateTo(currentDate);
  };

  const showFromDatePickerModal = () => {
    setShowFromDatePicker(true);
  };

  const showToDatePickerModal = () => {
    setShowToDatePicker(true);
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
            <Text variant="titleMedium">{item.LeaveType || item.leave_type || 'Leave'}</Text>
            <Text variant="bodySmall" style={styles.dateRange}>
              {formatDate(item.DateFrom || item.date_from)} - {formatDate(item.DateTo || item.date_to)}
            </Text>
          </View>
          <Chip
            mode="outlined"
            textStyle={{ color: getStatusColor(item.ApprovalStatus || item.status) }}
            style={{ borderColor: getStatusColor(item.ApprovalStatus || item.status) }}
          >
            {item.ApprovalStatus || item.status || 'Applied'}
          </Chip>
        </View>

        {item.LeaveReason && (
          <Text variant="bodyMedium" style={styles.reason}>
            Reason: {item.LeaveReason}
          </Text>
        )}

        <Text variant="bodySmall" style={styles.appliedDate}>
          Applied: {formatDate(item.DateCreated || item.created_at)}
        </Text>
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
          onRefresh={() => loadData(true)}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <Text variant="bodySmall" style={styles.refreshHint}>
              Pull down to refresh leave status
            </Text>
          }
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
            <View style={styles.pickerSection}>
              <Text variant="titleSmall" style={styles.fieldLabel}>
                Leave Type * ({leaveTypes.length} types loaded)
              </Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedLeaveType}
                  onValueChange={(itemValue) => setSelectedLeaveType(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Select a leave type..." value="" />
                  {leaveTypes.map((type) => (
                    <Picker.Item
                      key={type.Id || type.id}
                      label={type.LeaveType || type.leave_type}
                      value={(type.Id || type.id)?.toString()}
                    />
                  ))}
                </Picker>
              </View>
              {leaveTypes.length === 0 && (
                <Text variant="bodySmall" style={{ color: 'red', marginTop: 4 }}>
                  No leave types available. Check console for API errors.
                </Text>
              )}
            </View>

            <View style={styles.dateSection}>
              <Text variant="titleSmall" style={styles.fieldLabel}>
                From Date *
              </Text>
              <Button
                mode="outlined"
                onPress={showFromDatePickerModal}
                style={styles.dateButton}
              >
                {formatISODate(dateFrom)}
              </Button>
            </View>

            <View style={styles.dateSection}>
              <Text variant="titleSmall" style={styles.fieldLabel}>
                To Date *
              </Text>
              <Button
                mode="outlined"
                onPress={showToDatePickerModal}
                style={styles.dateButton}
              >
                {formatISODate(dateTo)}
              </Button>
            </View>

            {showFromDatePicker && (
              <DateTimePicker
                value={dateFrom}
                mode="date"
                display="default"
                onChange={onFromDateChange}
                minimumDate={new Date()}
              />
            )}

            {showToDatePicker && (
              <DateTimePicker
                value={dateTo}
                mode="date"
                display="default"
                onChange={onToDateChange}
                minimumDate={dateFrom}
              />
            )}

            <TextInput
              label="Reason *"
              value={leaveReason}
              onChangeText={setLeaveReason}
              multiline
              numberOfLines={3}
              style={styles.input}
              mode="outlined"
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
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#1e293b',
    fontSize: 24,
    fontWeight: '700',
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 16,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#475569',
    marginTop: 16,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
  listContainer: {
    paddingBottom: 80,
  },
  leaveCard: {
    marginBottom: 16,
    elevation: 4,
    borderRadius: 12,
    backgroundColor: 'white',
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
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
    color: '#64748b',
    marginTop: 4,
    fontSize: 14,
  },
  employeeName: {
    color: '#64748b',
    marginTop: 4,
    fontSize: 12,
  },
  reason: {
    color: '#374151',
    marginTop: 8,
    fontStyle: 'italic',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    fontSize: 14,
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
    backgroundColor: '#667eea',
    borderRadius: 16,
    elevation: 8,
  },
  modal: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
    elevation: 8,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#1e293b',
    fontSize: 20,
    fontWeight: '700',
  },
  formContainer: {
    gap: 20,
  },
  fieldLabel: {
    fontWeight: '600',
    color: '#374151',
    fontSize: 16,
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
    borderRadius: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    height: 48,
  },
  pickerSection: {
    marginBottom: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    elevation: 1,
  },
  picker: {
    height: 56,
    color: '#374151',
    fontSize: 16,
  },
  dateSection: {
    marginBottom: 16,
  },
  dateButton: {
    justifyContent: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  refreshHint: {
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: '#e0f2fe',
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
});
