package com.syncline.companion.webrtc

import android.content.Context
import android.media.AudioManager
import android.util.Log
import org.webrtc.*
import org.webrtc.audio.JavaAudioDeviceModule
import java.util.ArrayList

class WebRtcBridge(
    private val context: Context,
    private val signalingSender: (String, Any) -> Unit
) {
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var localAudioSource: AudioSource? = null
    private var localAudioTrack: AudioTrack? = null

    init {
        initializeWebRtc()
    }

    private fun initializeWebRtc() {
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(true)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        val factoryOptions = PeerConnectionFactory.Options()
        
        val adm = JavaAudioDeviceModule.builder(context)
            .setUseHardwareAcousticEchoCanceler(true)
            .setUseHardwareNoiseSuppressor(true)
            .createAudioDeviceModule()

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setOptions(factoryOptions)
            .setAudioDeviceModule(adm)
            .createPeerConnectionFactory()

        Log.d("WebRtcBridge", "WebRTC PeerConnectionFactory initialized.")
    }

    fun initiateCall(callId: String, iceServers: List<PeerConnection.IceServer>) {
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        val pcObserver = object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                Log.d("WebRtcBridge", "ICE Connection state changed: $state")
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            
            override fun onIceCandidate(candidate: IceCandidate) {
                // Relay candidate to signaling server
                val payload = mapOf(
                    "candidate" to candidate.sdp,
                    "sdpMid" to candidate.sdpMid,
                    "sdpMLineIndex" to candidate.sdpMLineIndex
                )
                signalingSender("ice_candidate", payload)
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            
            override fun onDataChannel(dc: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, mediaStreams: Array<out MediaStream>?) {}
        }

        peerConnection = peerConnectionFactory?.createPeerConnection(rtcConfig, pcObserver)
        setupLocalAudio()
    }

    private fun setupLocalAudio() {
        val audioConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "true"))
        }

        localAudioSource = peerConnectionFactory?.createAudioSource(audioConstraints)
        localAudioTrack = peerConnectionFactory?.createAudioTrack("ARDAMSa0", localAudioSource)
        
        peerConnection?.addTrack(localAudioTrack, listOf("ARDAMS"))
        Log.d("WebRtcBridge", "Local WebRTC audio track added.")
    }

    fun createOffer(callback: (SessionDescription) -> Unit) {
        val constraints = MediaConstraints()
        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(desc: SessionDescription) {
                peerConnection?.setLocalDescription(object : SdpObserver {
                    override fun onCreateSuccess(p0: SessionDescription?) {}
                    override fun onSetSuccess() {
                        Log.d("WebRtcBridge", "Local SDP offer set successfully.")
                        callback(desc)
                    }
                    override fun onCreateFailure(p0: String?) {}
                    override fun onSetFailure(p0: String?) {}
                }, desc)
            }
            override fun onSetSuccess() {}
            override fun onCreateFailure(reason: String?) {
                Log.e("WebRtcBridge", "Failed to create offer: $reason")
            }
            override fun onSetFailure(p0: String?) {}
        }, constraints)
    }

    fun handleRemoteAnswer(sdp: String) {
        val sdpAnswer = SessionDescription(SessionDescription.Type.ANSWER, sdp)
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onCreateSuccess(p0: SessionDescription?) {}
            override fun onSetSuccess() {
                Log.d("WebRtcBridge", "Remote SDP answer set successfully.")
            }
            override fun onCreateFailure(p0: String?) {}
            override fun onSetFailure(reason: String?) {
                Log.e("WebRtcBridge", "Failed to set remote answer: $reason")
            }
        }, sdpAnswer)
    }

    fun addRemoteIceCandidate(sdp: String, sdpMid: String?, sdpMLineIndex: Int) {
        val candidate = IceCandidate(sdpMid, sdpMLineIndex, sdp)
        peerConnection?.addIceCandidate(candidate)
        Log.d("WebRtcBridge", "Remote ICE Candidate added.")
    }

    fun disconnect() {
        peerConnection?.close()
        peerConnection = null
        localAudioTrack = null
        localAudioSource?.dispose()
        localAudioSource = null
        Log.d("WebRtcBridge", "WebRTC PeerConnection disconnected.")
    }
}
