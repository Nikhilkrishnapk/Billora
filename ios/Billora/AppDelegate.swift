import UIKit
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Needs ios/Billora/GoogleService-Info.plist from the Firebase console.
    FirebaseApp.configure()
    return true
  }
}
