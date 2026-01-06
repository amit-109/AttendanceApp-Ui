import { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, View, Platform } from 'react-native';
import { Button, Text, TextInput, Chip } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

export default function LeaveApplicationScreen({ navigation }) {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date());
  const [dateTo, setDateTo] = useState(new Date());
  const [leaveReason, setLeaveReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [typesLoading, setTypesLoading] = useState(true);
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadLeaveTypes();
  }, []);

  const loadLeaveTypes = async () => {
    try {
      const types = await apiService.getLeaveTypes();
      setLeaveTypes(types);
    } catch (error) {
      console.error('Error loading leave types:', error);
    } finally {
      setTypesLoading(false);
    }
  };

  const formatDate = (date) => {
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

  const handleSubmit = async () => {
    if (!selectedLeaveType || !dateFrom || !dateTo || !leaveReason) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (leaveReason.length < 10) {
      Alert.alert('Error', 'Please provide a detailed reason (minimum 10 characters)');
      return;
    }

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      Alert.alert('Error', 'Start date cannot be in the past');
      return;
    }

    if (end < start) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    setLoading(true);
    try {
      await apiService.applyForLeave({
        leave_type_id: parseInt(selectedLeaveType),
        date_from: dateFrom,
        date_to: dateTo,
        leave_reason: leaveReason,
      });

      Alert.alert('Success', 'Leave application submitted successfully', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedLeaveType('');
            setDateFrom('');
            setDateTo('');
            setLeaveReason('');
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit leave application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Apply for Leave
        </Text>

        <Text variant="bodyMedium" style={styles.welcome}>
          Welcome, {user?.name}
        </Text>

        <View style={styles.form}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Leave Details
          </Text>

          {typesLoading ? (
            <Text variant="bodyMedium" style={{ textAlign: 'center', marginBottom: 16 }}>
              Loading leave types...
            </Text>
          ) : (
            <View style={styles.pickerSection}>
              <Text variant="titleSmall" style={styles.fieldLabel}>
                Leave Type *
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
            </View>
          )}

          <View style={styles.dateSection}>
            <Text variant="titleSmall" style={styles.fieldLabel}>
              From Date *
            </Text>
            <Button
              mode="outlined"
              onPress={showFromDatePickerModal}
              style={styles.dateButton}
            >
              {formatDate(dateFrom)}
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
              {formatDate(dateTo)}
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
            label="Reason for Leave"
            value={leaveReason}
            onChangeText={setLeaveReason}
            multiline
            numberOfLines={4}
            style={[styles.input, styles.textArea]}
          />

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
          >
            Submit Application
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
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
  form: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    marginBottom: 16,
    color: '#374151',
  },
  leaveTypeSection: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  helperText: {
    color: '#6b7280',
    marginBottom: 8,
  },
  leaveTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  leaveTypeChip: {
    marginBottom: 4,
  },
  selectedChip: {
    backgroundColor: '#1976d2',
  },
  selectedChipText: {
    color: 'white',
  },
  noTypesText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  leaveTypeButton: {
    flex: 1,
    minWidth: 100,
  },
  pickerSection: {
    marginBottom: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    backgroundColor: '#f9fafb',
  },
  picker: {
    height: 50,
    color: '#374151',
  },
  dateSection: {
    marginBottom: 16,
  },
  dateButton: {
    justifyContent: 'flex-start',
  },
  input: {
    marginBottom: 16,
  },
  textArea: {
    height: 100,
  },
  submitButton: {
    marginTop: 8,
  },
});
