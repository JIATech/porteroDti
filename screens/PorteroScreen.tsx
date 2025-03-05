import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, SafeAreaView, TouchableOpacity, Alert, Platform, PermissionsAndroid, BackHandler, GestureResponderEvent } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { THEME } from '../utils/constants';
import { socket } from '../services/socketService';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
  RTCView,
} from 'react-native-webrtc';

// Import our custom type definitions
import {
  RTCSdpType,
  RTCSessionDescriptionInit,
  RTCIceCandidateInit,
  RTCIceCandidateParam,
  RTCTrackEvent,
  RTCPeerConnectionIceEvent,
  RTCPeerConnectionWithEvents,
  RTCMediaStream
} from '../types/webrtc';

type RootStackParamList = {
  RoleSelection: undefined;
  Portero: undefined;
  Departamento: { departmentName: string };
};

type PorteroScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Portero'>;
};

type DepartmentIconMap = {
  [key: string]: string;
};

type CallStatus = 'idle' | 'calling' | 'connected' | 'ended';

/**
 * Screen for porter (portero) role with department selection
 */
const PorteroScreen: React.FC<PorteroScreenProps> = ({ navigation }) => {
  // State to track selected department
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  
  // WebRTC states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);

  // WebRTC refs
  const peerConnection = useRef<RTCPeerConnectionWithEvents | null>(null);
  const currentDepartment = useRef<string | null>(null);

  // Configuration for WebRTC
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Handle back button press during call
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (callStatus !== 'idle') {
        Alert.alert(
          "¿Finalizar llamada?",
          "¿Estás seguro de que deseas finalizar la llamada?",
          [
            { text: "No", style: "cancel" },
            { text: "Sí", onPress: () => endCallFunction() }
          ]
        );
        return true; // Prevent default back action
      }
      return false; // Let default back action happen
    });

    return () => backHandler.remove();
  }, [callStatus]);

  // Request permissions and initialize WebRTC
  useEffect(() => {
    const initializeWebRTC = async () => {
      try {
        // Request permissions on Android
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
          
          if (
            granted[PermissionsAndroid.PERMISSIONS.CAMERA] !== PermissionsAndroid.RESULTS.GRANTED ||
            granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED
          ) {
            Alert.alert('Permisos requeridos', 
              'Se necesitan permisos de cámara y micrófono para videollamadas');
            return;
          }
        }

        // Get user media stream with error handling
        const constraints = {
          audio: true,
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        };

        console.log('Requesting user media with constraints:', constraints);
        const stream = await mediaDevices.getUserMedia(constraints);
        console.log('Got local stream with tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
        setLocalStream(stream);
      } catch (err) {
        console.error('Failed to get media stream:', err);
        Alert.alert('Error', 'No se pudo acceder a la cámara o micrófono. ' + String(err));
      }
    };

    initializeWebRTC().catch(err => {
      console.error('Error in initializeWebRTC:', err);
    });

    return () => {
      // Clean up on unmount - improved cleanup
      if (localStream) {
        console.log('Stopping local stream tracks');
        localStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      endCallFunction(false); // Don't send end call event on unmount
    };
  }, []);

  // Set up socket event listeners with better error handling
  useEffect(() => {
    // Handle accepted call
    const handleAcceptedCall = (department: string) => {
      console.log(`Call accepted by department: ${department}`);
      
      // Show user that the call was accepted
      Alert.alert(
        'Llamada Aceptada',
        `Llamada aceptada por ${department}. Iniciando videollamada...`,
        [{ text: 'OK' }]
      );
      
      // Store the current department
      currentDepartment.current = department;
      
      // Start WebRTC connection
      setCallStatus('calling');
      
      try {
        // Only create peer connection if it doesn't exist
        if (!peerConnection.current) {
          const success = createPeerConnection();
          if (success) {
            sendOffer().catch(err => {
              console.error('Error sending offer:', err);
              Alert.alert('Error', 'No se pudo iniciar la videollamada');
              endCallFunction();
            });
          }
        } else {
          console.warn('Peer connection already exists');
        }
      } catch (err) {
        console.error('Error in handleAcceptedCall:', err);
        Alert.alert('Error', 'Error al iniciar la videollamada');
      }
    };

    // Handle rejected call
    const handleRejectedCall = (department: string) => {
      console.log(`Call rejected by department: ${department}`);
      Alert.alert(
        'Llamada Rechazada',
        `Llamada rechazada por ${department}.`,
        [{ text: 'OK' }]
      );
      setCallStatus('idle');
      currentDepartment.current = null;
    };

    // Fix typings for WebRTC events
    const handleWebRTCAnswer = async (answer: RTCSessionDescriptionInit, from: string) => {
      console.log('Received WebRTC answer from:', from);
      
      try {
        if (!peerConnection.current) {
          console.error('No peer connection when receiving answer');
          return;
        }
        
        if (peerConnection.current.signalingState === 'stable') {
          console.warn('Signaling state already stable, ignoring answer');
          return;
        }

        // Creating a proper RTCSessionDescription object with type assertion
        const rtcSessionDescription = new RTCSessionDescription({
          type: answer.type as RTCSdpType,
          sdp: answer.sdp
        });
        
        await peerConnection.current.setRemoteDescription(rtcSessionDescription);
        console.log('Remote description set successfully');
        setCallStatus('connected');
      } catch (err) {
        console.error('Error setting remote description:', err);
        Alert.alert('Error', 'Error en la conexión de videollamada');
        endCallFunction();
      }
    };

    // Handle ICE candidate with better error handling - updated parameter type
    const handleICECandidate = async (candidate: RTCIceCandidateParam, from: string) => {
      try {
        if (peerConnection.current && peerConnection.current.remoteDescription) {
          console.log('Adding ICE candidate');
          // Create a proper RTCIceCandidate with null-checked parameters
          const iceCandidate = new RTCIceCandidate({
            candidate: candidate.candidate || '',
            sdpMid: candidate.sdpMid ?? null,  // Use nullish coalescing to handle undefined
            sdpMLineIndex: candidate.sdpMLineIndex ?? 0  // Use nullish coalescing with default 0
          });
          await peerConnection.current.addIceCandidate(iceCandidate);
        } else {
          console.warn('Cannot add ICE candidate yet - no remote description');
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    };

    // Handle call end
    const handleEndCall = (from: string) => {
      console.log('Call ended by:', from);
      Alert.alert('Llamada finalizada', `${from} ha finalizado la llamada.`);
      endCallFunction();
    };

    // Register event listeners
    socket.on('llamada_aceptada', handleAcceptedCall);
    socket.on('llamada_rechazada', handleRejectedCall);
    socket.on('webrtc_answer', handleWebRTCAnswer);
    socket.on('webrtc_ice_candidate', handleICECandidate);
    socket.on('webrtc_end_call', handleEndCall);

    // Clean up listeners on unmount
    return () => {
      socket.off('llamada_aceptada', handleAcceptedCall);
      socket.off('llamada_rechazada', handleRejectedCall);
      socket.off('webrtc_answer', handleWebRTCAnswer);
      socket.off('webrtc_ice_candidate', handleICECandidate);
      socket.off('webrtc_end_call', handleEndCall);
    };
  }, []);

  // Create RTCPeerConnection with improved error handling and logging
  const createPeerConnection = useCallback(() => {
    console.log('Creating peer connection');
    
    try {
      // Close any existing connection first
      if (peerConnection.current) {
        console.log('Closing existing peer connection');
        peerConnection.current.close();
        peerConnection.current = null;
      }
      
      // Create new peer connection and cast as our extended interface
      const pc = new RTCPeerConnection(rtcConfiguration);
      const extendedPc = pc as unknown as RTCPeerConnectionWithEvents;
      peerConnection.current = extendedPc;
      
      console.log('RTCPeerConnection created with config:', rtcConfiguration);
      
      // Add local tracks to peer connection
      if (localStream) {
        const tracks = localStream.getTracks();
        console.log(`Adding ${tracks.length} local tracks to peer connection`);
        
        tracks.forEach(track => {
          if (extendedPc && localStream) {
            extendedPc.addTrack(track, localStream);
          }
        });
      } else {
        console.error('No local stream available when creating peer connection');
        Alert.alert('Error', 'No se pudo iniciar la videollamada (sin acceso a cámara)');
        return false;
      }

      // Set up remote stream handling
      extendedPc.ontrack = (event: RTCTrackEvent) => {
        console.log('Got remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          console.log('Setting remote stream');
          setRemoteStream(event.streams[0]);
        } else {
          console.warn('Received track without stream');
        }
      };

      // Handle ICE candidates
      extendedPc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate && currentDepartment.current) {
          console.log('Generated ICE candidate for', currentDepartment.current);
          // Convert to plain object before sending via socket
          const candidateObj: RTCIceCandidateParam = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid ?? null,  // Use nullish coalescing to ensure null instead of undefined
            sdpMLineIndex: event.candidate.sdpMLineIndex ?? null  // Use nullish coalescing to ensure null instead of undefined
          };
          socket.emit('webrtc_ice_candidate', candidateObj, currentDepartment.current);
        } else if (!event.candidate) {
          console.log('ICE gathering complete');
        }
      };

      // Other event handlers
      extendedPc.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', extendedPc.iceGatheringState);
      };

      extendedPc.onsignalingstatechange = () => {
        console.log('Signaling state:', extendedPc.signalingState);
      };

      // Log connection state changes
      extendedPc.onconnectionstatechange = () => {
        console.log('Connection state:', extendedPc.connectionState);
        
        // Handle connection failures
        if (extendedPc) {
          const state = extendedPc.connectionState;
          if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            console.warn(`WebRTC connection state changed to ${state}. Ending call.`);
            endCallFunction();
          }
        }
      };

      extendedPc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', extendedPc.iceConnectionState);
        
        // Handle ICE failures
        if (extendedPc) {
          const state = extendedPc.iceConnectionState;
          if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            console.warn(`ICE connection state changed to ${state}. Possible connection problem.`);
          }
        }
      };

      return true;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      Alert.alert('Error', 'No se pudo establecer la conexión de video');
      return false;
    }
  }, [localStream]);

  // Create and send WebRTC offer with better error handling
  const sendOffer = async () => {
    try {
      if (!peerConnection.current || !currentDepartment.current) {
        console.error('Cannot send offer: missing peer connection or department');
        return false;
      }
      
      console.log('Creating offer for', currentDepartment.current);
      
      // Create offer with explicit constraints
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      console.log('Setting local description');
      await peerConnection.current.setLocalDescription(offer);
      
      // Wait a moment to ensure ICE gathering has started
      setTimeout(() => {
        if (!peerConnection.current || !currentDepartment.current) return;
        
        // Use the current local description which might include ICE candidates
        const currentOffer = peerConnection.current.localDescription;
        
        console.log('Sending offer to', currentDepartment.current);
        if (currentOffer) {
          // Convert to plain object to avoid circular reference issues
          const plainOffer: RTCSessionDescriptionInit = {
            type: currentOffer.type as RTCSdpType,
            sdp: currentOffer.sdp
          };
          socket.emit('webrtc_offer', plainOffer, currentDepartment.current);
        } else {
          console.error('No local description available to send');
        }
      }, 500);
      
      return true;
    } catch (error) {
      console.error('Error creating offer:', error);
      Alert.alert('Error', 'No se pudo iniciar la videollamada');
      endCallFunction();
      return false;
    }
  };

  // End the current call with improved cleanup - renamed to avoid type conflicts
  const endCallFunction = (sendEndEvent = true) => {
    console.log('Ending call, sendEndEvent:', sendEndEvent);
    
    if (sendEndEvent && currentDepartment.current) {
      socket.emit('webrtc_end_call', currentDepartment.current);
    }
    
    // Close peer connection
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    // Clean up remote stream
    if (remoteStream) {
      console.log('Cleaning up remote stream');
      remoteStream.getTracks().forEach(track => {
        track.stop();
      });
      setRemoteStream(null);
    }
    
    // Reset call state
    setCallStatus('idle');
    currentDepartment.current = null;
  };

  // Toggle microphone
  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle camera
  const toggleCamera = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  // Handler for ending the call from the UI
  const handleEndCallPress = useCallback((event: GestureResponderEvent) => {
    endCallFunction(true);
  }, []);

  // Array of available departments
  const departments: string[] = [
    'Sistemas',
    'Administración',
    'Infraestructura',
    'Soporte'
  ];

  // Department icons/emojis - can be replaced with actual icons later
  const departmentIcons: DepartmentIconMap = {
    'Sistemas': '💻',
    'Administración': '📊',
    'Infraestructura': '🏢',
    'Soporte': '🛠️'
  };

  // Handle department selection
  const handleDepartmentSelection = (department: string): void => {
    setSelectedDepartment(department);
    
    // Show confirmation alert
    Alert.alert(
      'Selección de Departamento',
      `Has seleccionado: ${department}`,
      [
        { 
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => console.log('Department selection cancelled')
        },
        { 
          text: 'Confirmar', 
          onPress: () => {
            console.log(`Selected department: ${department}`);
            
            // Store current department
            currentDepartment.current = department;
            
            // Emit socket event to initiate a call
            socket.emit('iniciar_llamada', department);
            console.log(`Initiated call to department: ${department}`);
            
            // Show notification alert
            Alert.alert(
              'Notificación Enviada',
              `Se ha notificado al departamento de ${department}.`
            );
          }
        }
      ]
    );
  };

  // Render call controls
  const renderCallControls = () => {
    if (callStatus === 'connected') {
      return (
        <View style={styles.callControls}>
          <TouchableOpacity 
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={toggleMute}
          >
            <Text style={styles.controlButtonText}>
              {isMuted ? 'Activar Mic' : 'Silenciar'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.endCallButton]}
            onPress={handleEndCallPress}
          >
            <Text style={styles.controlButtonText}>Finalizar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, isCameraOff && styles.controlButtonActive]}
            onPress={toggleCamera}
          >
            <Text style={styles.controlButtonText}>
              {isCameraOff ? 'Activar Cám' : 'Apagar Cám'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  // Render video call UI or department selection UI with improved UI
  const renderContent = () => {
    if (callStatus === 'connected' || callStatus === 'calling') {
      return (
        <View style={styles.callContainer}>
          {/* Remote video (full screen) */}
          {remoteStream && (
            <RTCView
              streamURL={remoteStream.toURL()}
              style={styles.remoteVideo}
              objectFit="cover"
              zOrder={0} // Ensure remote video is below local video
            />
          )}
          
          {/* Local video (picture-in-picture) */}
          {localStream && (
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              zOrder={1} // Ensure local video is above remote video
              mirror={true} // Mirror the front camera
            />
          )}
          
          {/* Status text when calling but not yet connected */}
          {callStatus === 'calling' && !remoteStream && (
            <View style={styles.callingOverlay}>
              <Text style={styles.callingText}>Conectando videollamada...</Text>
            </View>
          )}
          
          {/* Call controls */}
          {renderCallControls()}
        </View>
      );
    } else {
      // Department selection UI (default)
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Portero DTI</Text>
          <Text style={styles.subtitle}>Selecciona un departamento para notificar</Text>
          
          <View style={styles.buttonGrid}>
            {departments.map((department) => (
              <TouchableOpacity
                key={department}
                style={[
                  styles.button, 
                  selectedDepartment === department && styles.selectedButton
                ]}
                onPress={() => handleDepartmentSelection(department)}
              >
                <Text style={styles.buttonIcon}>{departmentIcons[department]}</Text>
                <Text 
                  style={[
                    styles.buttonText,
                    selectedDepartment === department && styles.selectedButtonText
                  ]}
                >
                  {department}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderContent()}
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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: THEME.SECONDARY_COLOR,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
    color: THEME.TEXT_COLOR,
    textAlign: 'center',
  },
  buttonGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  button: {
    backgroundColor: THEME.PRIMARY_COLOR,
    width: '46%', // Slightly larger
    height: 170, // Taller buttons
    padding: 18,
    borderRadius: 18, // More rounded corners
    margin: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5, // Stronger shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  selectedButton: {
    backgroundColor: THEME.SECONDARY_COLOR,
    borderWidth: 3,
    borderColor: '#fff',
    transform: [{ scale: 1.05 }],
  },
  buttonIcon: {
    fontSize: 46, // Larger icon
    marginBottom: 14,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20, // Larger text
    fontWeight: 'bold',
    textAlign: 'center',
  },
  selectedButtonText: {
    color: '#fff',
  },
  // Video call styles
  callContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#000',
  },
  localVideo: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 120,
    height: 160,
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  callingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  callingText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  callControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  controlButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(80, 80, 80, 0.8)',
    borderRadius: 24,
    minWidth: 100,
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(180, 20, 20, 0.8)',
  },
  endCallButton: {
    backgroundColor: '#c62828',
    paddingVertical: 15,
  },
  controlButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});

export default PorteroScreen;
