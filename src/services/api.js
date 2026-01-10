import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

const API_BASE_URL = 'https://api.securyscope.com/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async getDeviceId() {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        // Use UUID for development mode, Android ID for production
        const isDevelopment = __DEV__; // React Native global variable

        if (isDevelopment) {
          // Generate UUID v4 for development (Expo Go, local testing)
          deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        } else {
          // Use Android ID for production
          deviceId = Device.osInternalBuildId || `${Device.brand}_${Device.modelName}_${Date.now()}`;
        }

        await AsyncStorage.setItem('deviceId', deviceId);
      }
      return deviceId;
    } catch (error) {
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
      const response = await fetch(url, config);

      // First check if response is OK before trying to parse JSON
      if (!response.ok) {
        try {
          const errorText = await response.text();
          console.error('API Error Response:', errorText);
          // Try to parse as JSON, but if it fails, use the raw text
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          } catch (jsonError) {
            // If not JSON, use the raw text
            throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 100)}`);
          }
        } catch (textError) {
          throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }
      }

      let data;
      try {
        const responseText = await response.text();
        // Try to parse as JSON
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse API response as JSON:', parseError);
        console.error('Raw response:', responseText);
        throw new Error(`Invalid JSON response from server: ${responseText.substring(0, 100)}`);
      }

      return data;
    } catch (error) {
      // Don't log expected "no data found" errors to avoid console spam
      if (!error.message ||
          (!error.message.includes('No ') && !error.message.includes(' found') && !error.message.includes('Record not found') && !error.message.includes('leaves'))) {
        console.error('API Error:', error);
      }
      throw error;
    }
  }

  async getToken() {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      return null;
    }
  }

  // Auth endpoints
  async login(email, password) {
    const deviceId = await this.getDeviceId();
    const url = `${this.baseURL}/login`;

    try {
      const response = await fetch(url, {
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

  async logout() {
    const url = `${this.baseURL}/logout`;
    const userData = await AsyncStorage.getItem('userData');
    const user = userData ? JSON.parse(userData) : null;

    try {
      await fetch(url, {
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
      const response = await fetch(url, {
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

  // Attendance endpoints
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
      // For React Native, we need to handle the photo URI properly
      const fileName = `attendance_${Date.now()}.jpg`;
      formData.append('photo', {
        uri: photoUri,
        type: 'image/jpeg',
        name: fileName,
      });
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Note: Don't set Content-Type for FormData - browser sets it automatically with boundary
        },
        body: formData,
      });

      // First check if response is OK before trying to parse JSON
      if (!response.ok) {
        try {
          const errorText = await response.text();
          console.error('API Error Response:', errorText);
          // Try to parse as JSON, but if it fails, use the raw text
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          } catch (jsonError) {
            // If not JSON, use the raw text
            throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 100)}`);
          }
        } catch (textError) {
          throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }
      }

      let data;
      try {
        const responseText = await response.text();
        // Try to parse as JSON
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse API response as JSON:', parseError);
        // Use the responseText we already have, don't read again
        console.error('Raw response:', responseText);
        throw new Error(`Invalid JSON response from server: ${responseText.substring(0, 100)}`);
      }

      return data;
    } catch (error) {
      console.error('Mark Attendance Error:', error);
      throw error;
    }
  }

  async getAttendanceHistory() {
    const userData = await AsyncStorage.getItem('userData');
    const user = userData ? JSON.parse(userData) : null;

    if (user.role === 1) {
      // Admin - get all attendance records
      return this.request('/attendance');
    } else {
      // Employee - get own attendance records
      const userId = user.user_id || user.id;
      return this.request(`/attendance/${userId}`);
    }
  }

  async getAttendanceByUserId(userId) {
    return this.request(`/attendance/${userId}`);
  }

  // Leave management
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

    // If role is undefined, assume employee (role 2)
    const userRole = user.role || 2;

    if (userRole === 1) {
      // Admin - get all leaves
      return this.request('/leaves');
    } else {
      // Employee - get own leaves via leaves-user endpoint
      const userId = user.user_id || user.id;
      return this.request(`/leaves-user/${userId}`);
    }
  }

  // User management APIs (Admin only)
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

  // Helper methods
  async getTodayAttendanceStatus() {
    try {
      const token = await this.getToken();
      if (!token) return null;

      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;

      if (!user) return null;

      const attendance = await this.getAttendanceByUserId(user.user_id || user.id);

      // Handle case where attendance is empty or not an array
      if (!Array.isArray(attendance) || attendance.length === 0) {
        return null;
      }

      const today = new Date().toISOString().split('T')[0];

      // Find today's records
      const todayRecords = attendance.filter(record => {
        if (!record.CreatedAt) return false;
        const recordDate = new Date(record.CreatedAt).toISOString().split('T')[0];
        return recordDate === today;
      });

      if (todayRecords.length === 0) return null;

      // Sort by time to get the latest record
      todayRecords.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

      return {
        direction: todayRecords[0].Direction,
        created_at: todayRecords[0].CreatedAt,
        hasCheckedIn: todayRecords.some(r => r.Direction === 'IN'),
        hasCheckedOut: todayRecords.some(r => r.Direction === 'OUT')
      };
    } catch (error) {
      // Silently handle errors - don't show console errors for empty data
      console.log('No attendance data available');
      return null;
    }
  }
}

const apiService = new ApiService();
export default apiService;
