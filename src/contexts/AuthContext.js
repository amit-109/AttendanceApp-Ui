import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import apiService from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize API service with token getter
  useEffect(() => {
    apiService.getToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('authToken');
        return storedToken;
      } catch (error) {
        return null;
      }
    };
  }, []);

  // Load stored auth data on app start
  useEffect(() => {
    loadAuthData();
  }, []);

  // Automatic logout detection when admin logs out user
  useEffect(() => {
    let intervalId;

    const checkAuthStatus = async () => {
      if (token && user) {
        try {
          const result = await apiService.checkLoginStatus();

          // Check if user is logged out (API returns {'message': 'Not logged in'} when logged out)
          if (!result || !result.token || result.message === 'Not logged in') {
            // User has been logged out by admin
            Alert.alert(
              'Session Expired',
              'You have been logged out by an administrator.',
              [
                {
                  text: 'OK',
                  onPress: async () => {
                    await performLogout();
                  },
                },
              ]
            );
          }
        } catch (error) {
          // If there's an actual error (network, server down), assume user is still logged in
        }
      }
    };

    // Check authentication status when app comes to foreground
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        checkAuthStatus();
      }
    };

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Periodic check every 15 seconds for near-immediate logout detection
    intervalId = setInterval(checkAuthStatus, 15 * 1000);

    return () => {
      subscription?.remove();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [token, user]);

  const loadAuthData = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('userData');

      if (storedToken && storedUser) {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);

        // Optionally validate token with backend, but don't clear on failure
        try {
          const result = await apiService.checkLoginStatus();
          if (result && result.token) {
            // Token is still valid, update with fresh data
            const { token: newToken, refresh_token, user: userData } = result;
            setToken(newToken);
            setUser(userData);
            await AsyncStorage.setItem('authToken', newToken);
            await AsyncStorage.setItem('userData', JSON.stringify(userData));
            if (refresh_token) {
              await AsyncStorage.setItem('refreshToken', refresh_token);
            }
          }
          // If check fails, keep existing stored data
        } catch (checkError) {
          // Keep existing stored data, don't clear
        }
      }
    } catch (error) {
      // Clear any corrupted data only if JSON parsing fails
      if (error instanceof SyntaxError) {
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('userData');
        await AsyncStorage.removeItem('refreshToken');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await apiService.login(email, password);

      const { token: newToken, user: userData } = response;

      // Store in state
      setToken(newToken);
      setUser(userData);

      // Store in AsyncStorage
      await AsyncStorage.setItem('authToken', newToken);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const performLogout = async () => {
    try {
      // Clear state
      setToken(null);
      setUser(null);

      // Clear storage
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('deviceId');

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      // Call API logout
      await apiService.logout();

      // Perform local logout
      await performLogout();

      return { success: true };
    } catch (error) {
      // Still perform local logout even if API call fails
      await performLogout();
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token,
    isEmployee: user?.role === 2,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
