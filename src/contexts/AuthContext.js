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
  const [cachedData, setCachedData] = useState({
    attendanceData: [],
    leaveData: [],
    profileData: null
  });

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
    initializeAppData();
  }, []);

  const initializeAppData = async () => {
    try {
      await loadAuthData();

      // If user is authenticated, fetch fresh data from APIs
      if (token && user) {
        await loadCachedData(); // Load cache first for immediate display
        // Then fetch fresh data in background
        fetchFreshData();
      } else {
        await loadCachedData(); // Load cache even if not authenticated
      }
    } catch (error) {
      console.error('Error initializing app data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFreshData = async () => {
    try {
      // Fetch fresh attendance data and transform it
      const rawAttendanceData = await apiService.getAttendanceHistory();
      if (Array.isArray(rawAttendanceData)) {
        const transformedAttendanceData = rawAttendanceData.map((record, index) => ({
          Id: record.Id || record.id || index,
          date: record.CreatedAt || record.created_at,
          checkIn: record.Direction === 'IN' ? (record.CreatedAt || record.created_at) : null,
          checkOut: record.Direction === 'OUT' ? (record.CreatedAt || record.created_at) : null,
          status: 'present',
          location: {
            latitude: parseFloat(record.Latitude || record.latitude || 0),
            longitude: parseFloat(record.Longitude || record.longitude || 0)
          },
          photo: record.PhotoPath ? `https://api.securyscope.com${record.PhotoPath}` : null,
          employee: user?.role === 1 ? {
            _id: record.UserId || record.user_id,
            name: record.UserName || record.user_name || 'Unknown',
            email: record.UserEmail || record.user_email || 'unknown@email.com'
          } : null,
          notes: record.Notes || record.notes || null
        }));
        await updateCachedAttendanceData(transformedAttendanceData);
      }

      // Fetch fresh leave data
      const leaveData = await apiService.getLeaveHistory();
      if (Array.isArray(leaveData)) {
        await updateCachedLeaveData(leaveData);
      }
    } catch (error) {
      // Handle expected "no data" errors silently
      if (error.message && (error.message.includes('No ') || error.message.includes(' found') || error.message.includes('Record not found'))) {
        // These are expected - update cache with empty arrays
        if (error.message.includes('attendance') || error.message.includes('leave')) {
          const emptyData = [];
          if (error.message.includes('attendance')) {
            await updateCachedAttendanceData(emptyData);
          } else if (error.message.includes('leave')) {
            await updateCachedLeaveData(emptyData);
          }
        }
      } else {
        console.error('Error fetching fresh data:', error);
      }
    }
  };

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

  const loadCachedData = async () => {
    try {
      const cachedAttendance = await AsyncStorage.getItem('cachedAttendanceData');
      const cachedLeave = await AsyncStorage.getItem('cachedLeaveData');
      const cachedProfile = await AsyncStorage.getItem('cachedProfileData');

      const attendanceData = cachedAttendance ? JSON.parse(cachedAttendance) : [];
      const leaveData = cachedLeave ? JSON.parse(cachedLeave) : [];
      const profileData = cachedProfile ? JSON.parse(cachedProfile) : null;

      setCachedData({
        attendanceData,
        leaveData,
        profileData
      });
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  };

  const updateCachedAttendanceData = async (data) => {
    try {
      await AsyncStorage.setItem('cachedAttendanceData', JSON.stringify(data));
      setCachedData(prev => ({ ...prev, attendanceData: data }));
    } catch (error) {
      console.error('Error caching attendance data:', error);
    }
  };

  const updateCachedLeaveData = async (data) => {
    try {
      await AsyncStorage.setItem('cachedLeaveData', JSON.stringify(data));
      setCachedData(prev => ({ ...prev, leaveData: data }));
    } catch (error) {
      console.error('Error caching leave data:', error);
    }
  };

  const updateCachedProfileData = async (data) => {
    try {
      await AsyncStorage.setItem('cachedProfileData', JSON.stringify(data));
      setCachedData(prev => ({ ...prev, profileData: data }));
    } catch (error) {
      console.error('Error caching profile data:', error);
    }
  };

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

      // After successful login, fetch fresh data since cache was cleared on logout
      try {
        // Fetch fresh attendance data and transform it
        const rawAttendanceData = await apiService.getAttendanceHistory();
        if (Array.isArray(rawAttendanceData)) {
          const transformedAttendanceData = rawAttendanceData.map((record, index) => ({
            Id: record.Id || record.id || index,
            date: record.CreatedAt || record.created_at,
            checkIn: record.Direction === 'IN' ? (record.CreatedAt || record.created_at) : null,
            checkOut: record.Direction === 'OUT' ? (record.CreatedAt || record.created_at) : null,
            status: 'present',
            location: {
              latitude: parseFloat(record.Latitude || record.latitude || 0),
              longitude: parseFloat(record.Longitude || record.longitude || 0)
            },
            photo: record.PhotoPath ? `https://api.securyscope.com${record.PhotoPath}` : null,
            employee: userData.role === 1 ? {
              _id: record.UserId || record.user_id,
              name: record.UserName || record.user_name || 'Unknown',
              email: record.UserEmail || record.user_email || 'unknown@email.com'
            } : null,
            notes: record.Notes || record.notes || null
          }));
          await updateCachedAttendanceData(transformedAttendanceData);
        }

        // Fetch fresh leave data
        const leaveData = await apiService.getLeaveHistory();
        if (Array.isArray(leaveData)) {
          await updateCachedLeaveData(leaveData);
        }
      } catch (fetchError) {
        // Handle expected "no data" errors silently
        if (fetchError.message && (fetchError.message.includes('No ') || fetchError.message.includes(' found') || fetchError.message.includes('Record not found'))) {
          // These are expected - update cache with empty arrays
          if (fetchError.message.includes('attendance') || fetchError.message.includes('leave')) {
            const emptyData = [];
            if (fetchError.message.includes('attendance')) {
              await updateCachedAttendanceData(emptyData);
            } else if (fetchError.message.includes('leave')) {
              await updateCachedLeaveData(emptyData);
            }
          }
        } else {
          console.error('Error fetching fresh data after login:', fetchError);
        }
      }

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
      await AsyncStorage.removeItem('cachedAttendanceData');
      await AsyncStorage.removeItem('cachedLeaveData');
      await AsyncStorage.removeItem('cachedProfileData');

      setCachedData({
        attendanceData: [],
        leaveData: [],
        profileData: null
      });

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
    cachedData,
    updateCachedAttendanceData,
    updateCachedLeaveData,
    updateCachedProfileData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
