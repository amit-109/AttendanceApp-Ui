import { useState } from 'react';
import { Alert, StyleSheet, View, Image, Dimensions } from 'react-native';
import { ActivityIndicator, Button, Modal, Portal, Text, TextInput, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Missing Information',
        text2: 'Please enter both email and password',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Login Successful',
          text2: 'Welcome to SecuryScope Attendance',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: result.error,
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Connection Error',
        text2: 'Please check your network connection',
      });
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
    <View style={styles.rootContainer}>
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb', '#f5576c']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.overlay}>
          <Surface style={styles.card} elevation={8}>
            <View style={styles.content}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/SE_Logo_Rev1.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.headerText}>
                <Text variant="headlineLarge" style={styles.title}>
                  Welcome Back
                </Text>
                <Text variant="bodyLarge" style={styles.subtitle}>
                  Sign in to SecuryScope Attendance
                </Text>
              </View>

              <View style={styles.formContainer}>
                <TextInput
                  label="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                  mode="outlined"
                  theme={{ colors: { primary: '#667eea' } }}
                />

                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  mode="outlined"
                  theme={{ colors: { primary: '#667eea' } }}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? "eye-off" : "eye"}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                />

                <Button
                  mode="contained"
                  onPress={handleLogin}
                  disabled={loading}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    'Sign In Securely'
                  )}
                </Button>

                <Button
                  mode="text"
                  onPress={() => setShowForgotPassword(true)}
                  style={styles.forgotButton}
                  labelStyle={styles.forgotButtonLabel}
                >
                  Forgot Password?
                </Button>
              </View>
            </View>
          </Surface>

          <View style={styles.footer}>
            <Text variant="bodySmall" style={styles.footerText}>
              Secure • Reliable • Professional
            </Text>
          </View>
        </View>

        {/* Full Screen Loader */}
        {loading && (
          <View style={styles.fullScreenLoader}>
            <View style={styles.loaderCard}>
              <ActivityIndicator size="large" color="#667eea" />
              <Text style={styles.loaderText}>Signing you in...</Text>
              <Text style={styles.loaderSubtext}>Please wait while we authenticate</Text>
            </View>
          </View>
        )}
      </LinearGradient>

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

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    width: width,
    height: height,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '95%',
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    overflow: 'hidden',
  },
  content: {
    padding: 32,
    alignItems: 'center',
    gap: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 10,
  },
  headerText: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#1e293b',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 28,
  },
  subtitle: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 16,
  },
  formContainer: {
    width: '100%',
    gap: 16,
  },
  input: {
    backgroundColor: 'transparent',
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    backgroundColor: '#667eea',
  },
  buttonContent: {
    height: 56,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: {
    marginTop: 8,
  },
  forgotButtonLabel: {
    color: '#667eea',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1,
  },
  modal: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#1f2937',
    fontSize: 20,
    fontWeight: '600',
  },
  modalDescription: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#6b7280',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
  },
  fullScreenLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loaderCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loaderText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
  },
  loaderSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
