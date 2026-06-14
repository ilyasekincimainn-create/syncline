import SwiftUI

struct MessageListView: View {
    @StateObject private var viewModel = MessageViewModel()
    @State private var searchText = ""
    @State private var showingNewMessageAlert = false
    @State private var newRecipientNumber = ""
    @State private var newMessageBody = ""
    @State private var navigatedThread: MessageThread?
    @State private var isNavigatingToNewThread = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                Color.primaryBackground
                    .ignoresSafeArea()
                
                // Neon Blur
                RadialGradient(
                    colors: [Color.neonPurple.opacity(0.1), Color.clear],
                    center: .topLeading,
                    startRadius: 50,
                    endRadius: 400
                )
                .ignoresSafeArea()
                
                VStack(spacing: 16) {
                    // Search Bar
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.textSecondary)
                        TextField("Mesajlarda veya numaralarda ara...", text: $searchText)
                            .foregroundColor(.white)
                            .font(.premiumBody())
                    }
                    .padding(12)
                    .background(Color.white.opacity(0.06))
                    .cornerRadius(10)
                    .padding(.horizontal)
                    
                    // List
                    if filteredThreads.isEmpty {
                        VStack(spacing: 12) {
                            Spacer()
                            Image(systemName: "message.badge.filled.fill")
                                .font(.system(size: 60))
                                .foregroundColor(.textSecondary)
                            Text("Mesaj Bulunmadı")
                                .font(.premiumHeadline())
                                .foregroundColor(.white)
                            Text("Henüz senkronize edilmiş bir mesaj bulunmuyor veya arama kriterinizle eşleşen sonuç yok.")
                                .font(.premiumFootnote())
                                .foregroundColor(.textSecondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 40)
                            Spacer()
                        }
                    } else {
                        List(filteredThreads) { thread in
                            ZStack {
                                NavigationLink(destination: MessageDetailView(thread: thread, viewModel: viewModel)) {
                                    EmptyView()
                                }
                                .opacity(0)
                                
                                MessageRowView(thread: thread)
                            }
                            .listRowBackground(Color.clear)
                            .listRowSeparatorTint(Color.borderGlass)
                        }
                        .listStyle(.plain)
                    }
                }
                
                // Floating Action Button
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Button(action: {
                            showingNewMessageAlert = true
                        }) {
                            Image(systemName: "square.and.pencil")
                                .font(.title)
                                .foregroundColor(.white)
                                .frame(width: 56, height: 56)
                                .background(Color.premiumGradient)
                                .clipShape(Circle())
                                .shadow(color: Color.neonBlue.opacity(0.4), radius: 10, x: 0, y: 5)
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Mesajlar")
            .navigationDestination(isPresented: $isNavigatingToNewThread) {
                if let thread = navigatedThread {
                    MessageDetailView(thread: thread, viewModel: viewModel)
                }
            }
            .sheet(isPresented: $showingNewMessageAlert) {
                newMessageSheet
            }
        }
    }
    
    private var filteredThreads: [MessageThread] {
        if searchText.isEmpty {
            return viewModel.threads
        } else {
            return viewModel.threads.filter { thread in
                thread.address.contains(searchText) ||
                thread.messages.contains { msg in
                    msg.decryptedBody.lowercased().contains(searchText.lowercased())
                }
            }
        }
    }
    
    private var newMessageSheet: some View {
        NavigationStack {
            ZStack {
                Color.primaryBackground.ignoresSafeArea()
                
                VStack(spacing: 24) {
                    Text("Yeni Mesaj")
                        .font(.premiumTitle2())
                        .foregroundColor(.white)
                        .padding(.top)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Alıcı Numarası")
                            .font(.premiumFootnote())
                            .foregroundColor(.textSecondary)
                        
                        TextField("Örn: 5551234567", text: $newRecipientNumber)
                            .keyboardType(.phonePad)
                            .padding(14)
                            .background(Color.white.opacity(0.08))
                            .cornerRadius(10)
                            .foregroundColor(.white)
                            .font(.premiumBody())
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Mesaj İçeriği")
                            .font(.premiumFootnote())
                            .foregroundColor(.textSecondary)
                        
                        TextEditor(text: $newMessageBody)
                            .frame(height: 120)
                            .padding(10)
                            .scrollContentBackground(.hidden)
                            .background(Color.white.opacity(0.08))
                            .cornerRadius(10)
                            .foregroundColor(.white)
                            .font(.premiumBody())
                    }
                    
                    Spacer()
                    
                    GradientButton(title: "Gönder", icon: "paperplane.fill") {
                        guard !newRecipientNumber.isEmpty && !newMessageBody.isEmpty else { return }
                        
                        // Send SMS
                        viewModel.sendMessage(to: newRecipientNumber, body: newMessageBody)
                        
                        // Prep for navigation
                        let tempThread = MessageThread(
                            address: newRecipientNumber,
                            messages: []
                        )
                        
                        showingNewMessageAlert = false
                        newRecipientNumber = ""
                        newMessageBody = ""
                        
                        // Navigate to detail
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            self.navigatedThread = tempThread
                            self.isNavigatingToNewThread = true
                        }
                    }
                    .padding(.bottom, 20)
                }
                .padding()
            }
            .navigationBarItems(leading: Button("İptal") {
                showingNewMessageAlert = false
            }.foregroundColor(.neonPink))
        }
        .presentationDetents([.medium, .large])
    }
}
