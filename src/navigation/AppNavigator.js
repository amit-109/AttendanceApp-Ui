import { MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, TouchableOpacity, Image, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import AttendanceListScreen from '../screens/AttendanceListScreen';
import LeaveManagementScreen from '../screens/LeaveManagementScreen';
import LoginScreen from '../screens/LoginScreen';
import MarkAttendanceScreen from '../screens/MarkAttendanceScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const LogoTitle = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Image
        source={require('../../assets/images/SE_Logo_Rev1.png')}
        style={{ width: 32, height: 32, marginRight: 8 }}
        resizeMode="contain"
      />
      <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>SecuryScope</Text>
    </View>
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'MarkAttendance') {
            iconName = 'camera';
          } else if (route.name === 'AttendanceList') {
            iconName = 'list';
          } else if (route.name === 'LeaveManagement') {
            iconName = 'event-note';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
        headerStyle: { backgroundColor: '#4CAF50' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      })}
    >
      <Tab.Screen
        name="MarkAttendance"
        component={MarkAttendanceScreen}
        options={{
          headerTitle: () => <LogoTitle />,
          tabBarLabel: 'Attendance'
        }}
      />
      <Tab.Screen
        name="AttendanceList"
        component={AttendanceListScreen}
        options={{
          headerTitle: () => <LogoTitle />,
          tabBarLabel: 'History'
        }}
      />
      <Tab.Screen
        name="LeaveManagement"
        component={LeaveManagementScreen}
        options={{
          headerTitle: () => <LogoTitle />,
          tabBarLabel: 'Leaves'
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: () => <LogoTitle />,
          tabBarLabel: 'Profile'
        }}
      />
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
