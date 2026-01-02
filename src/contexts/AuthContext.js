import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
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

  const loadAuthData = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('userData');

      if (storedToken && storedUser) {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
      }
    } catch (error) {
      console.error('Error loading auth data:', error);
      // Clear any corrupted data
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
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

  const logout = async () => {
    try {
      // Call API logout
      await apiService.logout();
      
      // Clear state
      setToken(null);
      setUser(null);

      // Clear storage
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('deviceId');

      return { success: true };
    } catch (error) {
      console.error('Error during logout:', error);
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
