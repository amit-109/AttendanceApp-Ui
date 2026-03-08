import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import apiService from '../services/api';
import { tokenStorage } from '../utils/tokenStorage';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const mapTokens = (payload, fallbackRefreshToken = null) => ({
  accessToken: payload?.access_token || payload?.token || null,
  refreshToken: payload?.refresh_token || fallbackRefreshToken || null,
});

const normalizeUser = (userData) => {
  if (!userData) return null;
  return {
    ...userData,
    id: userData.id || userData.Id || userData.user_id || null,
    user_id: userData.user_id || userData.id || userData.Id || null,
    name: userData.name || userData.Name || null,
    email: userData.email || userData.Email || null,
    role: userData.role || userData.Role || 2,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cachedData, setCachedData] = useState({
    attendanceData: [],
    leaveData: [],
    profileData: null,
  });

  useEffect(() => {
    initializeAppData();
  }, []);

  const initializeAppData = async () => {
    try {
      await loadCachedData();
      const restored = await restoreSession();
      if (restored) {
        fetchFreshData();
      }
    } catch (error) {
      console.error('Error initializing app data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFreshData = async (currentUser = user) => {
    try {
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
            longitude: parseFloat(record.Longitude || record.longitude || 0),
          },
          photo: record.PhotoPath ? `https://api.securyscope.com${record.PhotoPath}` : null,
          employee: currentUser?.role === 1 ? {
            _id: record.UserId || record.user_id,
            name: record.UserName || record.user_name || 'Unknown',
            email: record.UserEmail || record.user_email || 'unknown@email.com',
          } : null,
          notes: record.Notes || record.notes || null,
        }));
        await updateCachedAttendanceData(transformedAttendanceData);
      }

      const leaveData = await apiService.getLeaveHistory();
      if (Array.isArray(leaveData)) {
        await updateCachedLeaveData(leaveData);
      }
    } catch (error) {
      if (error.message && (error.message.includes('No ') || error.message.includes(' found') || error.message.includes('Record not found'))) {
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

  const refreshSession = async () => {
    const tokens = await tokenStorage.getTokens();
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      return false;
    }

    const result = await apiService.relogin(tokens.accessToken, tokens.refreshToken);
    const mapped = mapTokens(result, tokens.refreshToken);
    const userData = normalizeUser(result?.user);

    if (!mapped.accessToken || !mapped.refreshToken || !userData) {
      throw new Error('Invalid relogin response');
    }

    setToken(mapped.accessToken);
    setUser(userData);
    await tokenStorage.saveTokens(mapped.accessToken, mapped.refreshToken);
    await AsyncStorage.setItem('userData', JSON.stringify(userData));
    await AsyncStorage.removeItem('authToken');
    return true;
  };

  useEffect(() => {
    let intervalId;

    const checkAuthStatus = async () => {
      if (token && user) {
        try {
          const isValid = await refreshSession();
          if (!isValid) {
            throw new Error('Session invalid');
          }
        } catch (error) {
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please login again.',
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
      }
    };

    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        checkAuthStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    intervalId = setInterval(checkAuthStatus, 30 * 1000);

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
        profileData,
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

  const restoreSession = async () => {
    try {
      const restored = await refreshSession();
      if (restored) {
        return true;
      }
    } catch (error) {
      await performLogout();
      return false;
    }

    await AsyncStorage.removeItem('userData');
    return false;
  };

  const login = async (email, password) => {
    try {
      const response = await apiService.login(email, password);
      const mapped = mapTokens(response);
      const userData = normalizeUser(response?.user);

      if (!mapped.accessToken || !mapped.refreshToken || !userData) {
        return { success: false, error: 'Invalid login response from server (missing tokens/user)' };
      }

      setToken(mapped.accessToken);
      setUser(userData);

      await tokenStorage.saveTokens(mapped.accessToken, mapped.refreshToken);
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.setItem('userData', JSON.stringify(userData));

      try {
        await fetchFreshData(userData);
      } catch (fetchError) {
        if (fetchError.message &&
            (fetchError.message.includes('No ') || fetchError.message.includes(' found') || fetchError.message.includes('Record not found'))) {
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
      setToken(null);
      setUser(null);

      await tokenStorage.clearTokens();
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('deviceId');
      await AsyncStorage.removeItem('cachedAttendanceData');
      await AsyncStorage.removeItem('cachedLeaveData');
      await AsyncStorage.removeItem('cachedProfileData');

      setCachedData({
        attendanceData: [],
        leaveData: [],
        profileData: null,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
      await performLogout();
      return { success: true };
    } catch (error) {
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
