# Billora

Billing app for shop owners (Android and iOS). It creates a bill in under a minute, prints it on a Bluetooth thermal printer or shares it as an A4 PDF invoice, and puts the shop's payment QR code on both.

Stack: React Native 0.88 + TypeScript, Firebase Auth (phone), Cloud Firestore, Remote Config. Everything runs on Firebase's **free Spark plan**: no Cloud Functions, no Cloud Storage, no billing account.

App IDs: Android `com.billora.app`, iOS `com.billora.app`.

## 1. Firebase setup (one time, free)

1. Create a Firebase project and stay on the free **Spark** plan.
2. **Security → Authentication → Sign-in method → Phone**: enable it. Under **Phone numbers for testing**, add **your own mobile number** with a secret 6-digit code. You sign in with that code; no SMS is sent, so it's free. Real SMS OTPs need a paid plan.
3. **Databases & Storage → Firestore → Create database**: Standard edition, production mode. (This project's database is in `nam5`, United States. The location can't be changed and works fine from India.)
> **Config files are not in Git.** `android/app/google-services.json` and `ios/Billora/GoogleService-Info.plist` contain API keys, so they are git-ignored. Download your own from Firebase console → Project settings → Your apps. `*.example.*` files next to them show the expected shape.

4. Add an **Android app** with package `com.billora.app`. Add the debug **SHA-1 and SHA-256** (`cd android && ./gradlew signingReport`). Put `google-services.json` in `android/app/`.
5. Add an **iOS app** with bundle ID `com.billora.app`. Add `GoogleService-Info.plist` to the `Billora` target in Xcode. Add the **Encoded App ID** (Project settings → iOS app) as a URL scheme: Xcode → Billora target → Info → URL Types.
6. Deploy the rules and the GST rate list:

   ```sh
   npm i -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore,remoteconfig
   ```

## 2. Run

```sh
npm install
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios        # or: npm run android
```

`npm test` runs the unit tests: billing maths (including the PRD §8.3 worked example), thermal layout and ESC/POS bytes, A4 pagination, validation, UPI parsing and date ranges.

## Brand: app icon and splash screen

From the **Billora – App UI** design canvas ("Billora logo": concept **Receipt B**, background **Green**, accent **Gold**). The still logo is the app icon; the animated logo is the splash screen.

- **Logo artwork:** `src/brand/mark.ts`. This one file holds the shapes for the icon, the in-app logo (`src/components/BrandMark.tsx`) and the splash animation.
- **App icons:** run `npm run brand` (`scripts/generate-brand-assets.ts`). It writes:
  - Android launcher icons: legacy, round, adaptive, and themed/monochrome for Android 13+
  - the iOS 1024 px app icon
  - `assets/brand/` master files, including a 512 px store icon
- **Native splash:** shown instantly at launch: the empty green tile with its printer slot, on `#F5F6F3`. It's made by react-native-bootsplash from `assets/brand/splash-logo.svg`:

  ```sh
  npx react-native-bootsplash generate assets/brand/splash-logo.svg --platforms=android,ios --background=F5F6F3 --logo-width=120
  ```

  Keep `--logo-width` equal to `SIZE` in `src/components/AnimatedSplash.tsx`.
- **Animated splash:** `src/components/AnimatedSplash.tsx` takes over from the native splash at the same spot. The receipt prints out of the slot, its lines appear, the ₹ coin drops in and "Billora" fades in. Then it fades out once sign-in state has loaded. It is skipped when the phone's *Reduce motion* setting is on.

After changing the icon or splash, rebuild the app (`npx react-native run-android` / `run-ios`). Android launchers can cache the old icon, so uninstall and reinstall the app if you still see it.

## 3. Where things are

| PRD | Code |
| --- | --- |
| §3 Sign-in, OTP, register | `src/screens/auth/*`, `src/services/authService.ts` |
| §4 Business profile setup | `src/screens/profile/ProfileSetupScreen.tsx`, `profileForm.tsx` |
| §5 Navigation | `src/navigation/RootNavigator.tsx` |
| §6–7 Create bill, items, scanner | `src/screens/bill/CreateBillScreen.tsx`, `AddItemSheet.tsx`, `ScannerScreen.tsx` |
| §8 Calculation and GST | `src/lib/billing.ts` |
| §9.1 Thermal bill | `src/lib/thermal.ts` (layout + ESC/POS), `src/components/ThermalPreview.tsx` |
| §9.2 A4 invoice | `src/lib/invoiceHtml.ts`, `src/services/pdfService.ts` |
| §10 Print, download, share | `src/screens/bill/useBillActions.ts`, `BillViewScreen.tsx`, `src/services/printerService.ts` |
| §11 Transaction history | `src/screens/HistoryScreen.tsx`, `src/services/billService.ts` |
| §12 Profile, QR, printer settings | `src/screens/profile/*` |
| §13 / §15.1 Data and rules | `src/services/billService.ts`, `firestore.rules` |
| §16 Design tokens | `src/config/theme.ts` |
| §16.7 App name | `src/config/app.ts` (`APP_NAME`); also `app.json`, `android/app/src/main/res/values/strings.xml`, iOS `CFBundleDisplayName` |

### Data layout

```
registeredNumbers/{+91…}          { uid }  — "is this number registered?" (one-number lookups only, no listing)
merchants/{uid}                   mobileNumber, ownerName, createdAt (server time), lastLoginAt
merchants/{uid}/settings/profile  business profile, qrPayload, upiId, logoDataUri, printerPaperWidth, complete
merchants/{uid}/counters/{fy}     last bill number for that financial year
merchants/{uid}/bills/{id}        bill + items[] + businessSnapshot  (create only, never updated or deleted)
merchants/{uid}/products/{id}     name, nameLower, barcode, unitPrice, gstRate
merchants/{uid}/customers/{mobile}  name
```

## 4. Design decisions

- **Bills are saved in one Firestore transaction.** The app reads the year's counter, writes counter + 1 and the bill together, and also stores the customer and products. `firestore.rules` checks that the number is exactly counter + 1, that the time is the server's, and that saved bills can never be updated or deleted. Retrying the same bill (`requestId`) returns the one already saved instead of creating a second. Saving needs a connection.
- **The bill number on Create Bill is a preview.** The real number is taken only on save.
- **The phone's date must be correct.** The financial year in the bill number is checked against server time, so a phone with a wrong date can't save bills.
- **The payment QR is stored as its text, not as an image.** When you upload the QR photo, the app reads the QR (e.g. `upi://pay?...`) and saves only that. It redraws a sharp QR on screen, on the thermal bill (about 35 mm on 58 mm paper, 45 mm on 80 mm) and in the PDF. Reprints always use the current QR (§12.2).
- **The logo is stored in the profile record**, as a small JPEG (240 px). This avoids Cloud Storage, which isn't free.
- **Thermal printing uses Bluetooth Low Energy** (`react-native-ble-plx`), which works on both Android and iOS. Bluetooth Classic-only printers (older SPP models) will not show up.
- **The thermal bill is ASCII.** ₹ prints as `Rs.` (§16.5). Non-Latin product names, such as Hindi, print as `?` because built-in printer fonts can't render them.
- **The A4 invoice paginates itself.** Up to 20 single-line items fit on page 1 with totals, GST summary and QR. Beyond that, the item table continues with the header repeated and "Page X of Y" on each page. Very long product names take more than one line, so fewer of them fit per page.
- **The OTP lock** (5 wrong attempts → 15 minutes) is enforced on the device. Firebase adds its own server-side rate limits on top.
- **The test-number code is a password.** Anyone who knows your number and that code can sign in, so keep it private.
- **GSTIN** is format-checked as the PRD asks. The GSTN checksum is not enforced, because the PRD's own sample `22AAAAA0000A1Z5` fails it.

## 5. Known deviations from the PRD

- **iOS minimum is 15.5, not 15.0.** ML Kit, used to read the QR code from an uploaded photo (§12.2), requires it.
- **No real SMS on the free plan.** Sign-in uses Firebase test numbers (§3). Upgrading to Blaze later turns on real SMS with no code changes.
- **Rules check the shape of a bill, but don't recompute its totals.** The totals are calculated by the app (`src/lib/billing.ts`).

## 6. Check on real devices before release

These need hardware and can't be covered by unit tests:

- Printing on a 58 mm and an 80 mm BLE printer: alignment, QR size, no text cut off
- Scanning the printed QR with a UPI app (acceptance criterion in §14.2)
- The PDF page size and the 20-items-on-one-page layout on both iOS and Android
- SMS auto-read on Android, and the iOS OTP autofill suggestion
