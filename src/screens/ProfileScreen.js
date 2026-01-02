import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // TODO: Integrate with API later
      Alert.alert('Success', 'Password changed successfully');
      setShowChangePassword(false);
      resetPasswordForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: logout, style: 'destructive' }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Profile
        </Text>

        <Card style={styles.profileCard}>
          <Card.Content>
            <View style={styles.profileHeader}>
              <MaterialIcons name="account-circle" size={64} color="#4CAF50" />
              <View style={styles.profileInfo}>
                <Text variant="headlineSmall" style={styles.name}>
                  {user?.name || 'User'}
                </Text>
                <Text variant="bodyMedium" style={styles.email}>
                  {user?.email || 'user@example.com'}
                </Text>
                <Text variant="bodySmall" style={styles.role}>
                  {user?.role === 1 ? 'Administrator' : 'Employee'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={() => setShowChangePassword(true)}
            icon="lock"
            style={styles.actionButton}
          >
            Change Password
          </Button>

          <Button
            mode="outlined"
            onPress={handleLogout}
            icon="logout"
            style={[styles.actionButton, styles.logoutButton]}
            textColor="#dc2626"
          >
            Logout
          </Button>
        </View>

        <Portal>
          <Modal
            visible={showChangePassword}
            onDismiss={() => setShowChangePassword(false)}
            contentContainerStyle={styles.modal}
          >
            <Text variant="headlineSmall" style={styles.modalTitle}>
              Change Password
            </Text>

            <TextInput
              label="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              style={styles.input}
            />

            <TextInput
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              style={styles.input}
            />

            <TextInput
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => {
                  setShowChangePassword(false);
                  resetPasswordForm();
                }}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleChangePassword}
                loading={loading}
                disabled={loading}
                style={styles.modalButton}
              >
                Change Password
              </Button>
            </View>
          </Modal>
        </Portal>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  profileCard: {
    marginBottom: 24,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    color: '#1f2937',
    fontWeight: 'bold',
  },
  email: {
    color: '#6b7280',
    marginTop: 4,
  },
  role: {
    color: '#4CAF50',
    marginTop: 4,
    fontWeight: '500',
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    paddingVertical: 8,
  },
  logoutButton: {
    borderColor: '#dc2626',
  },
  modal: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: 12,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#1f2937',
  },
  input: {
    marginBottom: 16,
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