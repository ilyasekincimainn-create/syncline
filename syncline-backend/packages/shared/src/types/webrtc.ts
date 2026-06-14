export enum SignalingMessageType {
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice_candidate',
  CALL_ACCEPT = 'call_accept',
  CALL_REJECT = 'call_reject',
  CALL_HANGUP = 'call_hangup',
  CALL_BUSY = 'call_busy',
  SIGNALING_ERROR = 'signaling_error',
}

export interface SignalingMessage<T = unknown> {
  type: SignalingMessageType;
  callId: string;
  senderId: string;
  targetId: string;
  payload: T;
  timestamp: number;
}

export interface SdpPayload {
  sdp: string;
  type: 'offer' | 'answer';
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number;
}

export interface CallAcceptPayload {
  timestamp: number;
}

export interface CallRejectPayload {
  reason: string;
}

export interface TurnCredentials {
  username: string;
  credential: string;
  uris: string[];
  ttl: number;
}
