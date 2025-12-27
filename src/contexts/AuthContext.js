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
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth data:', error);
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
      // Clear state
      setToken(null);
      setUser(null);

      // Clear storage
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');

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
    isAdmin: user?.role === 'admin',
    isEmployee: user?.role === 'employee',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
