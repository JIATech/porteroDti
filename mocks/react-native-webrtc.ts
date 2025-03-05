// Mock para react-native-webrtc cuando se desarrolla en Expo Go
export const RTCPeerConnection = function() {
  return {
    createOffer: () => Promise.resolve({ type: 'offer', sdp: 'mock_sdp' }),
    createAnswer: () => Promise.resolve({ type: 'answer', sdp: 'mock_sdp' }),
    setLocalDescription: () => Promise.resolve(),
    setRemoteDescription: () => Promise.resolve(),
    addIceCandidate: () => Promise.resolve(),
    close: () => {},
    // Eventos simulados
    onicecandidate: null,
    ontrack: null,
    onicegatheringstatechange: null,
    onsignalingstatechange: null,
    onconnectionstatechange: null,
    oniceconnectionstatechange: null,
    // Estados
    iceGatheringState: 'complete',
    signalingState: 'stable',
    connectionState: 'connected',
    iceConnectionState: 'connected',
    localDescription: { type: 'offer', sdp: 'mock_sdp' },
    remoteDescription: { type: 'answer', sdp: 'mock_sdp' }
  };
};

interface RTCIceCandidateInit {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
}

interface RTCIceCandidateInterface extends RTCIceCandidateInit {
    toJSON(): RTCIceCandidateInit;
}

export const RTCIceCandidate = function(init: RTCIceCandidateInit): RTCIceCandidateInterface {
    return {
        ...init,
        toJSON: () => init
    };
};

interface RTCSessionDescriptionInit {
    type?: string;
    sdp?: string;
}

interface RTCSessionDescriptionInterface extends RTCSessionDescriptionInit {
    toJSON(): RTCSessionDescriptionInit;
}

export const RTCSessionDescription = function(init: RTCSessionDescriptionInit): RTCSessionDescriptionInterface {
  return {
    ...init,
    toJSON: () => init
  };
};

export const mediaDevices = {
  getUserMedia: () => {
    return Promise.resolve({
      getTracks: () => [
        { kind: 'video', enabled: true, stop: () => {} },
        { kind: 'audio', enabled: true, stop: () => {} }
      ],
      getVideoTracks: () => [{ enabled: true }],
      getAudioTracks: () => [{ enabled: true }],
      release: () => {},
      toURL: () => 'mock://stream'
    });
  }
};

import { StyleProp, ViewStyle } from 'react-native';

export const RTCView = function({ style }: { style?: StyleProp<ViewStyle> }) {
  return {
    // Una versión mock del componente RTCView
    type: 'View',
    props: {
      style,
      children: [{ type: 'Text', props: { children: 'RTCView Mock' } }]
    }
  };
};
