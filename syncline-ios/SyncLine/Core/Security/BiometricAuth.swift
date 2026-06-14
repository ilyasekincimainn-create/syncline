import Foundation
import LocalAuthentication

class BiometricAuth {
    
    static let shared = BiometricAuth()
    
    private init() {}
    
    enum BiometricType {
        case none
        case touchID
        case faceID
        case opticID
    }
    
    var biometricType: BiometricType {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        
        switch context.biometryType {
        case .none:
            return .none
        case .touchID:
            return .touchID
        case .faceID:
            return .faceID
        case .opticID:
            return .opticID
        @unknown default:
            return .none
        }
    }
    
    var isBiometricsAvailable: Bool {
        biometricType != .none
    }
    
    func authenticate(reason: String = "Lütfen kimliğinizi doğrulayın", completion: @escaping (Result<Void, Error>) -> Void) {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            let evalError = error ?? NSError(domain: "BiometricAuth", code: -1, userInfo: [NSLocalizedDescriptionKey: "Biyometrik doğrulama kullanılamıyor."])
            completion(.failure(evalError))
            return
        }
        
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, evaluationError in
            DispatchQueue.main.async {
                if success {
                    completion(.success(()))
                } else {
                    let authError = evaluationError ?? NSError(domain: "BiometricAuth", code: -2, userInfo: [NSLocalizedDescriptionKey: "Doğrulama başarısız."])
                    completion(.failure(authError))
                }
            }
        }
    }
}
