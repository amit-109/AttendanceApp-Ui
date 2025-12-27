import { MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import AdminLeaveManagementScreen from '../screens/AdminLeaveManagementScreen';
import AttendanceListScreen from '../screens/AttendanceListScreen';
import LeaveApplicationScreen from '../screens/LeaveApplicationScreen';
import LeaveHistoryScreen from '../screens/LeaveHistoryScreen';
import LoginScreen from '../screens/LoginScreen';
import MarkAttendanceScreen from '../screens/MarkAttendanceScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const isAdmin = user?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'MarkAttendance') {
            iconName = 'camera';
          } else if (route.name === 'AttendanceList') {
            iconName = 'list';
          } else if (route.name === 'LeaveApplication') {
            iconName = 'add-circle';
          } else if (route.name === 'LeaveHistory') {
            iconName = 'history';
          } else if (route.name === 'AdminLeaveManagement') {
            iconName = 'admin-panel-settings';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
        headerStyle: { backgroundColor: '#4CAF50' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Logout</Text>
          </TouchableOpacity>
        ),
      })}
    >
      {!isAdmin && (
        <Tab.Screen
          name="MarkAttendance"
          component={MarkAttendanceScreen}
          options={{
            title: 'Mark Attendance',
            tabBarLabel: 'Attendance'
          }}
        />
      )}
      <Tab.Screen
        name="AttendanceList"
        component={AttendanceListScreen}
        options={{
          title: 'Attendance History',
          tabBarLabel: 'History'
        }}
      />
      {!isAdmin && (
        <>
          <Tab.Screen
            name="LeaveApplication"
            component={LeaveApplicationScreen}
            options={{
              title: 'Apply for Leave',
              tabBarLabel: 'Apply Leave'
            }}
          />
          <Tab.Screen
            name="LeaveHistory"
            component={LeaveHistoryScreen}
            options={{
              title: 'Leave History',
              tabBarLabel: 'My Leaves'
            }}
          />
        </>
      )}
      {isAdmin && (
        <Tab.Screen
          name="AdminLeaveManagement"
          component={AdminLeaveManagementScreen}
          options={{
            title: 'Leave Management',
            tabBarLabel: 'Manage Leaves'
          }}
        />
      )}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={TabNavigator} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
