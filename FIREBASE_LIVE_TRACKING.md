# Firebase live delivery tracking

GPS tracking and partner assignments use the separate `sm-delivery-app-10f03` Firebase project. When a partner completes a real assigned order, the app also calls the `complete-delivery` Supabase Edge Function to update the production `orders` row. The customer app itself is not modified; the function is deployed separately in the customer app repository.

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


## Production order completion

The delivery app invokes the `complete-delivery` Supabase Edge Function before stopping Firebase tracking. It sends the active order UUID and the signed-in partner's Firebase ID token. The function verifies the token, verifies the partner's own `partnerAssignments/{uid}/{orderId}` record, and only transitions a Supabase order from `out_for_delivery` to `delivered`. It also marks COD payment as `paid`.

Configure these public values in the delivery app's local `.env` (copy them from the customer app's existing `.env`):

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://jabzndbdybeeugoypboz.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_existing_sb_publishable_key
```

Do not add a Supabase service-role key to the app. Deploy and configure the Edge Function using `DELIVERY_COMPLETION_SETUP.md` in the customer app repository. The Supabase order UUID must be the same key used by `partnerAssignments/{partnerUid}/{orderId}`; demo IDs are rejected.
