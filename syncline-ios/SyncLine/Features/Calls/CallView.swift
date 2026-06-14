import SwiftUI

struct CallView: View {
    @ObservedObject var viewModel: CallViewModel
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        ZStack {
            // Background
            Color.primaryBackground
                .ignoresSafeArea()
            
            // Neon Gradient Blobs
            RadialGradient(
                colors: [Color.neonPurple.opacity(0.15), Color.clear],
                center: .topLeading,
                startRadius: 50,
                endRadius: 400
            )
            .ignoresSafeArea()
            
            RadialGradient(
                colors: [Color.neonBlue.opacity(0.12), Color.clear],
                center: .bottomTrailing,
                startRadius: 100,
                endRadius: 500
            )
            .ignoresSafeArea()
            
            VStack(spacing: 40) {
                Spacer()
                
                // Contact Details
                VStack(spacing: 12) {
                    ZStack {
                        // Profile Ring
                        Circle()
                            .stroke(
                                LinearGradient(
                                    colors: [Color.neonBlue, Color.neonPurple],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 2
                            )
                            .frame(width: 110, height: 110)
                            .shadow(color: Color.neonBlue.opacity(0.3), radius: 10)
                        
                        Image(systemName: "person.crop.circle.fill")
                            .resizable()
                            .foregroundColor(.textSecondary)
                            .frame(width: 100, height: 100)
                            .clipShape(Circle())
                        
                        if viewModel.callState == .active {
                            PulsingDot(color: Color.neonGreen)
                                .offset(x: 35, y: -35)
                        } else if viewModel.callState == .dialing || viewModel.callState == .connecting {
                            PulsingDot(color: Color.neonBlue)
                                .offset(x: 35, y: -35)
                        }
                    }
                    .padding(.bottom, 10)
                    
                    Text(viewModel.contactName)
                        .font(.premiumTitle1())
                        .foregroundColor(.white)
                    
                    Text(viewModel.callState.rawValue)
                        .font(.premiumHeadline())
                        .foregroundColor(viewModel.callState == .active ? Color.neonGreen : Color.textSecondary)
                }
                
                // Timer
                if viewModel.callState == .active {
                    Text(viewModel.durationString)
                        .font(.system(size: 44, weight: .light, design: .monospaced))
                        .foregroundColor(.white)
                        .padding(.vertical, 8)
                        .transition(.opacity)
                } else {
                    Text(" ")
                        .font(.system(size: 44))
                        .padding(.vertical, 8)
                }
                
                Spacer()
                
                // Action Controls inside a Glass Card
                GlassCard {
                    HStack(spacing: 32) {
                        // Mute Button
                        Button(action: {
                            viewModel.toggleMute()
                        }) {
                            VStack(spacing: 8) {
                                Image(systemName: viewModel.isMuted ? "mic.slash.fill" : "mic.fill")
                                    .font(.title2)
                                    .foregroundColor(viewModel.isMuted ? .white : .textSecondary)
                                    .frame(width: 60, height: 60)
                                    .background(viewModel.isMuted ? Color.neonPink : Color.white.opacity(0.1))
                                    .clipShape(Circle())
                                
                                Text("Sessiz")
                                    .font(.premiumFootnote())
                                    .foregroundColor(.textSecondary)
                            }
                        }
                        
                        // Speaker Button
                        Button(action: {
                            viewModel.toggleSpeaker()
                        }) {
                            VStack(spacing: 8) {
                                Image(systemName: viewModel.isSpeakerOn ? "speaker.wave.3.fill" : "speaker.wave.1.fill")
                                    .font(.title2)
                                    .foregroundColor(viewModel.isSpeakerOn ? .white : .textSecondary)
                                    .frame(width: 60, height: 60)
                                    .background(viewModel.isSpeakerOn ? Color.neonBlue : Color.white.opacity(0.1))
                                    .clipShape(Circle())
                                
                                Text("Hoparlör")
                                    .font(.premiumFootnote())
                                    .foregroundColor(.textSecondary)
                            }
                        }
                        
                        // Answer Button (Only shown during incoming call)
                        if viewModel.callState == .incoming {
                            Button(action: {
                                viewModel.answerCall()
                            }) {
                                VStack(spacing: 8) {
                                    Image(systemName: "phone.fill")
                                        .font(.title2)
                                        .foregroundColor(.white)
                                        .frame(width: 60, height: 60)
                                        .background(Color.neonGreen)
                                        .clipShape(Circle())
                                    
                                    Text("Cevapla")
                                        .font(.premiumFootnote())
                                        .foregroundColor(.textSecondary)
                                }
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
                .padding(.horizontal, 30)
                
                // End Call Button
                Button(action: {
                    viewModel.hangupCall()
                }) {
                    Image(systemName: "phone.down.fill")
                        .font(.title)
                        .foregroundColor(.white)
                        .frame(width: 76, height: 76)
                        .background(Color.neonRed)
                        .clipShape(Circle())
                        .shadow(color: Color.neonRed.opacity(0.4), radius: 15, x: 0, y: 8)
                }
                .buttonStyle(ScaleButtonStyle())
                .padding(.bottom, 40)
            }
        }
        .onChange(of: viewModel.callState) { newState in
            if newState == .idle {
                dismiss()
            }
        }
    }
}
