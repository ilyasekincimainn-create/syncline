import Foundation
import WebRTC

class WebRTCClient: NSObject {
    
    private static let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        let videoEncoderFactory = RTCDefaultVideoEncoderFactory()
        let videoDecoderFactory = RTCDefaultVideoDecoderFactory()
        return RTCPeerConnectionFactory(encoderFactory: videoEncoderFactory, decoderFactory: videoDecoderFactory)
    }()
    
    private var peerConnection: RTCPeerConnection?
    private var localAudioTrack: RTCAudioTrack?
    
    var onIceCandidate: ((RTCIceCandidate) -> Void)?
    var onConnectionStateChange: ((RTCIceConnectionState) -> Void)?
    
    override init() {
        super.init()
        setupPeerConnection()
    }
    
    private func setupPeerConnection() {
        let config = RTCConfiguration()
        
        // Public STUN server configuration
        let stunServer = RTCIceServer(urlStrings: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302"
        ])
        config.iceServers = [stunServer]
        config.sdpSemantics = .unifiedPlan
        
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: ["OfferToReceiveAudio": "true"],
            optionalConstraints: nil
        )
        
        self.peerConnection = WebRTCClient.factory.peerConnection(
            with: config,
            constraints: constraints,
            delegate: self
        )
        
        setupAudio()
    }
    
    private func setupAudio() {
        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        let audioSource = WebRTCClient.factory.audioSource(with: constraints)
        let audioTrack = WebRTCClient.factory.audioTrack(with: audioSource, trackId: "audio0")
        self.localAudioTrack = audioTrack
        
        peerConnection?.add(audioTrack, streamIds: ["stream0"])
    }
    
    func createOffer(completion: @escaping (RTCSessionDescription?) -> Void) {
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: ["OfferToReceiveAudio": "true"],
            optionalConstraints: nil
        )
        
        peerConnection?.offer(for: constraints) { [weak self] sdp, error in
            guard let self = self else { return }
            if let error = error {
                print("WebRTC: Error creating offer: \(error.localizedDescription)")
                completion(nil)
                return
            }
            
            guard let sdp = sdp else {
                completion(nil)
                return
            }
            
            self.peerConnection?.setLocalDescription(sdp) { error in
                if let error = error {
                    print("WebRTC: Error setting local description: \(error.localizedDescription)")
                    completion(nil)
                } else {
                    completion(sdp)
                }
            }
        }
    }
    
    func createAnswer(completion: @escaping (RTCSessionDescription?) -> Void) {
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: ["OfferToReceiveAudio": "true"],
            optionalConstraints: nil
        )
        
        peerConnection?.answer(for: constraints) { [weak self] sdp, error in
            guard let self = self else { return }
            if let error = error {
                print("WebRTC: Error creating answer: \(error.localizedDescription)")
                completion(nil)
                return
            }
            
            guard let sdp = sdp else {
                completion(nil)
                return
            }
            
            self.peerConnection?.setLocalDescription(sdp) { error in
                if let error = error {
                    print("WebRTC: Error setting local description for answer: \(error.localizedDescription)")
                    completion(nil)
                } else {
                    completion(sdp)
                }
            }
        }
    }
    
    func setRemoteDescription(_ sdp: RTCSessionDescription, completion: @escaping (Error?) -> Void) {
        peerConnection?.setRemoteDescription(sdp, completionHandler: completion)
    }
    
    func addIceCandidate(_ candidate: RTCIceCandidate) {
        peerConnection?.add(candidate)
    }
    
    func close() {
        peerConnection?.close()
        peerConnection = nil
        localAudioTrack = nil
    }
}

// MARK: - RTCPeerConnectionDelegate
extension WebRTCClient: RTCPeerConnectionDelegate {
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {
        print("WebRTC: Signaling state changed: \(stateChanged.rawValue)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {
        print("WebRTC: Stream added.")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {
        print("WebRTC: Stream removed.")
    }
    
    func peerConnectionShouldTriggerIceGathering(_ peerConnection: RTCPeerConnection) {}
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        print("WebRTC: ICE Connection state changed: \(newState.rawValue)")
        onConnectionStateChange?(newState)
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {
        print("WebRTC: ICE Gathering state changed: \(newState.rawValue)")
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        print("WebRTC: Local ICE Candidate generated.")
        onIceCandidate?(candidate)
    }
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
    
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}
