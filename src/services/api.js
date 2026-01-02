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
        deviceId = Device.osInternalBuildId || `${Device.brand}_${Device.modelName}_${Date.now()}`;
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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
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
  async markAttendance(direction, location = null, photo = null) {
    const url = `${this.baseURL}/attendance`;
    const token = await this.getToken();
    const userData = await AsyncStorage.getItem('userData');
    const user = userData ? JSON.parse(userData) : null;

    const formData = new FormData();
    formData.append('direction', direction); // 'IN' or 'OUT'
    formData.append('user_id', user?.user_id?.toString() || user?.id?.toString());
    
    if (location) {
      formData.append('latitude', location.latitude.toString());
      formData.append('longitude', location.longitude.toString());
    }
    
    if (photo) {
      formData.append('photo', {
        uri: photo,
        type: 'image/jpeg',
        name: 'attendance.jpg',
      });
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Attendance marking failed');
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
      return this.request(`/attendance/${user.user_id || user.id}`);
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

  // Helper methods
  async getTodayAttendanceStatus() {
    try {
      const token = await this.getToken();
      if (!token) return null;
      
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      
      if (!user) return null;
      
      const today = new Date().toISOString().split('T')[0];
      const attendance = await this.getAttendanceByUserId(user.user_id || user.id);
      
      // Find today's records
      const todayRecords = attendance.filter(record => {
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
      console.error('Get today status error:', error);
      return null;
    }
  }
}

const apiService = new ApiService();
export default apiService;
