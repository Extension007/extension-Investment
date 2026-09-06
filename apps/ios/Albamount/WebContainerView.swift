import SwiftUI

struct WebContainerView: View {
    private let siteURL = URL(string: "https://www.albamount.xyz/")!

    var body: some View {
        SiteWebView(url: siteURL)
            .background(Color(red: 10 / 255, green: 31 / 255, blue: 22 / 255))
            .ignoresSafeArea(edges: .bottom)
    }
}

#Preview {
    WebContainerView()
}
