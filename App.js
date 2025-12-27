import { NavigationContainer } from '@react-navigation/native';
import { AppRegistry, LogBox } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// Suppress SSRProvider warning for React 18+
LogBox.ignoreLogs([
  'In React 18, SSRProvider is not necessary and is a noop. You can remove it from your app.'
]);

function App() {
  return (
    <PaperProvider>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </PaperProvider>
  );
}

AppRegistry.registerComponent('attendanceapp', () => App);

export default App;
