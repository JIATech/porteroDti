import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, PanResponder, BackHandler } from 'react-native';
import KioskMode from '../utils/KioskMode';

interface AdminTriggerProps {
  corner?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  size?: number;
}

/**
 * Componente invisible que detecta un gesto específico para activar
 * el panel de administrador.
 * 
 * Se debe presionar 5 veces rápidamente en la esquina donde está ubicado.
 */
const AdminTrigger: React.FC<AdminTriggerProps> = ({ 
  corner = 'bottomRight',
  size = 50
}) => {
  const [tapCount, setTapCount] = useState(0);
  const timeout = useRef<NodeJS.Timeout | null>(null);
  
  // Función para manejar el cierre de la aplicación
  const handleExit = () => {
    KioskMode.disable();
    setTimeout(() => {
      BackHandler.exitApp();
    }, 300);
  };

  // Función para manejar el tap secreto
  const handleSecretTap = () => {
    setTapCount(prev => prev + 1);
    
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    
    timeout.current = setTimeout(() => {
      // Resetear contador si no se completa la secuencia
      setTapCount(0);
    }, 1500);
  };
  
  // Efecto para verificar si se completó la secuencia
  useEffect(() => {
    if (tapCount >= 5) {
      setTapCount(0);
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      
      // Mostrar diálogo de autenticación
      KioskMode.showAdminAuthDialog(() => {
        // Si la autenticación es exitosa, mostrar menú de administrador
        KioskMode.showAdminMenu(handleExit);
      });
    }
  }, [tapCount]);
  
  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, []);
  
  // Determinar posición según la esquina seleccionada
  const getPositionStyle = () => {
    switch (corner) {
      case 'topLeft':
        return { top: 0, left: 0 };
      case 'topRight':
        return { top: 0, right: 0 };
      case 'bottomLeft':
        return { bottom: 0, left: 0 };
      case 'bottomRight':
      default:
        return { bottom: 0, right: 0 };
    }
  };
  
  return (
    <TouchableOpacity
      style={[
        styles.trigger,
        getPositionStyle(),
        { width: size, height: size }
      ]}
      onPress={handleSecretTap}
      activeOpacity={1}
    />
  );
};

const styles = StyleSheet.create({
  trigger: {
    position: 'absolute',
    zIndex: 999,
    // El componente es completamente transparente
    backgroundColor: 'transparent',
  }
});

export default AdminTrigger;
