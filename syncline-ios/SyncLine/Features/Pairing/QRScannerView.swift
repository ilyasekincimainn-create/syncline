import SwiftUI
import AVFoundation

struct QRScannerView: UIViewControllerRepresentable {
    var onCodeScanned: (String) -> Void
    var onFailure: (Error) -> Void
    
    func makeUIViewController(context: Context) -> ScannerViewController {
        let controller = ScannerViewController()
        controller.delegate = context.coordinator
        return controller
    }
    
    func updateUIViewController(_ uiViewController: ScannerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(onCodeScanned: onCodeScanned, onFailure: onFailure)
    }
    
    class Coordinator: NSObject, ScannerViewControllerDelegate {
        var onCodeScanned: (String) -> Void
        var onFailure: (Error) -> Void
        
        init(onCodeScanned: @escaping (String) -> Void, onFailure: @escaping (Error) -> Void) {
            self.onCodeScanned = onCodeScanned
            self.onFailure = onFailure
        }
        
        func scannerDidScan(code: String) {
            onCodeScanned(code)
        }
        
        func scannerDidFail(error: Error) {
            onFailure(error)
        }
    }
}

protocol ScannerViewControllerDelegate: AnyObject {
    func scannerDidScan(code: String)
    func scannerDidFail(error: Error)
}

class ScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    weak var delegate: ScannerViewControllerDelegate?
    var captureSession: AVCaptureSession?
    var previewLayer: AVCaptureVideoPreviewLayer?
    
    enum ScannerError: Error, LocalizedError {
        case cameraUnavailable
        case sessionInitFailed
        
        var errorDescription: String? {
            switch self {
            case .cameraUnavailable: return "Kamera kullanılamıyor veya izin verilmedi."
            case .sessionInitFailed: return "Kamera oturumu başlatılamadı."
            }
        }
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        
        #if targetEnvironment(simulator)
        setupSimulatorPlaceholder()
        #else
        setupCaptureSession()
        #endif
    }
    
    private func setupSimulatorPlaceholder() {
        let label = UILabel()
        label.text = "Simülatör Modu\n(Eşleştirmeyi simüle etmek için buraya dokunun)"
        label.textColor = .white
        label.textAlignment = .center
        label.numberOfLines = 0
        label.font = .systemFont(ofSize: 16, weight: .medium)
        label.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            label.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])
        
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(simulateScan))
        view.addGestureRecognizer(tapGesture)
    }
    
    @objc private func simulateScan() {
        delegate?.scannerDidScan(code: "SYNC-MOCK-1234")
    }
    
    private func setupCaptureSession() {
        let captureSession = AVCaptureSession()
        self.captureSession = captureSession
        
        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else {
            delegate?.scannerDidFail(error: ScannerError.cameraUnavailable)
            return
        }
        
        let videoInput: AVCaptureDeviceInput
        
        do {
            videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
        } catch {
            delegate?.scannerDidFail(error: error)
            return
        }
        
        if captureSession.canAddInput(videoInput) {
            captureSession.addInput(videoInput)
        } else {
            delegate?.scannerDidFail(error: ScannerError.sessionInitFailed)
            return
        }
        
        let metadataOutput = AVCaptureMetadataOutput()
        
        if captureSession.canAddOutput(metadataOutput) {
            captureSession.addOutput(metadataOutput)
            
            metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
            metadataOutput.metadataObjectTypes = [.qr]
        } else {
            delegate?.scannerDidFail(error: ScannerError.sessionInitFailed)
            return
        }
        
        previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        if let previewLayer = previewLayer {
            previewLayer.frame = view.layer.bounds
            previewLayer.videoGravity = .resizeAspectFill
            view.layer.addSublayer(previewLayer)
        }
        
        DispatchQueue.global(qos: .userInitiated).async {
            captureSession.startRunning()
        }
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if let session = captureSession, !session.isRunning {
            DispatchQueue.global(qos: .userInitiated).async {
                session.startRunning()
            }
        }
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if let session = captureSession, session.isRunning {
            session.stopRunning()
        }
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.layer.bounds
    }
    
    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        captureSession?.stopRunning()
        
        if let metadataObject = metadataObjects.first {
            guard let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject else { return }
            guard let stringValue = readableObject.stringValue else { return }
            AudioServicesPlaySystemSound(SystemSoundID(kSystemSoundID_Vibrate))
            delegate?.scannerDidScan(code: stringValue)
        }
    }
}
