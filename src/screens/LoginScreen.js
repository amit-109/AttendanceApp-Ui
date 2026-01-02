import { useState } from 'react';
import { Alert, StyleSheet, View, Image } from 'react-native';
import { ActivityIndicator, Button, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        Alert.alert('Success', 'Login successful');
      } else {
        Alert.alert('Login Failed', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setForgotLoading(true);
    try {
      // TODO: Integrate with API later
      Alert.alert('Success', 'Password reset instructions sent to your email');
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset instructions');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.content}>
          <Image 
            source={require('../../assets/images/SE_Logo_Rev1.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="headlineMedium" style={styles.title}>
            SecuryScope Attendance
          </Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            disabled={loading}
            style={styles.button}
          >
            {loading ? <ActivityIndicator color="white" /> : 'LOGIN'}
          </Button>

          <Button
            mode="text"
            onPress={() => setShowForgotPassword(true)}
            style={styles.forgotButton}
          >
            Forgot Password?
          </Button>
        </View>
      </View>

      <Portal>
        <Modal
          visible={showForgotPassword}
          onDismiss={() => setShowForgotPassword(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="headlineSmall" style={styles.modalTitle}>
            Forgot Password
          </Text>
          <Text variant="bodyMedium" style={styles.modalDescription}>
            Enter your email address and we'll send you instructions to reset your password.
          </Text>

          <TextInput
            label="Email Address"
            value={forgotEmail}
            onChangeText={setForgotEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowForgotPassword(false);
                setForgotEmail('');
              }}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleForgotPassword}
              loading={forgotLoading}
              disabled={forgotLoading}
              style={styles.modalButton}
            >
              Send Reset Link
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  card: {
    padding: 32,
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  title: {
    color: '#374151',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: 'white',
  },
  button: {
    width: '100%',
  },
  forgotButton: {
    marginTop: 8,
  },
  modal: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: 12,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#1f2937',
  },
  modalDescription: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#6b7280',
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