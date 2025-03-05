import { io, Socket } from 'socket.io-client';
import { Alert, Platform } from 'react-native';
import { 
  RTCSessionDescriptionInit,
  RTCIceCandidateParam
} from '../types/webrtc';
import Config from 'react-native-config';

// Usar Config para obtener variables de entorno
const SERVER_URL = Config.SOCKET_SERVER_URL || 'http://172.16.2.107:3000';

// Para debugging
console.log('Conectando al servidor:', SERVER_URL);

// Define socket event types for better type checking
interface ServerToClientEvents {
  notification: (message: string, department: string) => void;
  responseReceived: (accepted: boolean, department: string) => void;
  llamada_entrante: (callerDepartment: string) => void;
  llamada_aceptada: (department: string) => void;
  llamada_rechazada: (department: string) => void;
  // WebRTC events
  webrtc_offer: (offer: RTCSessionDescriptionInit, from: string) => void;
  webrtc_answer: (answer: RTCSessionDescriptionInit, from: string) => void;
  webrtc_ice_candidate: (candidate: RTCIceCandidateParam, from: string) => void;
  webrtc_end_call: (from: string) => void;
}

interface ClientToServerEvents {
  sendNotification: (department: string, message: string) => void;
  responseToNotification: (department: string, accepted: boolean) => void;
  registrar: (role: string) => void;
  iniciar_llamada: (department: string) => void;
  aceptar_llamada: (department: string) => void;
  rechazar_llamada: (department: string) => void;
  // WebRTC events
  webrtc_offer: (offer: RTCSessionDescriptionInit, to: string) => void;
  webrtc_answer: (answer: RTCSessionDescriptionInit, to: string) => void;
  webrtc_ice_candidate: (candidate: RTCIceCandidateParam, to: string) => void;
  webrtc_end_call: (to: string) => void;
}

// Create socket instance with improved configuration
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ['websocket'],
  forceNew: true,
});

// Event handlers for connection status
socket.on('connect', () => {
  console.log('Connected to socket server');
});

socket.on('disconnect', (reason) => {
  console.log(`Disconnected from socket server: ${reason}`);
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error.message);
  // Only show alert in development mode
  if (__DEV__) {
    console.log('Connection error details:', error);
    // On Android simulator connecting to localhost, suggest using 10.0.2.2
    if (Platform.OS === 'android' && SERVER_URL.includes('localhost')) {
      console.log('On Android simulator, try using 10.0.2.2 instead of localhost');
    }
  }
});

// Add reconnect event handlers
socket.io.on('reconnect_attempt', (attemptNumber) => {
  console.log(`Socket reconnect attempt: ${attemptNumber}`);
});

socket.io.on('reconnect', (attemptNumber) => {
  console.log(`Socket reconnected after ${attemptNumber} attempts`);
});

// Helper functions
const isConnected = (): boolean => {
  return socket.connected;
};

// Connect function with error handling
const connect = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (socket.connected) {
      resolve(true);
      return;
    }
    
    // Set a timeout to detect connection failure
    const timeoutId = setTimeout(() => {
      console.log('Connection attempt timed out');
      resolve(false);
    }, 5000);
    
    // Listen for connect event
    const onConnect = () => {
      clearTimeout(timeoutId);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      resolve(true);
    };
    
    // Listen for connection error
    const onConnectError = (err: Error) => {
      console.log('Connection error in connect function:', err.message);
    };
    
    socket.once('connect', onConnect);
    socket.once('connect_error', onConnectError);
    
    // Initiate connection
    socket.connect();
  });
};

// Initialize connection when module is imported
connect();

const disconnect = (): void => {
  if (socket.connected) {
    socket.disconnect();
  }
};

// Send notification to a department
const sendNotification = (department: string, message: string): void => {
  socket.emit('sendNotification', department, message);
};

// Send response to a notification
const respondToNotification = (department: string, accepted: boolean): void => {
  socket.emit('responseToNotification', department, accepted);
};

export {
  socket,
  isConnected,
  connect,
  disconnect,
  sendNotification,
  respondToNotification
};
