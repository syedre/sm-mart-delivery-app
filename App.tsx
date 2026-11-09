import React, { useEffect, useState } from "react";
import "./src/lib/firebase";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut,
  type FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
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
import { SAMPLE_ORDERS, DeliveryOrder } from "./src/data/orders";

type Screen = "login" | "verify" | "orders" | "details" | "active";

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

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [partnerName, setPartnerName] = useState("Delivery Partner");
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
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
          setPartnerName(user.phoneNumber || "SM mart Delivery Partner");
          setScreen("orders");
        } else {
          setScreen("login");
        }
        setAuthError(null);
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
          setLocationText(
            `GPS active · ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`
          );
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
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      Alert.alert("Check mobile number", "Enter your 10-digit Indian mobile number.");
      return;
    }
    setBusy(true);
    try {
      const result = await signInWithPhoneNumber(getAuth(), `+91${digits}`);
      setConfirmation(result);
      setVerificationCode("");
      setScreen("verify");
    } catch (error) {
      const code = (error as { code?: string }).code;
      const message = code === "auth/invalid-phone-number"
        ? "Please check the mobile number and try again."
        : code === "auth/too-many-requests"
          ? "Too many attempts. Please wait before trying again."
          : code === "auth/quota-exceeded"
            ? "Firebase SMS quota has been reached. Use your configured test number or try again tomorrow."
            : "We could not send the verification code. Check your connection and Firebase app setup.";
      Alert.alert("Unable to send OTP", message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!confirmation || verificationCode.trim().length !== 6) {
      Alert.alert("Enter verification code", "Enter the 6-digit code from Firebase.");
      return;
    }
    setBusy(true);
    try {
      await confirmation.confirm(verificationCode.trim());
      setConfirmation(null);
    } catch (error) {
      const code = (error as { code?: string }).code;
      Alert.alert(
        "Verification failed",
        code === "auth/invalid-verification-code"
          ? "That code is incorrect. Check the code and try again."
          : "We could not verify this code. Please request a new one."
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelVerification = () => {
    setConfirmation(null);
    setVerificationCode("");
    setScreen("login");
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
      setActiveOrderId(order.id);
      setSelectedOrder(order);
      setLocationText("Starting GPS…");
      setScreen("active");
    } catch {
      Alert.alert("Unable to start delivery", "Please check location permission and try again.");
    } finally {
      setBusy(false);
    }
  };

  const completeDelivery = () => {
    if (!activeOrderId) return;
    setCompletedIds((current) => [...current, activeOrderId]);
    setActiveOrderId(null);
    setSelectedOrder(null);
    setLocationText("Tracking stopped");
    setScreen("orders");
    Alert.alert("Demo delivery completed", "This only updates the local demo state. No production order was changed.");
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
          <Text style={styles.body}>Sign in with your registered mobile number to view your deliveries.</Text>
          <Text style={styles.label}>Mobile number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="10-digit mobile number"
            placeholderTextColor="#9aa49b"
            style={styles.input}
            maxLength={10}
          />
          <TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={signIn}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send verification code</Text>}
          </TouchableOpacity>
          <Text style={styles.demoNote}>Secure sign-in powered by Firebase</Text>
          {authError ? <Text style={styles.authError}>Firebase sign-in is unavailable: {authError}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "verify") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loginWrap}>
          <Text style={styles.brand}>Verify your number</Text>
          <Text style={styles.body}>Enter the 6-digit verification code sent to +91 {phone}.</Text>
          <Text style={styles.label}>Verification code</Text>
          <TextInput
            value={verificationCode}
            onChangeText={(value) => setVerificationCode(value.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            placeholder="6-digit code"
            placeholderTextColor="#9aa49b"
            style={styles.input}
            maxLength={6}
            autoFocus
          />
          <TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={verifyCode}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify and sign in</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={cancelVerification}><Text style={styles.signOut}>Change mobile number</Text></TouchableOpacity>
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
          <Text style={styles.disclaimer}>Demo only: location is displayed on this device and is not transmitted to customers.</Text>
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