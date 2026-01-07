import { NavigationContainer } from '@react-navigation/native';
import { AppRegistry, LogBox, useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider, adaptNavigationTheme } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// Suppress SSRProvider warning for React 18+
LogBox.ignoreLogs([
  'In React 18, SSRProvider is not necessary and is a noop. You can remove it from your app.'
]);

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: undefined,
  reactNavigationDark: undefined,
});

const CombinedDefaultTheme = {
  ...MD3LightTheme,
  ...LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...LightTheme.colors,
  },
};

const CombinedDarkTheme = {
  ...MD3DarkTheme,
  ...DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...DarkTheme.colors,
  },
};

function App() {
  const colorScheme = useColorScheme();

  const paperTheme = colorScheme === 'dark' ? CombinedDarkTheme : CombinedDefaultTheme;

  return (
    <PaperProvider theme={paperTheme}>
      <AuthProvider>
        <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : LightTheme}>
          <AppNavigator />
          <Toast />
        </NavigationContainer>
      </AuthProvider>
    </PaperProvider>
  );
}

AppRegistry.registerComponent('attendanceapp', () => App);

export default App;
