import Foundation
import CallKit
import AVFoundation

class CallKitManager: NSObject, CXProviderDelegate {
    
    static let shared = CallKitManager()
    
    private let provider: CXProvider
    private let callController = CXCallController()
    
    @Published var currentCallUUID: UUID?
    @Published var isMuted = false
    @Published var isConnecting = false
    @Published var isConnected = false
    
    var onAnswerCall: ((UUID) -> Void)?
    var onEndCall: ((UUID) -> Void)?
    var onStartCall: ((UUID) -> Void)?
    
    private override init() {
        let configuration = CXProviderConfiguration()
        configuration.supportsVideo = false
        configuration.maximumCallGroups = 1
        configuration.maximumCallsPerCallGroup = 1
        configuration.supportedHandleTypes = [.phoneNumber]
        
        self.provider = CXProvider(configuration: configuration)
        super.init()
        self.provider.setDelegate(self, queue: nil)
    }
    
    func reportIncomingCall(uuid: UUID, handle: String, completion: @escaping () -> Void) {
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .phoneNumber, value: handle)
        update.hasVideo = false
        
        provider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
            if let error = error {
                print("Failed to report incoming call: \(error.localizedDescription)")
            } else {
                print("Incoming call reported successfully.")
                self?.currentCallUUID = uuid
            }
            completion()
        }
    }
    
    func startCall(handle: String, video: Bool = false) {
        let uuid = UUID()
        let handleObj = CXHandle(type: .phoneNumber, value: handle)
        let startCallAction = CXStartCallAction(call: uuid, handle: handleObj)
        startCallAction.isVideo = video
        
        let transaction = CXTransaction(action: startCallAction)
        callController.request(transaction) { [weak self] error in
            if let error = error {
                print("Failed to start call: \(error.localizedDescription)")
            } else {
                self?.currentCallUUID = uuid
                print("Start call transaction succeeded.")
            }
        }
    }
    
    func endCall() {
        guard let uuid = currentCallUUID else { return }
        let endCallAction = CXEndCallAction(call: uuid)
        let transaction = CXTransaction(action: endCallAction)
        callController.request(transaction) { error in
            if let error = error {
                print("Failed to end call: \(error.localizedDescription)")
            } else {
                print("End call transaction succeeded.")
            }
        }
    }
    
    func setMuted(_ muted: Bool) {
        guard let uuid = currentCallUUID else { return }
        let muteAction = CXSetMutedCallAction(call: uuid, muted: muted)
        let transaction = CXTransaction(action: muteAction)
        callController.request(transaction) { error in
            if let error = error {
                print("Failed to mute call: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - CXProviderDelegate
    
    func providerDidReset(_ provider: CXProvider) {
        print("Provider did reset.")
        currentCallUUID = nil
        isConnected = false
        isConnecting = false
    }
    
    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        // Configure audio session
        configureAudioSession()
        onStartCall?(action.callUUID)
        action.fulfill()
    }
    
    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        // Configure audio session
        configureAudioSession()
        onAnswerCall?(action.callUUID)
        action.fulfill()
    }
    
    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        onEndCall?(action.callUUID)
        currentCallUUID = nil
        isConnected = false
        isConnecting = false
        action.fulfill()
    }
    
    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        isMuted = action.isMuted
        action.fulfill()
    }
    
    private func configureAudioSession() {
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
            try audioSession.setActive(true)
        } catch {
            print("Failed to configure audio session: \(error.localizedDescription)")
        }
    }
}
