// Your computer's IP address for mobile development
const API_BASE_URL = 'http://10.147.186.19:5000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
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
      // If no token, don't make authenticated requests
      console.warn(`No token available for ${endpoint}`);
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async getToken() {
    // This will be implemented in the auth context
    return null;
  }

  // Auth endpoints (don't require authentication)
  async login(email, password) {
    const url = `${this.baseURL}/auth/login`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      return data;
    } catch (error) {
      console.error('Login Error:', error);
      throw error;
    }
  }

  // Employee endpoints
  async checkIn(location = null, photo = null) {
    const body = {};
    if (location) {
      body.latitude = location.latitude;
      body.longitude = location.longitude;
    }
    if (photo) {
      body.photo = photo;
    }
    return this.request('/employee/checkin', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async checkOut() {
    return this.request('/employee/checkout', {
      method: 'PUT',
    });
  }

  async getAttendanceHistory(userRole) {
    const endpoint = userRole === 'admin' ? '/admin/attendance' : '/employee/attendance';
    return this.request(endpoint);
  }

  async getTodayStatus() {
    return this.request('/employee/today');
  }

  // Admin endpoints
  async getEmployees() {
    return this.request('/admin/employees');
  }

  async addEmployee(employeeData) {
    return this.request('/admin/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
  }

  async updateEmployee(id, employeeData) {
    return this.request(`/admin/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    });
  }

  async deleteEmployee(id) {
    return this.request(`/admin/employees/${id}`, {
      method: 'DELETE',
    });
  }

  async getAllAttendance() {
    return this.request('/admin/attendance');
  }

  // Leave management methods
  async applyForLeave(leaveData) {
    return this.request('/employee/leave', {
      method: 'POST',
      body: JSON.stringify(leaveData),
    });
  }

  async getLeaveHistory() {
    return this.request('/employee/leave');
  }

  async getAllLeaves() {
    return this.request('/admin/leaves');
  }

  async updateLeaveStatus(leaveId, status, comments = null) {
    const body = { status };
    if (comments) {
      body.comments = comments;
    }
    return this.request(`/admin/leaves/${leaveId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }
}

const apiService = new ApiService();
export default apiService;
