import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

export default function LeaveApplicationScreen({ navigation }) {
  const [leaveType, setLeaveType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const leaveTypes = [
    { label: 'Sick Leave', value: 'sick' },
    { label: 'Casual Leave', value: 'casual' },
    { label: 'Annual Leave', value: 'annual' },
    { label: 'Maternity Leave', value: 'maternity' },
    { label: 'Paternity Leave', value: 'paternity' },
    { label: 'Other', value: 'other' },
  ];

  const handleSubmit = async () => {
    if (!leaveType || !startDate || !endDate || !reason) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (reason.length < 10) {
      Alert.alert('Error', 'Please provide a detailed reason (minimum 10 characters)');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
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
        leaveType,
        startDate,
        endDate,
        reason,
      });

      Alert.alert('Success', 'Leave application submitted successfully', [
        {
          text: 'OK',
          onPress: () => {
            setLeaveType('');
            setStartDate('');
            setEndDate('');
            setReason('');
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

          <View style={styles.leaveTypeContainer}>
            {leaveTypes.map((type) => (
              <Button
                key={type.value}
                mode={leaveType === type.value ? 'contained' : 'outlined'}
                onPress={() => setLeaveType(type.value)}
                style={styles.leaveTypeButton}
              >
                {type.label}
              </Button>
            ))}
          </View>

          <TextInput
            label="Start Date (YYYY-MM-DD)"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2024-12-26"
            style={styles.input}
          />

          <TextInput
            label="End Date (YYYY-MM-DD)"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2024-12-27"
            style={styles.input}
          />

          <TextInput
            label="Reason for Leave"
            value={reason}
            onChangeText={setReason}
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
  leaveTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  leaveTypeButton: {
    flex: 1,
    minWidth: 100,
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