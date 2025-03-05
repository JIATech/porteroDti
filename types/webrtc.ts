/**
 * Custom type definitions for react-native-webrtc
 * These types supplement the existing ones to provide better TypeScript support
 */

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  MediaStreamTrack
} from 'react-native-webrtc';

// Define the RTCSdpType enum to match what react-native-webrtc expects
export type RTCSdpType = 'offer' | 'answer' | 'pranswer' | 'rollback';

// Session description initialization interface
export interface RTCSessionDescriptionInit {
  type: RTCSdpType;
  sdp: string;
}

// ICE candidate initialization interface - ensuring sdpMid and sdpMLineIndex are properly typed
export interface RTCIceCandidateInit {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
}

// Simplified initization for ice candidates
export interface RTCIceCandidateParam {
  candidate: string;
  sdpMid: string | null | undefined;  // Adding undefined as a possible type
  sdpMLineIndex: number | null | undefined;  // Adding undefined as a possible type
}

// Stream object from the native library
export interface RTCMediaStream extends MediaStream {
  _tracks: MediaStreamTrack[];
  _id: string;
  _reactTag: string;
  toURL: () => string;
  release: () => void;
}

// Event types
export interface RTCTrackEvent {
  track: MediaStreamTrack;
  streams: RTCMediaStream[];
  receiver: any;
  transceiver: any;
}

export interface RTCPeerConnectionIceEvent {
  candidate: RTCIceCandidate | null;
}

// Extension of RTCPeerConnection to include event handlers
export interface RTCPeerConnectionWithEvents {
  // Core RTCPeerConnection methods and properties
  close(): void;
  addTrack(track: MediaStreamTrack, stream: MediaStream): void;
  addIceCandidate(candidate: RTCIceCandidate): Promise<void>;
  createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescription>;
  createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescription>;
  setLocalDescription(description: RTCSessionDescription): Promise<void>;
  setRemoteDescription(description: RTCSessionDescription): Promise<void>;

  // Properties
  localDescription: RTCSessionDescription | null;
  remoteDescription: RTCSessionDescription | null;
  connectionState: string;
  iceConnectionState: string;
  iceGatheringState: string;
  signalingState: string;

  // Event handlers
  ontrack: ((event: RTCTrackEvent) => void) | null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
  oniceconnectionstatechange: ((event: Event) => void) | null;
  onicegatheringstatechange: ((event: Event) => void) | null;
  onsignalingstatechange: ((event: Event) => void) | null;
  onconnectionstatechange: ((event: Event) => void) | null;
}

// Interfaces for RTCPeerConnection options
export interface RTCOfferOptions {
  iceRestart?: boolean;
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
  voiceActivityDetection?: boolean;
}

export interface RTCAnswerOptions {
  voiceActivityDetection?: boolean;
}
