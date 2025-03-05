import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Platform,
  PermissionsAndroid,
  BackHandler,
  GestureResponderEvent,
} from "react-native";
import { RouteProp } from "@react-navigation/native";
import { Audio } from "expo-av";
import { THEME } from "../utils/constants";
import { socket } from "../services/socketService";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
  RTCView,
} from "react-native-webrtc";

// Import custom type definitions
import {
  RTCSdpType,
  RTCSessionDescriptionInit,
  RTCIceCandidateParam,
  RTCTrackEvent,
  RTCPeerConnectionIceEvent,
  RTCPeerConnectionWithEvents,
} from "../types/webrtc";

type RootStackParamList = {
  RoleSelection: undefined;
  Portero: undefined;
  Departamento: { departmentName: string };
};

type DepartamentoScreenProps = {
  route: RouteProp<RootStackParamList, "Departamento">;
  onAccept?: () => void;
  onReject?: () => void;
};

type CallStatus = "idle" | "ringing" | "calling" | "connected" | "ended";

const DepartamentoScreen: React.FC<DepartamentoScreenProps> = ({
  route,
  onAccept,
  onReject,
}) => {
  const { departmentName } = route.params || { departmentName: "Departamento" };

  // Estados para manejo de logs y UI
  const [logMessages, setLogMessages] = useState<string[]>([
    "Esperando notificaciones...",
  ]);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [showActionButtons, setShowActionButtons] = useState<boolean>(false);
  const [callerId, setCallerId] = useState<string | null>(null);

  // Refs para WebRTC
  const peerConnection = useRef<RTCPeerConnectionWithEvents | null>(null);
  // Este ref guarda el identificador del portero que inicia la llamada
  const currentCaller = useRef<string | null>(null);

  // Configuración para trabajar en red local (sin ICE servers externos)
  const rtcConfiguration = {
    iceServers: [],
  };

  // Ref para sonido de notificación
  const notificationSound = useRef<Audio.Sound | null>(null);

  // Función para agregar mensajes al log
  const addLogEntry = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogMessages((prev) => [`${timestamp}: ${message}`, ...prev]);
  }, []);

  // Cargar sonido de notificación
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

  const playNotificationSound = async () => {
    if (notificationSound.current) {
      try {
        await notificationSound.current.replayAsync();
      } catch (error) {
        console.error("Error reproduciendo sonido:", error);
      }
    }
  };

  // Función para finalizar la llamada
  const endCallFunction = useCallback(
    (sendEndEvent = true) => {
      addLogEntry("Finalizando videollamada");
      if (sendEndEvent && currentCaller.current) {
        socket.emit("webrtc_end_call", currentCaller.current);
      }
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop());
        setRemoteStream(null);
      }
      setCallStatus("ended");
      currentCaller.current = null;
      setShowActionButtons(false);
    },
    [remoteStream, addLogEntry]
  );

  // Inicializar WebRTC: solicitar permisos y obtener stream local
  useEffect(() => {
    const initializeWebRTC = async () => {
      try {
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
        const constraints = {
          audio: true,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        };
        addLogEntry("Solicitando acceso a cámara y micrófono...");
        const stream = await mediaDevices.getUserMedia(constraints);
        if (!stream) throw new Error("No se pudo obtener stream de medios");
        setLocalStream(stream);
        addLogEntry("Cámara y micrófono inicializados correctamente");
      } catch (err) {
        console.error("Error obteniendo stream:", err);
        Alert.alert(
          "Error",
          "No se pudo acceder a la cámara o micrófono: " + String(err)
        );
        addLogEntry("Error obteniendo stream: " + String(err));
      }
    };
    initializeWebRTC().catch((err) =>
      console.error("Error en initializeWebRTC:", err)
    );
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      endCallFunction(false);
    };
  }, []);

  // Manejo del botón de retroceso
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
          return true;
        }
        return false;
      }
    );
    return () => backHandler.remove();
  }, [callStatus, endCallFunction]);

  // Función para crear la conexión WebRTC
  const createPeerConnection = useCallback(async (): Promise<boolean> => {
    addLogEntry("Inicializando conexión de video");
    if (!localStream) {
      addLogEntry("No se encontraron pistas locales; esperando...");
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (localStream) break;
      }
      if (!localStream) {
        addLogEntry("Error: localStream no disponible");
        return false;
      }
    }
    try {
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      const pc = new RTCPeerConnection(rtcConfiguration);
      const extendedPc = pc as unknown as RTCPeerConnectionWithEvents;
      peerConnection.current = extendedPc;
      localStream.getTracks().forEach((track) => {
        try {
          extendedPc.addTrack(track, localStream);
        } catch (err) {
          console.error(`Error agregando pista ${track.kind}:`, err);
        }
      });
      extendedPc.ontrack = (event: RTCTrackEvent) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          addLogEntry("Videollamada conectada - recibiendo video y audio");
        } else {
          addLogEntry("Recibido track sin stream completo");
        }
      };
      extendedPc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate && currentCaller.current) {
          const candidateObj: RTCIceCandidateParam = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid ?? null,
            sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
          };
          socket.emit(
            "webrtc_ice_candidate",
            candidateObj,
            currentCaller.current
          );
        } else if (!event.candidate) {
          addLogEntry("Finalización de gathering ICE");
        }
      };
      extendedPc.onconnectionstatechange = () => {
        const state = extendedPc.connectionState;
        addLogEntry("Estado de conexión: " + state);
        if (
          state === "failed" ||
          state === "disconnected" ||
          state === "closed"
        ) {
          addLogEntry(`Conexión en estado ${state}. Terminando llamada.`);
          endCallFunction();
        }
      };
      return true;
    } catch (error) {
      console.error("Error creando peer connection:", error);
      addLogEntry(
        "Error creando conexión: " +
          (error instanceof Error ? error.message : String(error))
      );
      return false;
    }
  }, [localStream, addLogEntry, endCallFunction]);

  // Función para manejar la oferta entrante y enviar respuesta
  const handleWebRTCOffer = useCallback(
    async (offer: RTCSessionDescriptionInit, from: string) => {
      addLogEntry(`Recibiendo oferta de videollamada de: ${from}`);
      setCallerId(from);
      // Crear la conexión si no existe
      if (!peerConnection.current) {
        const success = await createPeerConnection();
        if (!success) {
          addLogEntry("Error al crear la conexión de video");
          return;
        }
      }
      if (
        peerConnection.current &&
        peerConnection.current.signalingState !== "closed"
      ) {
        try {
          const rtcSessionDescription = new RTCSessionDescription({
            type: offer.type as RTCSdpType,
            sdp: offer.sdp,
          });
          await peerConnection.current.setRemoteDescription(
            rtcSessionDescription
          );
          addLogEntry("Creando respuesta...");
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          const plainAnswer: RTCSessionDescriptionInit = {
            type: answer.type as RTCSdpType,
            sdp: answer.sdp,
          };
          socket.emit("webrtc_answer", plainAnswer, from);
          addLogEntry("Videollamada conectada");
          setCallStatus("connected");
        } catch (err) {
          console.error("Error manejando la oferta:", err);
          addLogEntry(
            "Error en la videollamada: " +
              (err instanceof Error ? err.message : String(err))
          );
        }
      } else {
        addLogEntry("Error: Conexión no disponible para la oferta");
      }
    },
    [createPeerConnection, addLogEntry]
  );

  // Manejo de candidatos ICE entrantes
  const handleICECandidate = useCallback(
    async (candidate: RTCIceCandidateParam, from: string) => {
      try {
        if (
          peerConnection.current &&
          peerConnection.current.remoteDescription
        ) {
          const iceCandidate = new RTCIceCandidate({
            candidate: candidate.candidate || "",
            sdpMid: candidate.sdpMid ?? null,
            sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
          });
          await peerConnection.current.addIceCandidate(iceCandidate);
        } else {
          addLogEntry(
            "No se puede agregar ICE candidate: sin descripción remota"
          );
        }
      } catch (err) {
        console.error("Error agregando ICE candidate:", err);
        addLogEntry(
          "Error agregando ICE candidate: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
    },
    [addLogEntry]
  );

  // Manejo de finalización de llamada
  const handleEndCall = useCallback(
    (from: string) => {
      addLogEntry(`Videollamada finalizada por: ${from}`);
      endCallFunction();
    },
    [addLogEntry, endCallFunction]
  );

  // Manejo de llamada entrante: mostrar alerta para aceptar o rechazar
  const handleIncomingCall = useCallback(
    (caller: string) => {
      addLogEntry(`Llamada entrante de ${caller}`);
      playNotificationSound();
      Alert.alert(
        "Llamada entrante del Portero",
        "El portero solicita su atención.",
        [
          {
            text: "Rechazar",
            style: "cancel",
            onPress: () => {
              socket.emit("rechazar_llamada", departmentName);
              addLogEntry("Llamada rechazada");
              setCallStatus("idle");
              if (onReject) onReject();
            },
          },
          {
            text: "Aceptar",
            onPress: () => {
              socket.emit("aceptar_llamada", departmentName);
              addLogEntry("Llamada aceptada");
              setCallStatus("calling");
              if (onAccept) onAccept();
              // Se mostrará la interfaz de videollamada al recibir la oferta
            },
          },
        ]
      );
    },
    [departmentName, onAccept, onReject, addLogEntry]
  );

  // Registrar listeners de socket
  useEffect(() => {
    socket.on("webrtc_offer", handleWebRTCOffer);
    socket.on("webrtc_ice_candidate", handleICECandidate);
    socket.on("webrtc_end_call", handleEndCall);
    socket.on("llamada_entrante", handleIncomingCall);

    return () => {
      socket.off("webrtc_offer", handleWebRTCOffer);
      socket.off("webrtc_ice_candidate", handleICECandidate);
      socket.off("webrtc_end_call", handleEndCall);
      socket.off("llamada_entrante", handleIncomingCall);
    };
  }, [
    handleWebRTCOffer,
    handleICECandidate,
    handleEndCall,
    handleIncomingCall,
  ]);

  // Funciones para alternar micrófono y cámara
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
      addLogEntry(`Micrófono ${!isMuted ? "silenciado" : "activado"}`);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff((prev) => !prev);
      addLogEntry(`Cámara ${!isCameraOff ? "apagada" : "activada"}`);
    }
  };

  const handleEndCallPress = (event: GestureResponderEvent) => {
    endCallFunction(true);
  };

  // Renderizar controles de llamada
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

  // Renderizar contenido según el estado de la llamada
  const renderContent = () => {
    if (callStatus === "calling" || callStatus === "connected") {
      return (
        <View style={styles.callContainer}>
          {remoteStream && (
            <RTCView
              streamURL={remoteStream.toURL()}
              style={styles.remoteVideo}
              objectFit="cover"
              zOrder={0}
            />
          )}
          {localStream && (
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              zOrder={1}
              mirror={true}
            />
          )}
          {callStatus === "calling" && !remoteStream && (
            <View style={styles.callingOverlay}>
              <Text style={styles.callingText}>Conectando videollamada...</Text>
            </View>
          )}
          {renderCallControls()}
        </View>
      );
    }
    return (
      <View style={styles.logContainer}>
        <Text style={styles.title}>{departmentName}</Text>
        <View style={styles.logBox}>
          <Text style={styles.logTitle}>Log en tiempo real</Text>
          <ScrollView style={styles.logScroll}>
            {logMessages.map((msg, index) => (
              <Text key={index} style={styles.logMessage}>
                {msg}
              </Text>
            ))}
          </ScrollView>
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
  logContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "space-between",
    backgroundColor: THEME.BACKGROUND_COLOR,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: THEME.SECONDARY_COLOR,
    marginBottom: 20,
    textAlign: "center",
  },
  logBox: {
    flex: 1,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  logTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    color: THEME.TEXT_COLOR,
  },
  logScroll: {
    flex: 1,
  },
  logMessage: {
    fontSize: 16,
    marginBottom: 10,
    lineHeight: 22,
    color: "#444",
    padding: 4,
  },
  callContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: "#000",
  },
  localVideo: {
    position: "absolute",
    right: 20,
    top: 20,
    width: 120,
    height: 160,
    backgroundColor: "#111",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
  },
  callingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  callingText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
  },
  callControls: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  controlButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(80, 80, 80, 0.8)",
    borderRadius: 24,
    minWidth: 100,
    alignItems: "center",
  },
  controlButtonActive: {
    backgroundColor: "rgba(180, 20, 20, 0.8)",
  },
  endCallButton: {
    backgroundColor: "#c62828",
    paddingVertical: 15,
  },
  controlButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default DepartamentoScreen;
