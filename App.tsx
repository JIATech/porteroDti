import React, { useState, useEffect } from 'react';
import { StatusBar, View, Text, StyleSheet, ActivityIndicator, BackHandler } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { registerRootComponent } from 'expo';

// Import screens
import RoleSelectionScreen from './screens/RoleSelectionScreen';
import PorteroScreen from './screens/PorteroScreen';
import DepartamentoScreen from './screens/DepartamentoScreen';
import { THEME } from './utils/constants';
import { RootStackParamList } from './types/navigation';
import { socket, connect, isConnected } from './services/socketService';

// Create stack navigator
const Stack = createStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  const [connectionReady, setConnectionReady] = useState<boolean>(socket.connected);
  const [connecting, setConnecting] = useState<boolean>(!socket.connected);
  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);

  // Prevent app from being closed with back button from role selection screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Always prevent exiting the app
      return true;
    });
    
    return () => backHandler.remove();
  }, []);

  // Handle socket connection
  useEffect(() => {
    const setupConnection = async () => {
      if (!isConnected()) {
        setConnecting(true);
        setConnectionAttempts(prev => prev + 1);
        
        const connected = await connect();
        setConnectionReady(connected);
        setConnecting(false);
      } else {
        setConnectionReady(true);
        setConnecting(false);
      }
    };

    const handleConnect = () => {
      setConnectionReady(true);
      setConnecting(false);
    };

    const handleDisconnect = () => {
      setConnectionReady(false);
    };

    // Set up event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Try to connect if not already connected
    if (!socket.connected) {
      setupConnection();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  // If still trying to connect and less than 3 attempts, show loading
  if (connecting && connectionAttempts < 3) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Conectando al servidor...</Text>
      </View>
    );
  }

  // Navigation structure remains the same
  return (
    <NavigationContainer>
      {/* Show connection status in header */}
      <StatusBar
        backgroundColor={connectionReady ? THEME.PRIMARY_COLOR : '#c62828'}
        barStyle="dark-content"
      />
      
      <Stack.Navigator
        initialRouteName="RoleSelection"
        screenOptions={{
          headerStyle: {
            backgroundColor: THEME.PRIMARY_COLOR,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          cardStyle: { backgroundColor: THEME.BACKGROUND_COLOR },
          headerLeft: () => null, // Remove back button from all screens
          gestureEnabled: false, // Disable swipe gestures for navigation
        }}
      >
        <Stack.Screen 
          name="RoleSelection" 
          component={RoleSelectionScreen} 
          options={{ 
            title: 'Selección de Rol',
            headerShown: false,
          }}
        />
        
        <Stack.Screen 
          name="Portero" 
          component={PorteroScreen} 
          options={{ 
            title: 'Portero DTI',
          }} 
        />
        
        <Stack.Screen 
          name="Departamento" 
          component={DepartamentoScreen} 
          options={({ route }) => ({ 
            title: route.params?.departmentName || 'Departamento',
          })} 
        />
      </Stack.Navigator>

      {/* Show connection status indicator if not connected */}
      {!connectionReady && !connecting && (
        <View style={styles.connectionWarning}>
          <Text style={styles.connectionWarningText}>
            Sin conexión al servidor - Intentando reconectar...
          </Text>
        </View>
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.BACKGROUND_COLOR,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: THEME.TEXT_COLOR,
  },
  connectionWarning: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#c62828',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  connectionWarningText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 14,
  },
});

// Register the main component
registerRootComponent(App);

export default App;
