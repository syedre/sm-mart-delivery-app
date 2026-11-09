# SM mart Delivery App

A separate Expo React Native app for SM mart delivery partners.

## Isolation and safety

- This repository is independent of the SM mart customer app.
- It does not connect to the production Supabase project or production order APIs.
- It does not change Supabase schemas, migrations, Edge Functions, webhooks, or the Render catalog socket.
- Sample orders remain local demo data until a separately approved integration is designed.

## Firebase setup

The app uses the Firebase JavaScript SDK and the separate Firebase project created for SM mart Delivery.

1. Copy `.env.example` to `.env`.
2. Fill in the `EXPO_PUBLIC_FIREBASE_*` values from Firebase Console → Project settings → General → Your apps → SM mart Delivery.
3. Keep the Realtime Database in locked mode. Configure Firebase Authentication and restrictive Realtime Database Security Rules before enabling client reads or writes.
4. Restart Expo after changing `.env`:

   ```bash
   npx expo start --clear
   ```

Firebase client configuration is not a substitute for database security rules. Never make the database publicly readable or writable.

## Current functionality

- Demo phone-number sign-in (no real authentication or OTP).
- Local sample assigned orders.
- Order details and COD summary.
- Foreground GPS display on the delivery partner's device.
- Local demo completion flow.

## Not yet enabled

- Firebase Authentication / real delivery partner accounts.
- Publishing GPS coordinates to Realtime Database.
- Customer-side live location display.
- Background GPS tracking.
- Live assigned-order synchronization with the production order system.

The Firebase app and Realtime Database initialization module is present, but GPS publishing is intentionally not enabled until authentication and database security rules are configured and tested.
