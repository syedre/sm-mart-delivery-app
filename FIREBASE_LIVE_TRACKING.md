# Firebase live delivery tracking

This feature uses only the separate `sm-delivery-app-10f03` Firebase project and its Realtime Database. It does not connect to the SM mart customer app, Supabase, Render, or the production order backend.

## Realtime Database path

Each active sample delivery writes to:

`deliverySessions/{orderId}`

The record contains the delivery partner UID, sample order identifier, delivery status, start/completion timestamps, and the latest GPS point. GPS updates are sent while the Active delivery screen is open, using the existing 5-second / 5-metre location watcher.

This first stage is foreground-only. It does not yet guarantee location updates while the app is backgrounded or terminated.

## Install and build

From the repository root:

```bash
npm install
npm run typecheck
```

Then build Android locally:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"
cd android
NODE_ENV=development ./gradlew assembleDebug
```

Install the APK:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Publish the database rules

In Firebase Console, open project **sm-delivery-app-10f03** → Realtime Database → Rules. Replace the current rules with the contents of `database.rules.json` and select **Publish**.

These rules allow an authenticated delivery partner to read and write only a session whose `partnerUid` matches their Firebase Authentication UID. They do not grant customer-app access.

## Test

1. Sign in with the existing delivery partner username and password.
2. Open one of the sample orders and select **Start delivery**.
3. Keep the Active delivery screen open and move with the device. The location and timestamp should update under `deliverySessions/{orderId}` in Realtime Database.
4. Select **Mark as delivered**. The session status should change to `delivered` and `tracking.active` to `false`.

The app still uses local sample orders. No real customer order is assigned, and no customer-facing tracking screen is included in this stage.
