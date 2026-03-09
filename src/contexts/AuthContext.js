import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import apiService from '../services/api';
import { transformAttendanceList } from '../utils/attendanceTransform';
import { tokenStorage } from '../utils/tokenStorage';

const AuthContext = createContext();
const AUTH_DEBUG = true;

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

const extractLoginPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.data && typeof payload.data === 'object') return payload.data;
  return payload;
};

const isFalseLike = (value) => {
  if (value === false || value === 0) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'false' || v === 'offline' || v === 'logged_out' || v === 'logout' || v === 'revoked';
  }
  return false;
};

const hasLogoutMessage = (value) => {
  if (typeof value !== 'string') return false;
  const v = value.toLowerCase();
  return (
    v.includes('logout') ||
    v.includes('logged out') ||
    v.includes('not logged in') ||
    v.includes('session expired') ||
    v.includes('revoked')
  );
};

const isSessionRevokedByAdmin = (loginStatusResponse) => {
  const payload = extractLoginPayload(loginStatusResponse);
  if (!payload || typeof payload !== 'object') return false;

  const candidates = [
    payload.isLoggedIn,
    payload.loggedIn,
    payload.loginStatus,
    payload.login_status,
    payload.status,
    payload.is_active_login,
    payload.device_status,
  ];

  if (candidates.some(isFalseLike)) return true;
  if (hasLogoutMessage(payload.message) || hasLogoutMessage(payload.error)) return true;

  if (payload.user && typeof payload.user === 'object') {
    const u = payload.user;
    if ([u.loginStatus, u.login_status, u.isLoggedIn, u.loggedIn].some(isFalseLike)) {
      return true;
    }
  }

  return false;
};

const isProfileSessionRevoked = (profileResponse) => {
  const payload = extractLoginPayload(profileResponse);
  if (!payload || typeof payload !== 'object') return false;

  const candidates = [
    payload.loginStatus,
    payload.login_status,
    payload.LoginStatus,
    payload.IsLoggedIn,
    payload.isLoggedIn,
    payload.loggedIn,
    payload.device_status,
  ];

  if (candidates.some(isFalseLike)) return true;
  if (hasLogoutMessage(payload.message) || hasLogoutMessage(payload.error)) return true;
  return false;
};

const isTransientNetworkError = (error) => {
  const message = (error?.message || '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('network error')
  );
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
  const [postLogoutAlert, setPostLogoutAlert] = useState(null);
  const isSessionCheckInProgress = useRef(false);
  const hasHandledSessionExpiry = useRef(false);

  useEffect(() => {
    initializeAppData();
  }, []);

  useEffect(() => {
    if (!token && postLogoutAlert) {
      Alert.alert(postLogoutAlert.title, postLogoutAlert.message);
      setPostLogoutAlert(null);
    }
  }, [token, postLogoutAlert]);

  const initializeAppData = async () => {
    try {
      if (AUTH_DEBUG) console.log('[Auth] initializeAppData: start');
      await loadCachedData();
      const restored = await restoreSession();
      if (AUTH_DEBUG) console.log('[Auth] initializeAppData: restoreSession result =', restored);
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
        const transformedAttendanceData = transformAttendanceList(rawAttendanceData, {
          userRole: currentUser?.role || 2,
          getMediaUrl: apiService.getMediaUrl.bind(apiService),
        });
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
    if (AUTH_DEBUG) {
      console.log('[Auth] refreshSession: tokens present =', !!tokens?.accessToken, !!tokens?.refreshToken);
    }
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      return false;
    }

    const result = await apiService.relogin(tokens.accessToken, tokens.refreshToken);
    const mapped = mapTokens(result, tokens.refreshToken);
    const userData = normalizeUser(result?.user);

    if (!mapped.accessToken || !mapped.refreshToken || !userData) {
      throw new Error('Invalid relogin response');
    }
    if (AUTH_DEBUG) console.log('[Auth] refreshSession: relogin success, message =', result?.message);

    setToken(mapped.accessToken);
    setUser(userData);
    await tokenStorage.saveTokens(mapped.accessToken, mapped.refreshToken);
    await AsyncStorage.setItem('userData', JSON.stringify(userData));
    await AsyncStorage.removeItem('authToken');
    return true;
  };

  useEffect(() => {
    let intervalId;

    const handleForcedLogout = async () => {
      if (hasHandledSessionExpiry.current) {
        return;
      }

      hasHandledSessionExpiry.current = true;
      const alertPayload = {
        title: 'Session Expired',
        message: 'You have been logged out. Please login again.',
      };

      if (AppState.currentState === 'active') {
        Alert.alert(
          alertPayload.title,
          alertPayload.message,
          [
            {
              text: 'OK',
              onPress: async () => {
                await performLogout();
              },
            },
          ],
          { cancelable: false }
        );
        return;
      }

      setPostLogoutAlert(alertPayload);
      await performLogout();
    };

    const checkAuthStatus = async () => {
      if (!token || !user || isSessionCheckInProgress.current) {
        return;
      }

      isSessionCheckInProgress.current = true;
      try {
        const loginStatus = await apiService.checkLoginStatus();
        const profileStatus = await apiService.getUserProfile();
        const isForcedLogout =
          isSessionRevokedByAdmin(loginStatus) ||
          isProfileSessionRevoked(profileStatus);

        if (isForcedLogout) {
          throw new Error('Session revoked by admin');
        }

        const isValid = await refreshSession();
        if (!isValid) {
          throw new Error('Session invalid');
        }
      } catch (_error) {
        if (isTransientNetworkError(_error)) {
          return;
        }
        await handleForcedLogout();
      } finally {
        isSessionCheckInProgress.current = false;
      }
    };

    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        checkAuthStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    intervalId = setInterval(checkAuthStatus, 10 * 1000);

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
      if (AUTH_DEBUG) console.log('[Auth] restoreSession: trying relogin');
      const restored = await refreshSession();
      if (restored) {
        if (AUTH_DEBUG) console.log('[Auth] restoreSession: success');
        return true;
      }
    } catch (error) {
      if (AUTH_DEBUG) console.log('[Auth] restoreSession: failed, logging out');
      await performLogout();
      return false;
    }

    if (AUTH_DEBUG) console.log('[Auth] restoreSession: no valid tokens found');
    await AsyncStorage.removeItem('userData');
    return false;
  };

  const login = async (email, password) => {
    try {
      hasHandledSessionExpiry.current = false;
      setPostLogoutAlert(null);
      if (AUTH_DEBUG) console.log('[Auth] login: start for', email);
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
      if (AUTH_DEBUG) console.log('[Auth] login: tokens saved, user restored');

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
      if (AUTH_DEBUG) console.log('[Auth] login: failed with', error?.message);
      return { success: false, error: error.message };
    }
  };

  const performLogout = async () => {
    try {
      if (AUTH_DEBUG) console.log('[Auth] performLogout: clearing local session');
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
      if (AUTH_DEBUG) console.log('[Auth] logout: start');
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
