# Attendance App - Mobile Employee Interface

A React Native mobile app for employees to mark attendance and manage leaves, integrated with SecuryScope API.

## 🚀 Features

### **Employee Features**
- **Login with Device ID** - Secure authentication with device binding
- **Mark Attendance** - Photo + GPS location for check-in/out
- **Attendance History** - View personal attendance records
- **Leave Management** - Apply for leaves and track status
- **Real-time Status** - Current attendance state tracking

## 🛠️ Tech Stack

- React Native 0.81.5
- Expo SDK 54
- React Native Paper UI
- SecuryScope API Integration
- AsyncStorage for offline data

## 🚀 Quick Start

### **Prerequisites**
- Node.js 18+
- Expo CLI
- Android/iOS device or emulator

### **Setup**
```bash
# Install dependencies
npm install

# Install additional packages
npx expo install expo-device

# Start the app
npx expo start
```

### **API Integration**
The app connects to: `https://api.securyscope.com/api`

**Endpoints Used:**
- `POST /login` - Employee login with deviceId
- `POST /logout` - User logout
- `POST /check-login` - Check login status
- `POST /attendance` - Mark attendance (IN/OUT)
- `GET /attendance` - Get attendance history
- `GET /leave-types` - Get available leave types
- `POST /leaves` - Apply for leave
- `PUT /leaves/:id` - Update leave application

## 📱 App Screens

1. **Login Screen** - Email/password authentication
2. **Mark Attendance** - Camera + GPS for attendance
3. **Attendance History** - Personal records with monthly view
4. **Leave Management** - Apply and track leave requests

## 🔧 Configuration

### **Required Permissions**
- Camera (for attendance photos)
- Location (for GPS tracking)
- Storage (for offline data)

### **Device ID Generation**
The app automatically generates and stores a unique device ID for secure authentication.

## 📝 Usage

1. **Login** with employee credentials
2. **Mark Attendance** by taking photo + capturing location
3. **View History** to see past attendance records
4. **Apply for Leave** using the leave management screen

## 🔐 Security

- JWT token authentication
- Device ID binding
- Secure photo upload
- GPS location verification
- Offline session management

---

**Employee-focused mobile interface for the SecuryScope attendance system**