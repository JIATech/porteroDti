import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  BackHandler,
  GestureResponderEvent,
} from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { THEME } from "../utils/constants";
import { socket } from "../services/socketService";
import KioskMode from "../utils/KioskMode";
import AdminTrigger from "../components/AdminTrigger";
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

type PorteroScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, "Portero">;
};

type DepartmentIconMap = {
  [key: string]: string;
};

type CallStatus = "idle" | "calling" | "connected" | "ended";

const PorteroScreen: React.FC<PorteroScreenProps> = ({ navigation }) => {
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    null
  );
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);

  const peerConnection = useRef<RTCPeerConnectionWithEvents | null>(null);
  const currentDepartment = useRef<string | null>(null);

  // Configuración para que la conexión funcione en red local (sin servidores STUN/TURN externos)
  const rtcConfiguration: RTCConfiguration = {
    iceServers: [], // Sin servidores STUN/TURN externos
    iceTransportPolicy: "all" as RTCIceTransportPolicy,
    iceCandidatePoolSize: 0,
  };

  // Enable kiosk mode when component mounts
  useEffect(() => {
    // Enable kiosk mode
    KioskMode.enable();

    // Clean up function to disable kiosk mode when component unmounts
    return () => {
      KioskMode.disable();
    };
  }, []);

  const endCallFunction = useCallback(
    (sendEndEvent = true) => {
      console.log("Ending call, sendEndEvent:", sendEndEvent);
      if (sendEndEvent && currentDepartment.current) {
        socket.emit("webrtc_end_call", currentDepartment.current);
      }
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop());
        setRemoteStream(null);
      }
      setCallStatus("idle");
      currentDepartment.current = null;
    },
    [remoteStream]
  );

  // Override the back button handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        // If in a call, show confirmation before ending call
        if (callStatus !== "idle") {
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
        // In all cases, prevent going back/exiting the app
        return true;
      }
    );
    return () => backHandler.remove();
  }, [callStatus, endCallFunction]);

  const createPeerConnection = useCallback(() => {
    console.log("Creating peer connection");
    if (!localStream) {
      console.error("No local stream available");
      Alert.alert(
        "Error",
        "No se pudo iniciar la videollamada (sin acceso a cámara)"
      );
      return false;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    const pc = new RTCPeerConnection(rtcConfiguration);
    const extendedPc = pc as unknown as RTCPeerConnectionWithEvents;
    peerConnection.current = extendedPc;

    // Agregar pistas locales
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
      } else {
        console.warn("Recibido track sin stream");
      }
    };

    extendedPc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && currentDepartment.current) {
        const candidateObj: RTCIceCandidateParam = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid ?? null,
          sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
        };
        socket.emit(
          "webrtc_ice_candidate",
          candidateObj,
          currentDepartment.current
        );
        console.log("Candidato ICE:", event.candidate.candidate);
      } else if (!event.candidate) {
        console.log("Finalización de gathering ICE");
      }
    };

    extendedPc.onconnectionstatechange = () => {
      const state = extendedPc.connectionState;
      console.log("Estado de conexión:", state);
      if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {
        console.warn(`Estado de conexión ${state}. Terminando llamada.`);
        endCallFunction();
      }
    };

    return true;
  }, [localStream, endCallFunction]);

  const sendOffer = useCallback(async () => {
    try {
      if (!peerConnection.current || !currentDepartment.current) {
        console.error("Falta conexión o departamento");
        return false;
      }
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: true,
      });
      await peerConnection.current.setLocalDescription(offer);
      // Esperar un tiempo para recolectar candidatos ICE
      setTimeout(() => {
        if (!peerConnection.current || !currentDepartment.current) return;
        const currentOffer = peerConnection.current.localDescription;
        if (currentOffer) {
          const plainOffer: RTCSessionDescriptionInit = {
            type: currentOffer.type as RTCSdpType,
            sdp: currentOffer.sdp,
          };
          socket.emit("webrtc_offer", plainOffer, currentDepartment.current);
        } else {
          console.error("No hay descripción local para enviar");
        }
      }, 1000);
      return true;
    } catch (error) {
      console.error("Error creando la oferta:", error);
      Alert.alert("Error", "No se pudo iniciar la videollamada");
      endCallFunction();
      return false;
    }
  }, [endCallFunction]);

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
        const stream = await mediaDevices.getUserMedia(constraints);
        if (!stream) {
          throw new Error("No se pudo obtener stream de medios");
        }
        setLocalStream(stream);
      } catch (err) {
        console.error("Error obteniendo el stream:", err);
        Alert.alert(
          "Error",
          "No se pudo acceder a la cámara o micrófono. " + String(err)
        );
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

  useEffect(() => {
    const handleAcceptedCall = async (department: string) => {
      Alert.alert(
        "Llamada Aceptada",
        `Llamada aceptada por ${department}. Iniciando videollamada...`,
        [{ text: "OK" }]
      );
      currentDepartment.current = department;
      setCallStatus("calling");

      if (!localStream) {
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          if (localStream) break;
        }
      }

      try {
        if (localStream) {
          const success = createPeerConnection();
          if (success) {
            sendOffer().catch((err) => {
              console.error("Error enviando oferta:", err);
              Alert.alert("Error", "No se pudo iniciar la videollamada");
              endCallFunction();
            });
          }
        } else {
          Alert.alert("Error", "No se pudo acceder a la cámara o micrófono");
          endCallFunction();
        }
      } catch (err) {
        console.error("Error en handleAcceptedCall:", err);
        Alert.alert("Error", "Error al iniciar la videollamada");
      }
    };

    const handleRejectedCall = (department: string) => {
      Alert.alert("Llamada Rechazada", `Llamada rechazada por ${department}.`, [
        { text: "OK" },
      ]);
      setCallStatus("idle");
      currentDepartment.current = null;
    };

    const handleWebRTCAnswer = async (
      answer: RTCSessionDescriptionInit,
      from: string
    ) => {
      try {
        if (!peerConnection.current) {
          console.error("No hay conexión para recibir la respuesta");
          return;
        }
        if (peerConnection.current.signalingState === "stable") {
          return;
        }
        const rtcSessionDescription = new RTCSessionDescription({
          type: answer.type as RTCSdpType,
          sdp: answer.sdp,
        });
        await peerConnection.current.setRemoteDescription(
          rtcSessionDescription
        );
        setCallStatus("connected");
      } catch (err) {
        console.error("Error al establecer la descripción remota:", err);
        Alert.alert("Error", "Error en la conexión de videollamada");
        endCallFunction();
      }
    };

    const handleICECandidate = async (
      candidate: RTCIceCandidateParam,
      from: string
    ) => {
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
          console.warn(
            "No se puede agregar ICE candidate: sin descripción remota"
          );
        }
      } catch (err) {
        console.error("Error agregando ICE candidate:", err);
      }
    };

    const handleEndCall = (from: string) => {
      Alert.alert("Llamada finalizada", `${from} ha finalizado la llamada.`);
      endCallFunction();
    };

    socket.on("llamada_aceptada", handleAcceptedCall);
    socket.on("llamada_rechazada", handleRejectedCall);
    socket.on("webrtc_answer", handleWebRTCAnswer);
    socket.on("webrtc_ice_candidate", handleICECandidate);
    socket.on("webrtc_end_call", handleEndCall);

    return () => {
      socket.off("llamada_aceptada", handleAcceptedCall);
      socket.off("llamada_rechazada", handleRejectedCall);
      socket.off("webrtc_answer", handleWebRTCAnswer);
      socket.off("webrtc_ice_candidate", handleICECandidate);
      socket.off("webrtc_end_call", handleEndCall);
    };
  }, [localStream]);

  useEffect(() => {
    if (callStatus === "connected" && !remoteStream) {
      const timeout = setTimeout(() => {
        if (peerConnection.current) {
          const state = peerConnection.current.connectionState;
          if (state === "failed" || state === "disconnected") {
            if (currentDepartment.current && localStream) {
              createPeerConnection();
              sendOffer().catch((err) =>
                console.error("Error reenviando oferta:", err)
              );
            }
          }
        }
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [callStatus, remoteStream, createPeerConnection, sendOffer, localStream]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff((prev) => !prev);
    }
  }, [localStream]);

  const handleEndCallPress = useCallback(
    (event: GestureResponderEvent) => {
      endCallFunction(true);
    },
    [endCallFunction]
  );

  const departments: string[] = [
    "Sistemas",
    "Administración",
    "Infraestructura",
    "Soporte",
  ];

  const departmentIcons: DepartmentIconMap = {
    Sistemas: "💻",
    Administración: "📊",
    Infraestructura: "🏢",
    Soporte: "🛠️",
  };

  const handleDepartmentSelection = useCallback((department: string): void => {
    setSelectedDepartment(department);
    Alert.alert(
      "Selección de Departamento",
      `Has seleccionado: ${department}`,
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => console.log("Selección cancelada"),
        },
        {
          text: "Confirmar",
          onPress: () => {
            currentDepartment.current = department;
            socket.emit("iniciar_llamada", department);
            Alert.alert(
              "Notificación Enviada",
              `Se ha notificado al departamento de ${department}.`
            );
          },
        },
      ]
    );
  }, []);

  const renderCallControls = () => {
    if (callStatus === "connected" || callStatus === "calling") {
      return (
        <View style={styles.callControls}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              isMuted && styles.controlButtonActive,
            ]}
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
    }
    return null;
  };

  const renderContent = () => {
    if (callStatus === "connected" || callStatus === "calling") {
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
          <AdminTrigger corner="topLeft" />
        </View>
      );
    } else {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Portero DTI</Text>
          <Text style={styles.subtitle}>
            Selecciona un departamento para notificar
          </Text>
          <View style={styles.buttonGrid}>
            {departments.map((department) => (
              <TouchableOpacity
                key={department}
                style={[
                  styles.button,
                  selectedDepartment === department && styles.selectedButton,
                ]}
                onPress={() => handleDepartmentSelection(department)}
              >
                <Text style={styles.buttonIcon}>
                  {departmentIcons[department]}
                </Text>
                <Text
                  style={[
                    styles.buttonText,
                    selectedDepartment === department &&
                      styles.selectedButtonText,
                  ]}
                >
                  {department}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <AdminTrigger corner="bottomRight" />
        </View>
      );
    }
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    color: THEME.SECONDARY_COLOR,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
    color: THEME.TEXT_COLOR,
    textAlign: "center",
  },
  buttonGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    alignItems: "center",
  },
  button: {
    backgroundColor: THEME.PRIMARY_COLOR,
    width: "46%",
    height: 170,
    padding: 18,
    borderRadius: 18,
    margin: 10,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  selectedButton: {
    backgroundColor: THEME.SECONDARY_COLOR,
    borderWidth: 3,
    borderColor: "#fff",
    transform: [{ scale: 1.05 }],
  },
  buttonIcon: {
    fontSize: 46,
    marginBottom: 14,
  },
  buttonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  selectedButtonText: {
    color: "#fff",
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

export default PorteroScreen;
