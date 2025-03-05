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

export const RTCIceCandidate = function(init) {
  return {
    ...init,
    toJSON: () => init
  };
};

export const RTCSessionDescription = function(init) {
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

export const RTCView = function({ style }) {
  return {
    // Una versión mock del componente RTCView
    type: 'View',
    props: {
      style,
      children: [{ type: 'Text', props: { children: 'RTCView Mock' } }]
    }
  };
};
