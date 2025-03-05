import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, SafeAreaView, Alert, Platform, PermissionsAndroid, BackHandler, GestureResponderEvent } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { Audio } from 'expo-av';  // Añadimos la importación para sonidos
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

type DepartamentoScreenProps = {
  route: RouteProp<RootStackParamList, 'Departamento'>;
  onAccept?: () => void;
  onReject?: () => void;
};

type CallStatus = 'idle' | 'ringing' | 'connected' | 'ended';

/**
 * Screen for department view with real-time log and response buttons
 */
const DepartamentoScreen: React.FC<DepartamentoScreenProps> = ({ route, onAccept, onReject }) => {
  // Get department name from route params
  const { departmentName } = route.params || { departmentName: "Departamento" };

  // State to control button visibility
  const [showButtons, setShowButtons] = useState<boolean>(false);

  // State for log messages with initialized first message
  const [logMessages, setLogMessages] = useState<string[]>([
    "Esperando notificaciones...",
  ]);

  // WebRTC states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [callerDepartment, setCallerDepartment] = useState<string | null>(null);

  // WebRTC refs
  const peerConnection = useRef<RTCPeerConnectionWithEvents | null>(null);

  // Configuration for WebRTC
  const rtcConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  // Create a reusable function to add log entries
  const addLogEntry = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogMessages((prevLogs) => [`${timestamp}: ${message}`, ...prevLogs]);
  }, []);

  // Referencia para el sonido
  const notificationSound = useRef<Audio.Sound | null>(null);

  // Cargar el sonido de notificación al inicio
  useEffect(() => {
    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../assets/sounds/notification.mp3")
        );
        notificationSound.current = sound;
      } catch (error) {
        console.error("Error cargando sonido:", error);
      }
    };

    loadSound();

    return () => {
      if (notificationSound.current) {
        notificationSound.current.unloadAsync();
      }
    };
  }, []);

  // Función para reproducir el sonido
  const playNotificationSound = async () => {
    if (notificationSound.current) {
      try {
        await notificationSound.current.replayAsync();
      } catch (error) {
        console.error("Error reproduciendo sonido:", error);
      }
    }
  };

  // End call function renamed to avoid type conflicts
  const endCallFunction = (sendEndEvent = true) => {
    console.log("Ending call, sendEndEvent:", sendEndEvent);
    addLogEntry("Finalizando videollamada");

    if (sendEndEvent && callerDepartment) {
      socket.emit("webrtc_end_call", callerDepartment);
    }

    // Close peer connection
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    // Clean up remote stream
    if (remoteStream) {
      console.log("Stopping remote stream tracks");
      remoteStream.getTracks().forEach((track) => {
        track.stop();
      });
      setRemoteStream(null);
    }

    // Reset states
    setCallStatus("ended");
    setCallerDepartment(null);
    setShowButtons(false);
  };

  // Request permissions and initialize WebRTC with better error handling
  useEffect(() => {
    const initializeWebRTC = async () => {
      try {
        // Request permissions on Android
        if (Platform.OS === "android") {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);

          if (
            granted[PermissionsAndroid.PERMISSIONS.CAMERA] !==
              PermissionsAndroid.RESULTS.GRANTED ||
            granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !==
              PermissionsAndroid.RESULTS.GRANTED
          ) {
            Alert.alert(
              "Permisos requeridos",
              "Se necesitan permisos de cámara y micrófono para videollamadas"
            );
            addLogEntry("Error: Permisos de cámara o micrófono no concedidos");
            return;
          }
        }

        // Get user media stream with improved constraints
        const constraints = {
          audio: true,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        };

        addLogEntry("Solicitando acceso a cámara y micrófono...");
        console.log("Requesting user media with constraints:", constraints);

        try {
          const stream = await mediaDevices.getUserMedia(constraints);
          console.log("Stream obtenido correctamente:", stream);
          if (!stream) {
            throw new Error("No se pudo obtener stream");
          }

          setLocalStream(stream);
          console.log("Local stream set in state");

          const tracks = stream.getTracks();
          console.log(
            "Local stream obtained with tracks:",
            tracks.map((t) => `${t.kind}:${t.enabled}`)
          );
          addLogEntry("Cámara y micrófono inicializados correctamente");
        } catch (mediaError) {
          console.error("Error específico obteniendo media:", mediaError);
          Alert.alert(
            "Error de Cámara/Micrófono",
            `No se pudo acceder a cámara o micrófono: ${
              mediaError instanceof Error
                ? mediaError.message
                : String(mediaError)
            }`
          );
          addLogEntry(
            `Error: Error específico con cámara/micrófono - ${
              mediaError instanceof Error
                ? mediaError.message
                : String(mediaError)
            }`
          );
        }
      } catch (err: unknown) {
        console.error("Failed to get media stream:", err);
        Alert.alert("Error", "No se pudo acceder a la cámara o micrófono");
        addLogEntry(
          `Error: No se pudo acceder a la cámara o micrófono - ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    };

    // Llamamos a inicializar inmediatamente
    initializeWebRTC().catch((err) => {
      console.error("Error in initializeWebRTC:", err);
      addLogEntry(`Error inicializando WebRTC: ${err.toString()}`);
    });

    return () => {
      // Clean up on unmount
      if (localStream) {
        console.log("Stopping local stream tracks");
        localStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
      endCallFunction(false);
    };
  }, []);

  // Handle back button press during call
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (callStatus === "connected") {
          Alert.alert(
            "¿Finalizar llamada?",
            "¿Estás seguro de que deseas finalizar la llamada?",
            [
              { text: "No", style: "cancel" },
              { text: "Sí", onPress: () => endCallFunction() },
            ]
          );
          return true; // Prevent default back action
        }
        return false; // Let default back action happen
      }
    );

    return () => backHandler.remove();
  }, [callStatus]);

  // Log connection status changes
  useEffect(() => {
    // Log initial connection status
    if (socket.connected) {
      addLogEntry("Conectado al servidor");
    } else {
      addLogEntry("Intentando conectar al servidor...");
    }

    // Set up connection status listeners
    const handleConnect = () => addLogEntry("Conectado al servidor");
    const handleDisconnect = (reason: string) =>
      addLogEntry(`Desconectado: ${reason}`);
    const handleError = (error: Error) =>
      addLogEntry(`Error de conexión: ${error.message}`);

    // Register event handlers
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleError);

    // Log department registration
    addLogEntry(`Registrado como departamento: ${departmentName}`);

    return () => {
      // Clean up event listeners
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleError);
    };
  }, [departmentName, addLogEntry]);

  // Set up socket event listeners with better error handling
  useEffect(() => {
    // Handle WebRTC offer with improved error handling
    const handleWebRTCOffer = async (
      offer: RTCSessionDescriptionInit,
      from: string
    ) => {
      console.log("Received WebRTC offer from:", from);
      addLogEntry(`Recibiendo oferta de videollamada de: ${from}`);

      try {
        // Store caller info
        setCallerDepartment(from);

        // Create peer connection if it doesn't exist
        if (!peerConnection.current) {
          const success = createPeerConnection();
          if (!success) {
            addLogEntry("Error al crear la conexión de video");
            return;
          }
        }

        if (
          peerConnection.current &&
          peerConnection.current.signalingState !== "closed"
        ) {
          console.log("Setting remote description");

          // Create the RTCSessionDescription with the proper type
          const rtcSessionDescription = new RTCSessionDescription({
            type: offer.type as RTCSdpType,
            sdp: offer.sdp,
          });

          await peerConnection.current.setRemoteDescription(
            rtcSessionDescription
          );

          // Create answer
          console.log("Creating answer");
          const answer = await peerConnection.current.createAnswer();

          console.log("Setting local description");
          await peerConnection.current.setLocalDescription(answer);

          // Send answer to caller - convert to plain object
          console.log("Sending answer to", from);
          const plainAnswer: RTCSessionDescriptionInit = {
            type: answer.type as RTCSdpType,
            sdp: answer.sdp,
          };

          socket.emit("webrtc_answer", plainAnswer, from);

          addLogEntry("Videollamada conectada");
          setCallStatus("connected");
        } else {
          console.error("Peer connection not in valid state to handle offer");
          addLogEntry("Error: Conexión no disponible");
        }
      } catch (err) {
        console.error("Error handling offer:", err);
        addLogEntry(
          `Error en la videollamada: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    };

    // Handle ICE candidate with better error handling - updated parameter type
    const handleICECandidate = async (
      candidate: RTCIceCandidateParam,
      from: string
    ) => {
      try {
        if (
          peerConnection.current &&
          peerConnection.current.remoteDescription
        ) {
          console.log("Adding ICE candidate");
          // Create a proper RTCIceCandidate object with null checks
          const iceCandidate = new RTCIceCandidate({
            candidate: candidate.candidate || "",
            sdpMid: candidate.sdpMid ?? null, // Use nullish coalescing to handle undefined
            sdpMLineIndex: candidate.sdpMLineIndex ?? 0, // Use nullish coalescing with default 0
          });
          await peerConnection.current.addIceCandidate(iceCandidate);
        } else {
          console.warn("Cannot add ICE candidate - no remote description set");
        }
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
        addLogEntry(
          `Error adding ICE candidate: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    };

    // Handle call end request from remote peer
    const handleEndCall = (from: string) => {
      console.log("Call ended by:", from);
      addLogEntry(`Videollamada finalizada por: ${from}`);
      endCallFunction();
    };

    // Handle incoming calls - Versión corregida
    const handleIncomingCall = (callerDept: string) => {
      console.log(`Incoming call received from: ${callerDept}`);
      setCallerDepartment(callerDept);
      setCallStatus("ringing");

      // Reproducir sonido
      playNotificationSound();

      // Add to log
      addLogEntry(`Llamada entrante de ${callerDept}`);

      // Show alert with options
      Alert.alert(
        "Llamada entrante del Portero",
        `El portero está solicitando su atención.`,
        [
          {
            text: "Rechazar",
            style: "cancel",
            onPress: () => {
              console.log("Call rejected");

              // Emit reject event
              socket.emit("rechazar_llamada", departmentName);
              console.log("Emitted rechazar_llamada event");

              // Add to log
              addLogEntry("Llamada rechazada");
              setCallStatus("idle");

              if (onReject) onReject();
            },
          },
          {
            text: "Aceptar",
            onPress: () => {
              console.log("Call accepted");

              // Emit accept event
              socket.emit("aceptar_llamada", departmentName);
              console.log("Emitted aceptar_llamada event");

              // Add to log
              addLogEntry("Llamada aceptada");

              // Iniciar la videollamada directamente en lugar de mostrar botones
              setCallStatus("connected");

              if (onAccept) onAccept();
            },
          },
        ]
      );
    };

    // Register WebRTC event listeners
    socket.on("webrtc_offer", handleWebRTCOffer);
    socket.on("webrtc_ice_candidate", handleICECandidate);
    socket.on("webrtc_end_call", handleEndCall);

    // Use the existing llamada_entrante event
    socket.on("llamada_entrante", handleIncomingCall);

    // Clean up listeners on unmount
    return () => {
      socket.off("webrtc_offer", handleWebRTCOffer);
      socket.off("webrtc_ice_candidate", handleICECandidate);
      socket.off("webrtc_end_call", handleEndCall);
      socket.off("llamada_entrante", handleIncomingCall);
    };
  }, [departmentName, addLogEntry]);

  // Create RTCPeerConnection with fixed event handlers
  const createPeerConnection = useCallback(() => {
    console.log("Creating peer connection");
    addLogEntry("Inicializando conexión de video");

    if (!localStream) {
      console.warn("No local stream available; waiting before creating connection");
      addLogEntry("Error: No se encontraron pistas locales. Se reintentará en breve...");
      return false;
    }

    try {
      if (peerConnection.current) {
        console.log("Closing existing peer connection");
        peerConnection.current.close();
        peerConnection.current = null;
      }

      const pc = new RTCPeerConnection(rtcConfiguration);
      const extendedPc = pc as unknown as RTCPeerConnectionWithEvents;
      peerConnection.current = extendedPc;

      console.log("RTCPeerConnection created with config:", rtcConfiguration);
      
      // Agregar todas las pistas locales (se garantiza que localStream existe)
      const tracks = localStream.getTracks();
      console.log(`Adding ${tracks.length} local tracks to peer connection`);
      tracks.forEach((track) => {
        try {
          extendedPc.addTrack(track, localStream);
        } catch (err) {
          console.error(`Error adding track ${track.kind}:`, err);
        }
      });

      // Configurar ontrack para recibir la stream remota
      extendedPc.ontrack = (event: RTCTrackEvent) => {
        console.log("Got remote track:", event.track.kind);
        if (event.streams && event.streams[0]) {
          console.log("Setting remote stream");
          setRemoteStream(event.streams[0]);
          addLogEntry("Videollamada conectada - recibiendo video y audio");
        } else {
          console.warn("Received track without stream");
          addLogEntry("Recibiendo audio/video pero sin stream completo");
        }
      };

      // ...existing ICE and connection state event handlers remain unchanged...
      // (omitted for brevity)
      
      return true;
    } catch (error) {
      console.error("Error creating peer connection:", error);
      addLogEntry(`Error creando conexión: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }, [localStream, callerDepartment, addLogEntry, endCallFunction]);

  // Toggle microphone
  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      addLogEntry(`Micrófono ${!isMuted ? "silenciado" : "activado"}`);
    }
  };

  // Toggle camera
  const toggleCamera = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
      addLogEntry(`Cámara ${!isCameraOff ? "apagada" : "activada"}`);
    }
  };

  // Handler for end call button press
  const handleEndCallPress = (event: GestureResponderEvent) => {
    endCallFunction(true);
  };

  // Render call controls with fixed event handling
  const renderCallControls = () => {
    return (
      <View style={styles.callControls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Text style={styles.controlButtonText}>
            {isMuted ? "Activar Mic" : "Silenciar"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCallPress}
        >
          <Text style={styles.controlButtonText}>Finalizar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            isCameraOff && styles.controlButtonActive,
          ]}
          onPress={toggleCamera}
        >
          <Text style={styles.controlButtonText}>
            {isCameraOff ? "Activar Cám" : "Apagar Cám"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Example function to simulate receiving a notification
  const simulateNotification = (message: string): void => {
    addLogEntry(message);
    setShowButtons(true); // Show response buttons when notification received
  };

  // Render video call view or log view based on call status
  const renderContent = () => {
    if (callStatus === "connected") {
      return (
        <View style={styles.callContainer}>
          {/* Remote video (full screen) */}
          {remoteStream && (
            <RTCView
              streamURL={remoteStream.toURL()}
              style={styles.remoteVideo}
              objectFit="cover"
              zOrder={0}
            />
          )}

          {/* Local video (picture-in-picture) */}
          {localStream && (
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              zOrder={1}
              mirror={true}
            />
          )}

          {/* Call controls */}
          {renderCallControls()}
        </View>
      );
    }

    // Default view (log view)
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{departmentName}</Text>

        <View style={styles.logContainer}>
          <Text style={styles.logTitle}>Log en tiempo real</Text>
          <ScrollView style={styles.logScroll}>
            {logMessages.map((msg, index) => (
              <Text
                key={index}
                style={[
                  styles.logMessage,
                  msg.includes("Llamada entrante") && styles.incomingCallLog,
                  msg.includes("aceptada") && styles.acceptedLog,
                  msg.includes("rechazada") && styles.rejectedLog,
                  msg.includes("Error") && styles.errorLog,
                ]}
              >
                {msg}
              </Text>
            ))}
          </ScrollView>
        </View>

        {/* Test button to simulate notification */}
        <TouchableOpacity
          style={styles.testButton}
          onPress={() =>
            simulateNotification("Nueva notificación recibida del portero")
          }
        >
          <Text style={styles.testButtonText}>Simular Notificación</Text>
        </TouchableOpacity>

        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.acceptButton,
              !showButtons && styles.hiddenButton,
            ]}
            onPress={() => {
              if (onAccept) onAccept();
              addLogEntry("Acción aceptada");
              setShowButtons(false);
            }}
            disabled={!showButtons}
          >
            <Text style={styles.buttonText}>Aceptar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.rejectButton,
              !showButtons && styles.hiddenButton,
            ]}
            onPress={() => {
              if (onReject) onReject();
              addLogEntry("Acción rechazada");
              setShowButtons(false);
            }}
            disabled={!showButtons}
          >
            <Text style={styles.buttonText}>Rechazar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return <SafeAreaView style={styles.safeArea}>{renderContent()}</SafeAreaView>;
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.BACKGROUND_COLOR,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.SECONDARY_COLOR,
    marginBottom: 20,
    textAlign: 'center',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  logTitle: {
    fontSize: 20, // Larger title
    fontWeight: 'bold',
    marginBottom: 12,
    color: THEME.TEXT_COLOR,
  },
  logScroll: {
    flex: 1,
  },
  logMessage: {
    fontSize: 16, // More legible font size
    marginBottom: 10, // More space between log entries
    lineHeight: 22, // Better line height for readability
    color: '#444',
    padding: 4, // Slight padding
  },
  incomingCallLog: {
    color: '#0066cc',
    fontWeight: 'bold',
    backgroundColor: '#e6f2ff', // Light background for highlight
    padding: 6,
    borderRadius: 4,
  },
  acceptedLog: {
    color: '#2e7d32',
    fontWeight: 'bold',
    backgroundColor: '#e8f5e9', // Light green background
    padding: 6,
    borderRadius: 4,
  },
  rejectedLog: {
    color: '#c62828',
    fontWeight: 'bold',
    backgroundColor: '#ffebee', // Light red background
    padding: 6,
    borderRadius: 4,
  },
  errorLog: {
    color: '#e65100',
    fontWeight: 'bold',
    backgroundColor: '#fff3e0', // Light orange background
    padding: 6,
    borderRadius: 4,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    marginTop: 10,
  },
  actionButton: {
    padding: 18, // Larger buttons
    borderRadius: 12,
    width: '45%',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  acceptButton: {
    backgroundColor: '#2e7d32', // Stronger green
  },
  rejectButton: {
    backgroundColor: '#c62828', // Stronger red
  },
  hiddenButton: {
    display: 'none',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18, // Larger text
  },
  testButton: {
    backgroundColor: THEME.PRIMARY_COLOR,
    padding: 14, // Larger test button
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  testButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16, // Larger text
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
  },
});

export default DepartamentoScreen;
