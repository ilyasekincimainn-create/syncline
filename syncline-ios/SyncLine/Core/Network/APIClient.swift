import Foundation

class APIClient {
    
    static let shared = APIClient()
    let baseURL = URL(string: "https://syncline-production.up.railway.app/api/auth")!
    
    private init() {}
    
    func registerDevice(
        uuid: String,
        fingerprint: String,
        pushToken: String,
        model: String,
        osVersion: String,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        let url = baseURL.appendingPathComponent("register")
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "uuid": uuid,
            "fingerprint": fingerprint,
            "platform": "ios",
            "pushToken": pushToken,
            "model": model,
            "osVersion": osVersion
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "APIClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "No data received"])))
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    completion(.success(json))
                } else {
                    completion(.failure(NSError(domain: "APIClient", code: -2, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON response"])))
                }
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    func pairDevice(code: String, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        let url = baseURL.appendingPathComponent("pair")
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = KeychainHelper.shared.read(service: "syncline", account: "access_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "code": code
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "APIClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "No data received"])))
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    completion(.success(json))
                } else {
                    completion(.failure(NSError(domain: "APIClient", code: -2, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON response"])))
                }
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
}
