import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { tokenStorage } from '../utils/tokenStorage';

const API_BASE_URL = 'https://uat-api.securyscope.com/api';
const NETWORK_DEBUG = __DEV__;

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  getLoggableBody(body) {
    if (!body) return null;
    if (typeof body === 'string') return body;
    if (body instanceof FormData) return '[FormData]';
    try {
      return JSON.stringify(body);
    } catch (_error) {
      return '[Unserializable body]';
    }
  }

  sanitizeHeaders(headers = {}) {
    const sanitized = { ...headers };
    if (sanitized.Authorization) {
      sanitized.Authorization = 'Bearer ***';
    }
    return sanitized;
  }

  async apiFetch(url, options = {}) {
    const method = options.method || 'GET';
    if (NETWORK_DEBUG) {
      console.log('[API][REQ]', method, url, {
        headers: this.sanitizeHeaders(options.headers || {}),
        body: this.getLoggableBody(options.body),
      });
    }

    const response = await fetch(url, options);

    if (NETWORK_DEBUG) {
      let responsePreview = '';
      try {
        responsePreview = await response.clone().text();
      } catch (_error) {
        responsePreview = '[Unreadable response body]';
      }

      console.log('[API][RES]', method, url, {
        status: response.status,
        ok: response.ok,
        body: responsePreview.substring(0, 500),
      });
    }

    return response;
  }

  async getDeviceId() {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        const isDevelopment = __DEV__;

        if (isDevelopment) {
          deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        } else {
          deviceId = Device.osInternalBuildId || `${Device.brand}_${Device.modelName}_${Date.now()}`;
        }

        await AsyncStorage.setItem('deviceId', deviceId);
      }
      return deviceId;
    } catch (_error) {
      return `fallback_${Date.now()}`;
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = await this.getToken();

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      throw new Error('Authentication required');
    }

    try {
      const response = await this.apiFetch(url, config);

      if (!response.ok) {
        try {
          const errorText = await response.text();
          console.error('API Error Response:', errorText);
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          } catch (_jsonError) {
            throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 100)}`);
          }
        } catch (_textError) {
          throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }
      }

      const responseText = await response.text();
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse API response as JSON:', parseError);
        console.error('Raw response:', responseText);
        throw new Error(`Invalid JSON response from server: ${responseText.substring(0, 100)}`);
      }
    } catch (error) {
      if (!error.message ||
          (!error.message.includes('No ') && !error.message.includes(' found') && !error.message.includes('Record not found') && !error.message.includes('leaves'))) {
        console.error('API Error:', error);
      }
      throw error;
    }
  }

  async getToken() {
    try {
      return await tokenStorage.getAccessToken();
    } catch (_error) {
      return null;
    }
  }

  async login(email, password) {
    const deviceId = await this.getDeviceId();
    const url = `${this.baseURL}/login`;

    try {
      const response = await this.apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, deviceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Login failed');
      }

      return data;
    } catch (error) {
      console.error('Login Error:', error);
      throw error;
    }
  }

  async relogin(accessToken, refreshToken) {
    const url = `${this.baseURL}/relogin`;

    try {
      const response = await this.apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Session restore failed');
      }

      return data;
    } catch (error) {
      console.error('Relogin Error:', error);
      throw error;
    }
  }

  async logout() {
    const url = `${this.baseURL}/logout`;
    const userData = await AsyncStorage.getItem('userData');
    const user = userData ? JSON.parse(userData) : null;

    try {
      await this.apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user?.email || user?.id }),
      });
    } catch (error) {
      console.error('Logout API Error:', error);
    }
  }

  async checkLoginStatus() {
    const deviceId = await this.getDeviceId();
    const url = `${this.baseURL}/check-login`;

    try {
      const response = await this.apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId }),
      });

      const data = await response.json();
      return response.ok ? data : null;
    } catch (error) {
      console.error('Check login status error:', error);
      return null;
    }
  }

  async markAttendance(direction, location = null, photoUri = null) {
    const url = `${this.baseURL}/attendance`;
    const token = await this.getToken();
    const userData = await AsyncStorage.getItem('userData');
    const user = userData ? JSON.parse(userData) : null;

    const formData = new FormData();
    formData.append('direction', direction);
    formData.append('user_id', (user?.user_id || user?.id)?.toString());

    if (location && location.latitude && location.longitude) {
      formData.append('latitude', location.latitude.toString());
      formData.append('longitude', location.longitude.toString());
    }

    if (photoUri) {
      const fileName = `attendance_${Date.now()}.jpg`;
      formData.append('photo', {
        uri: photoUri,
        type: 'image/jpeg',
        name: fileName,
      });
    }

    try {
      const response = await this.apiFetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        try {
          const errorText = await response.text();
          console.error('API Error Response:', errorText);
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          } catch (_jsonError) {
            throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 100)}`);
          }
        } catch (_textError) {
          throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }
      }

      const responseText = await response.text();
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse API response as JSON:', parseError);
        console.error('Raw response:', responseText);
        throw new Error(`Invalid JSON response from server: ${responseText.substring(0, 100)}`);
      }
    } catch (error) {
      console.error('Mark Attendance Error:', error);
      throw error;
    }
  }

  async getAttendanceHistory() {
    const userData = await AsyncStorage.getItem('userData');
    const user = userData ? JSON.parse(userData) : null;

    if (user.role === 1) {
      return this.request('/attendance');
    }

    const userId = user.user_id || user.id;
    return this.request(`/attendance/${userId}`);
  }

  async getAttendanceByUserId(userId) {
    return this.request(`/attendance/${userId}`);
  }

  async getLeaveTypes() {
    return this.request('/leave-types');
  }

  async applyForLeave(leaveData) {
    return this.request('/leaves', {
      method: 'POST',
      body: JSON.stringify(leaveData),
    });
  }

  async updateLeaveApplication(leaveId, leaveData) {
    return this.request(`/leaves/${leaveId}`, {
      method: 'PUT',
      body: JSON.stringify(leaveData),
    });
  }

  async getUserProfile() {
    const userData = await AsyncStorage.getItem('userData');
    const user = userData ? JSON.parse(userData) : null;
    if (!user) return null;
    return this.request(`/users/${user.user_id || user.id}`);
  }

  async getLeaveHistory() {
    const userData = await AsyncStorage.getItem('userData');
    const user = userData ? JSON.parse(userData) : null;

    const userRole = user.role || 2;

    if (userRole === 1) {
      return this.request('/leaves');
    }

    const userId = user.user_id || user.id;
    return this.request(`/leaves-user/${userId}`);
  }

  async updateUser(id, userData) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async getTodayAttendanceStatus() {
    try {
      const token = await this.getToken();
      if (!token) return null;

      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;

      if (!user) return null;

      const attendance = await this.getAttendanceByUserId(user.user_id || user.id);

      if (!Array.isArray(attendance) || attendance.length === 0) {
        return null;
      }

      const today = new Date().toISOString().split('T')[0];

      const todayRecords = attendance.filter(record => {
        if (!record.CreatedAt) return false;
        const recordDate = new Date(record.CreatedAt).toISOString().split('T')[0];
        return recordDate === today;
      });

      if (todayRecords.length === 0) return null;

      todayRecords.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

      return {
        direction: todayRecords[0].Direction,
        created_at: todayRecords[0].CreatedAt,
        hasCheckedIn: todayRecords.some(r => r.Direction === 'IN'),
        hasCheckedOut: todayRecords.some(r => r.Direction === 'OUT'),
      };
    } catch (_error) {
      console.log('No attendance data available');
      return null;
    }
  }
}

const apiService = new ApiService();
export default apiService;

