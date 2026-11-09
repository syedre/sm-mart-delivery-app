# SM mart Delivery App

A separate Expo React Native app for SM mart delivery partners.

## Isolation and safety

- This repository is independent of the SM mart customer app.
- It does not connect to the production Supabase project or production order APIs.
- It does not change Supabase schemas, migrations, Edge Functions, webhooks, or the Render catalog socket.
- Sample orders remain local demo data until a separately approved integration is designed.

## Firebase setup

The app uses the separate Firebase project created for SM mart Delivery. Phone sign-in uses React Native Firebase native modules; the Firebase JavaScript SDK remains available for the planned Realtime Database client.

1. Copy `.env.example` to `.env`.
2. Fill in the `EXPO_PUBLIC_FIREBASE_*` values from Firebase Console → Project settings → General → Your apps → SM mart Delivery.
3. Keep the Realtime Database in locked mode. Configure Firebase Authentication and restrictive Realtime Database Security Rules before enabling client reads or writes.
4. Restart Expo after changing `.env`:

   ```bash
   npx expo start --clear
   ```

Firebase client configuration is not a substitute for database security rules. Never make the database publicly readable or writable.

## Current functionality

- Firebase Phone Authentication with a 6-digit OTP verification screen.
- Firebase auth session restoration and sign-out.
- Local sample assigned orders.
- Order details and COD summary.
- Foreground GPS display on the delivery partner's device.
- Local demo completion flow.

## Not yet enabled

- Driver authorization/allowlisting (phone verification alone does not establish that someone is an approved driver).
- Publishing GPS coordinates to Realtime Database.
- Customer-side live location display.
- Background GPS tracking.
- Live assigned-order synchronization with the production order system.

Firebase phone authentication is now wired into the app. The Realtime Database client is initialized from the Firebase web config, but the app does not yet read or write delivery data or GPS coordinates. Those features stay disabled until restrictive database rules and driver authorization are implemented and tested.


## Native Firebase phone authentication setup

1. In Firebase Console → Project settings → General, register an Android app with package `com.smmart.delivery` and download `google-services.json`.
2. Register an iOS app with bundle identifier `com.smmart.delivery` and download `GoogleService-Info.plist`.
3. Place both files in the repository root beside `app.json`. They are ignored by Git and must be supplied to your build environment securely.
4. For Android phone-auth verification, add the development/build signing SHA-1 and SHA-256 fingerprints in Firebase Project settings → Android app. For production, add the Play App Signing fingerprints too.
5. Rebuild a development client. Native Firebase modules do not run in Expo Go.
6. Test with the exact configured test phone number and test code from Firebase Authentication → Phone.

The login currently accepts Indian 10-digit mobile numbers and sends them to Firebase as `+91` numbers. Firebase authentication confirms phone ownership; a separate driver authorization/allowlist and database rules are still required before production data access.
