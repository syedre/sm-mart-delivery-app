import { useEffect, useState } from "react";
import database from "@react-native-firebase/database";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "@react-native-firebase/auth";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SAMPLE_ORDERS, type DeliveryOrder } from "./src/data/orders";

type Screen = "login" | "orders" | "details" | "active";

// Delivery partner usernames are mapped to the email domain used for Firebase Auth accounts.
const USERNAME_EMAIL_DOMAIN = "@smmart.com";
const usernameToAuthEmail = (username: string) =>
  `${username.trim().toLowerCase()}${USERNAME_EMAIL_DOMAIN}`;

const COLORS = {
  bg: "#faf8f3",
  ink: "#20372a",
  muted: "#738075",
  primary: "#246b45",
  tint: "#eaf2e5",
  border: "#e5e8df",
  white: "#ffffff",
  orange: "#c87927",
};

function AppContent() {
  const [screen, setScreen] = useState<Screen>("login");
  const [partnerName, setPartnerName] = useState("Delivery Partner");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authInitializing, setAuthInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [locationText, setLocationText] = useState("Location not started");
  const [busy, setBusy] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const activeOrder = SAMPLE_ORDERS.find((order) => order.id === activeOrderId);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    try {
      const authInstance = getAuth();
      unsubscribe = onAuthStateChanged(authInstance, (user) => {
        if (!mounted) return;
        if (user) {
          setPartnerName(user.displayName || user.email?.split("@")[0] || "SM mart Delivery Partner");
          setScreen("orders");
          setAuthError(null);
        } else {
          setScreen("login");
        }
        setAuthInitializing(false);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Firebase Authentication could not initialize.";
      setAuthError(message);
      setAuthInitializing(false);
    }

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (screen !== "active" || !activeOrderId) return;
    let subscription: Location.LocationSubscription | null = null;
    let mounted = true;

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (mounted) setLocationText("Location permission not granted");
        return;
      }
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 5,
        },
        (position) => {
          if (!mounted) return;
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          setLocationText(
            `GPS active · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
          );
          database()
            .ref(`/deliverySessions/${activeOrderId}`)
            .update({
              location: {
                latitude,
                longitude,
                accuracy: position.coords.accuracy ?? null,
                heading: position.coords.heading ?? null,
                speed: position.coords.speed ?? null,
                updatedAt: Date.now(),
              },
              lastUpdatedAt: Date.now(),
            })
            .catch(() => {
              if (mounted) setLocationText("GPS active · cloud sync failed");
            });
        }
      );
    })().catch(() => {
      if (mounted) setLocationText("Unable to start GPS");
    });

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [screen, activeOrderId]);

  const signIn = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername)) {
      Alert.alert(
        "Check username",
        "Use 3–30 characters: letters, numbers, dots, underscores or hyphens."
      );
      return;
    }
    if (!password) {
      Alert.alert("Enter password", "Enter the password provided by your administrator.");
      return;
    }

    setBusy(true);
    setAuthError(null);
    try {
      const credential = await signInWithEmailAndPassword(
        getAuth(),
        usernameToAuthEmail(normalizedUsername),
        password
      );
      setPartnerName(
        credential.user.displayName ||
          normalizedUsername.replace(/[._-]/g, " ") ||
          "SM mart Delivery Partner"
      );
      setScreen("orders");
    } catch (error) {
      const code = (error as { code?: string }).code;
      const message =
        code === "auth/invalid-email" ||
        code === "auth/invalid-credential" ||
        code === "auth/user-not-found" ||
        code === "auth/wrong-password"
          ? "Username or password is incorrect."
          : code === "auth/user-disabled"
            ? "This delivery partner account has been disabled. Contact your administrator."
            : code === "auth/too-many-requests"
              ? "Too many attempts. Please wait and try again."
              : "We could not sign you in. Please check your connection and try again.";
      setAuthError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
      setCompletedIds([]);
    } catch {
      Alert.alert("Sign out failed", "Please try again.");
    }
  };

  const startDelivery = async (order: DeliveryOrder) => {
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Location required", "Allow location access to start a delivery.");
        return;
      }
      const user = getAuth().currentUser;
      if (!user) {
        Alert.alert("Sign in required", "Please sign in again before starting a delivery.");
        return;
      }

      await database().ref(`/deliverySessions/${order.id}`).set({
        orderId: order.id,
        displayId: order.displayId,
        partnerUid: user.uid,
        partnerName: partnerName,
        status: "in_progress",
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        tracking: { active: true },
        location: null,
      });

      setActiveOrderId(order.id);
      setSelectedOrder(order);
      setLocationText("Starting GPS and cloud tracking…");
      setScreen("active");
    } catch {
      Alert.alert("Unable to start delivery", "Please check location permission and try again.");
    } finally {
      setBusy(false);
    }
  };

  const completeDelivery = async () => {
    if (!activeOrderId) return;
    setBusy(true);
    try {
      await database().ref(`/deliverySessions/${activeOrderId}`).update({
        status: "delivered",
        completedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        tracking: { active: false },
      });
      setCompletedIds((current) => [...current, activeOrderId]);
      setActiveOrderId(null);
      setSelectedOrder(null);
      setLocationText("Tracking stopped");
      setScreen("orders");
      Alert.alert(
        "Delivery completed",
        "The delivery status was saved to the separate SM mart Delivery Firebase database. No customer-app or production order data was changed."
      );
    } catch {
      Alert.alert("Update failed", "Could not save the delivery status. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const Header = ({ title, back }: { title: string; back?: () => void }) => (
    <View style={styles.header}>
      {back ? <TouchableOpacity onPress={back}><Text style={styles.back}>‹</Text></TouchableOpacity> : <View style={{ width: 24 }} />}
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  if (authInitializing) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} /></SafeAreaView>;
  }

  if (screen === "login") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loginWrap}>
          <View style={styles.logo}><Text style={styles.logoText}>SM</Text></View>
          <Text style={styles.brand}>SM mart</Text>
          <Text style={styles.subtitle}>Delivery Partner</Text>
          <Text style={styles.loginHeading}>Welcome back</Text>
          <Text style={styles.body}>Sign in with the username and password provided by your SM mart administrator.</Text>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            placeholder="Enter your username"
            placeholderTextColor="#9aa49b"
            style={styles.input}
          />
          <Text style={[styles.label, { marginTop: 18 }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            placeholder="Enter your password"
            placeholderTextColor="#9aa49b"
            style={styles.input}
            onSubmitEditing={signIn}
            returnKeyType="go"
          />
          <TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={signIn}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
          </TouchableOpacity>
          <Text style={styles.demoNote}>Secure username and password sign-in</Text>
          {authError ? <Text style={styles.authError}>{authError}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "orders") {
    const pending = SAMPLE_ORDERS.filter((order) => !completedIds.includes(order.id));
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <Header title="My deliveries" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.greeting}>
            <View>
              <Text style={styles.eyebrow}>GOOD MORNING</Text>
              <Text style={styles.greetingTitle}>{partnerName}</Text>
            </View>
            <View style={styles.avatar}><Text style={styles.avatarText}>DP</Text></View>
          </View>
          <View style={styles.statsCard}>
            <View><Text style={styles.statNumber}>{pending.length}</Text><Text style={styles.statLabel}>Assigned</Text></View>
            <View style={styles.statDivider} />
            <View><Text style={styles.statNumber}>{completedIds.length}</Text><Text style={styles.statLabel}>Completed today</Text></View>
          </View>
          <Text style={styles.sectionTitle}>Assigned orders</Text>
          {pending.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => { setSelectedOrder(order); setScreen("details"); }}
            >
              <View style={styles.orderTop}>
                <Text style={styles.orderId}>{order.displayId}</Text>
                <View style={styles.statusPill}><Text style={styles.statusText}>ASSIGNED</Text></View>
              </View>
              <Text style={styles.customer}>{order.customerName}</Text>
              <Text style={styles.address} numberOfLines={2}>{order.address}</Text>
              <View style={styles.orderBottom}>
                <Text style={styles.orderMeta}>{order.itemsCount} items · COD ₹{order.codAmount}</Text>
                <Text style={styles.viewDetails}>View details ›</Text>
              </View>
            </TouchableOpacity>
          ))}
          {pending.length === 0 && <Text style={styles.empty}>No pending demo deliveries.</Text>}
          <Text style={styles.disclaimer}>Sample orders are shown for development. They are not connected to SM mart's live order system.</Text>
          <TouchableOpacity onPress={handleSignOut}><Text style={styles.signOut}>Sign out</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === "details" && selectedOrder) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <Header title="Order details" back={() => setScreen("orders")} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>DELIVERY ORDER</Text>
          <Text style={styles.detailId}>{selectedOrder.displayId}</Text>
          <View style={styles.detailCard}>
            <Text style={styles.label}>CUSTOMER</Text>
            <Text style={styles.customer}>{selectedOrder.customerName}</Text>
            <Text style={styles.address}>{selectedOrder.address}</Text>
            <View style={styles.separator} />
            <Text style={styles.label}>ORDER SUMMARY</Text>
            <Text style={styles.body}>{selectedOrder.itemsCount} items</Text>
            <Text style={styles.body}>Cash to collect: ₹{selectedOrder.codAmount}</Text>
            <View style={styles.separator} />
            <Text style={styles.label}>DELIVERY NOTE</Text>
            <Text style={styles.body}>{selectedOrder.note}</Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={() => startDelivery(selectedOrder)}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Start delivery</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === "active" && activeOrder) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <Header title="Active delivery" />
        <View style={styles.mapWrap}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: activeOrder.latitude,
              longitude: activeOrder.longitude,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }}
            showsUserLocation
            showsMyLocationButton
          >
            <Marker coordinate={{ latitude: activeOrder.latitude, longitude: activeOrder.longitude }} title="Customer location" />
          </MapView>
        </View>
        <View style={styles.activePanel}>
          <View style={styles.activeTop}>
            <View><Text style={styles.eyebrow}>ON THE WAY</Text><Text style={styles.customer}>{activeOrder.customerName}</Text></View>
            <View style={styles.livePill}><Text style={styles.liveText}>GPS ON</Text></View>
          </View>
          <Text style={styles.address}>{activeOrder.address}</Text>
          <Text style={styles.gpsText}>{locationText}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={completeDelivery}>
            <Text style={styles.primaryButtonText}>Mark as delivered</Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>GPS and delivery status are saved to the separate delivery Firebase database. Customer-app tracking is not connected yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return <SafeAreaView style={styles.safe}><Text>Loading…</Text></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { height: 56, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { color: COLORS.ink, fontSize: 32, lineHeight: 34 },
  headerTitle: { color: COLORS.ink, fontSize: 17, fontWeight: "700" },
  loginWrap: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  logo: { width: 58, height: 58, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  logoText: { color: "#fff", fontSize: 23, fontWeight: "800" },
  brand: { color: COLORS.ink, fontSize: 28, fontWeight: "800" },
  subtitle: { color: COLORS.muted, fontSize: 15, marginTop: 2 },
  loginHeading: { color: COLORS.ink, fontSize: 24, fontWeight: "800", marginTop: 54 },
  body: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  label: { color: COLORS.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, marginTop: 24, marginBottom: 9 },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, height: 54, paddingHorizontal: 15, color: COLORS.ink, fontSize: 16 },
  primaryButton: { height: 54, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginTop: 18 },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  demoNote: { color: COLORS.muted, fontSize: 12, textAlign: "center", marginTop: 14 },
  authError: { color: "#b42318", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 10 },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 20 },
  eyebrow: { color: COLORS.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  greetingTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "800", marginTop: 5 },
  avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: COLORS.tint, alignItems: "center", justifyContent: "center" },
  avatarText: { color: COLORS.primary, fontWeight: "800" },
  statsCard: { backgroundColor: COLORS.primary, borderRadius: 17, padding: 20, flexDirection: "row", alignItems: "center", gap: 28, marginBottom: 28 },
  statNumber: { color: "#fff", fontSize: 27, fontWeight: "800" },
  statLabel: { color: "#dcebdd", fontSize: 12, marginTop: 3 },
  statDivider: { width: 1, height: 38, backgroundColor: "#ffffff55" },
  sectionTitle: { color: COLORS.ink, fontSize: 18, fontWeight: "800", marginBottom: 13 },
  orderCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  orderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { color: COLORS.ink, fontWeight: "800", fontSize: 14 },
  statusPill: { backgroundColor: COLORS.tint, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { color: COLORS.primary, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  customer: { color: COLORS.ink, fontSize: 16, fontWeight: "700", marginTop: 12 },
  address: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  orderBottom: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 14, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderMeta: { color: COLORS.muted, fontSize: 11 },
  viewDetails: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  disclaimer: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 20 },
  signOut: { color: COLORS.primary, fontSize: 14, fontWeight: "700", textAlign: "center", marginTop: 22 },
  empty: { color: COLORS.muted, textAlign: "center", marginTop: 30 },
  detailId: { color: COLORS.ink, fontSize: 25, fontWeight: "800", marginTop: 8, marginBottom: 16 },
  detailCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 18 },
  separator: { height: 1, backgroundColor: COLORS.border, marginVertical: 18 },
  mapWrap: { flex: 1, minHeight: 260 },
  activePanel: { padding: 20, backgroundColor: COLORS.white, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  activeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  livePill: { backgroundColor: COLORS.tint, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  liveText: { color: COLORS.primary, fontWeight: "800", fontSize: 10 },
  gpsText: { color: COLORS.orange, fontSize: 11, marginTop: 12 },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
