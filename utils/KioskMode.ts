import { BackHandler, Platform, StatusBar, Alert } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as SecureStore from 'expo-secure-store';

// Clave para almacenar el código de administrador
const ADMIN_CODE_KEY = 'porteroDtiAdminCode';
// Código de administrador por defecto
const DEFAULT_ADMIN_CODE = '2468';

/**
 * Utility class for implementing kiosk mode in the application
 */
class KioskMode {
  private backHandlerSubscription: any = null;
  private isAdminMode: boolean = false;

  /**
   * Enable kiosk mode with all restrictions
   */
  enable = async () => {
    // Inicializar el código de admin si no existe
    await this.initAdminCode();
    
    // Prevent app from going to sleep
    activateKeepAwake();
    
    // Lock orientation to portrait
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    
    // Hide status bar
    StatusBar.setHidden(true, 'none');
    
    // Disable back button completely (Android)
    this.disableBackButton();
    
    // Reset admin mode
    this.isAdminMode = false;
  };

  /**
   * Disable kiosk mode and restore normal functionality
   */
  disable = async () => {
    // Allow app to sleep normally
    deactivateKeepAwake();
    
    // Unlock orientation
    await ScreenOrientation.unlockAsync();
    
    // Show status bar
    StatusBar.setHidden(false, 'none');
    
    // Re-enable back button
    this.enableBackButton();
  };

  /**
   * Completely disable the hardware back button
   */
  disableBackButton = () => {
    // Remove any existing handlers first
    this.enableBackButton();
    
    // Add handler that prevents back button action
    this.backHandlerSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // Always return true to prevent default behavior
        return true;
      }
    );
  };

  /**
   * Re-enable the hardware back button
   */
  enableBackButton = () => {
    if (this.backHandlerSubscription) {
      this.backHandlerSubscription.remove();
      this.backHandlerSubscription = null;
    }
  };

  /**
   * Inicializa el código de administrador si no existe
   */
  initAdminCode = async () => {
    try {
      const storedCode = await SecureStore.getItemAsync(ADMIN_CODE_KEY);
      if (!storedCode) {
        await SecureStore.setItemAsync(ADMIN_CODE_KEY, DEFAULT_ADMIN_CODE);
      }
    } catch (error) {
      console.error('Error al inicializar el código de administrador:', error);
    }
  };

  /**
   * Verificar si el código proporcionado es correcto
   */
  verifyAdminCode = async (code: string): Promise<boolean> => {
    try {
      const storedCode = await SecureStore.getItemAsync(ADMIN_CODE_KEY);
      return code === storedCode;
    } catch (error) {
      console.error('Error al verificar el código de administrador:', error);
      return false;
    }
  };

  /**
   * Cambiar el código de administrador
   */
  changeAdminCode = async (newCode: string): Promise<boolean> => {
    try {
      await SecureStore.setItemAsync(ADMIN_CODE_KEY, newCode);
      return true;
    } catch (error) {
      console.error('Error al cambiar el código de administrador:', error);
      return false;
    }
  };

  /**
   * Mostrar diálogo de autenticación de administrador
   */
  showAdminAuthDialog = (
    onSuccess: () => void,
    onCancel: () => void = () => {}
  ) => {
    let inputCode = '';
    
    Alert.prompt(
      'Acceso de Administrador',
      'Ingrese el código de administrador para salir de la aplicación:',
      [
        {
          text: 'Cancelar',
          onPress: onCancel,
          style: 'cancel',
        },
        {
          text: 'Verificar',
          onPress: async (code) => {
            if (!code) {
              Alert.alert('Error', 'Debe ingresar un código');
              return;
            }
            
            const isValid = await this.verifyAdminCode(code);
            if (isValid) {
              this.isAdminMode = true;
              onSuccess();
            } else {
              Alert.alert('Error', 'Código incorrecto');
            }
          }
        },
      ],
      'secure-text'
    );
  };

  /**
   * Mostrar el menú de administrador
   */
  showAdminMenu = (onExit: () => void) => {
    if (!this.isAdminMode) return;
    
    Alert.alert(
      'Menú de Administrador',
      '¿Qué acción desea realizar?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Cambiar código',
          onPress: this.promptChangeCode,
        },
        {
          text: 'Salir de la aplicación',
          onPress: onExit,
          style: 'destructive',
        },
      ]
    );
  };

  /**
   * Mostrar diálogo para cambiar el código de administrador
   */
  promptChangeCode = () => {
    if (!this.isAdminMode) return;
    
    Alert.prompt(
      'Cambiar Código',
      'Ingrese el nuevo código de administrador:',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Guardar',
          onPress: async (newCode) => {
            if (!newCode || newCode.length < 4) {
              Alert.alert('Error', 'El código debe tener al menos 4 caracteres');
              return;
            }
            
            const success = await this.changeAdminCode(newCode);
            if (success) {
              Alert.alert('Éxito', 'Código de administrador actualizado');
            } else {
              Alert.alert('Error', 'No se pudo actualizar el código');
            }
          }
        },
      ],
      'secure-text'
    );
  };
}

export default new KioskMode();
