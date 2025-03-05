import React, { useState } from 'react';
import { View, StyleSheet, Text, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { THEME } from '../utils/constants';
import { socket } from '../services/socketService';

// Define the navigation param list type
type RootStackParamList = {
  RoleSelection: undefined;
  Portero: undefined;
  Departamento: { departmentName: string };
};

// Define the navigation prop type
type RoleScreenNavigationProp = StackNavigationProp<RootStackParamList>;

/**
 * Screen for selecting a user role
 */
const RoleSelectionScreen: React.FC = () => {
  // Get navigation object
  const navigation = useNavigation<RoleScreenNavigationProp>();
  
  // State to track selected role
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Array of available roles
  const roles: string[] = [
    'Portero',
    'Sistemas',
    'Administración',
    'Infraestructura',
    'Soporte'
  ];

  // Handle role selection
  const handleRoleSelection = (role: string): void => {
    setSelectedRole(role);
    
    // Show confirmation alert
    Alert.alert(
      'Confirmación',
      `Rol seleccionado: ${role}`,
      [
        { 
          text: 'OK', 
          onPress: () => {
            console.log(`Selected role: ${role}`);
            
            // Register role with the socket server
            socket.emit('registrar', role);
            console.log(`Registered role ${role} with socket server`);
            
            // Navigate based on selected role
            if (role === 'Portero') {
              navigation.navigate('Portero');
            } else {
              // For all department roles, navigate to department screen with the role name as parameter
              navigation.navigate('Departamento', { 
                departmentName: role 
              });
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Selecciona tu rol</Text>
        
        <View style={styles.buttonContainer}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role}
              style={[
                styles.button, 
                selectedRole === role && styles.selectedButton
              ]}
              onPress={() => handleRoleSelection(role)}
            >
              <Text 
                style={[
                  styles.buttonText,
                  selectedRole === role && styles.selectedButtonText
                ]}
              >
                {role}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {selectedRole && (
          <Text style={styles.selectionInfo}>
            Has seleccionado: <Text style={styles.selectedRoleText}>{selectedRole}</Text>
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.BACKGROUND_COLOR,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    color: THEME.TEXT_COLOR,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: THEME.PRIMARY_COLOR,
    width: '85%', // Increased width
    padding: 20, // More padding
    borderRadius: 12, // More rounded corners
    marginBottom: 24, // More space between buttons
    alignItems: 'center',
    elevation: 4, // Stronger shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  buttonText: {
    color: '#fff',
    fontSize: 22, // Larger text
    fontWeight: 'bold',
    letterSpacing: 0.5, // Slight letter spacing for better readability
  },
  selectedButton: {
    backgroundColor: THEME.SECONDARY_COLOR,
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ scale: 1.05 }], // Slight scale effect
  },
  selectedButtonText: {
    color: '#fff',
  },
  selectionInfo: {
    marginTop: 20,
    fontSize: 16,
    color: THEME.TEXT_COLOR,
  },
  selectedRoleText: {
    fontWeight: 'bold',
    color: THEME.SECONDARY_COLOR,
  },
});

export default RoleSelectionScreen;
