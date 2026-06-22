import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Appearance,
  Platform,
  ScrollView,
  StatusBar as RNStatusBar,
  useWindowDimensions,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "./ui/AppHeader";
import { ViewTabs } from "./ui/ViewTabs";
import { COPY } from "./copy";
import { DARK_THEME, resolveTheme } from "./theme";
import { styles } from "./styles";
import type { LocaleMode, ThemeMode, ViewKey } from "./types";
import { OverviewScreen } from "./screens/OverviewScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { LiveScreen } from "./screens/LiveScreen";
import { StatusScreen } from "./screens/StatusScreen";
import { NotesScreen } from "./screens/NotesScreen";
import { CAMERAS, DEFAULT_CAMERA } from "./cameras";
import { getSignalingDefaults } from "./config";
import { useSignalingConnection } from "./signaling/useSignalingConnection";
import { getGo2RtcDefaults } from "./webrtc/config";
import { fetchRuntimeCameras } from "./runtime";
import { loginToSignaling } from "./auth";
import { LoginScreen } from "./screens/LoginScreen";

// AppShell is the orchestration layer.
// It owns only:
// 1) theme state
// 2) language state
// 3) view state
// 4) the layout that puts the header, tabs, and current screen together
export default function AppShell() {
  const systemScheme = Appearance.getColorScheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Main UI state. These are intentionally simple so the app is easy to reason about.
  const [view, setView] = useState<ViewKey>("overview");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [locale, setLocale] = useState<LocaleMode>("tr");
  const [profileOpen, setProfileOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Resolve the active theme from the OS theme and the user's selected preference.
  const theme = useMemo(
    () => resolveTheme(themeMode, systemScheme === "dark" ? "dark" : "light"),
    [themeMode, systemScheme],
  );
  const copy = COPY[locale];
  const isRTL = locale === "ar";
  const [cameras, setCameras] = useState(CAMERAS);
  const [selectedCamera, setSelectedCamera] = useState(DEFAULT_CAMERA);
  const [cameraCatalogState, setCameraCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const signalingDefaults = getSignalingDefaults(selectedCamera, sessionToken);
  const signaling = useSignalingConnection({
    url: signalingDefaults.url,
    room: signalingDefaults.room,
    role: signalingDefaults.role,
    name: signalingDefaults.name,
    authToken: signalingDefaults.authToken,
    autoConnect: Boolean(sessionToken),
  });
  const go2rtcDefaults = getGo2RtcDefaults(
    selectedCamera,
    signalingDefaults.url,
    signalingDefaults.authToken,
  );
  const nativeWebRtcEnabled =
    process.env.EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED?.trim().toLowerCase() === "true";

  async function login(username: string, password: string) {
    const session = await loginToSignaling(signalingDefaults.url, username, password);
    setSessionToken(session.accessToken);
    setSessionExpiresAt(session.expiresAt);
    setCameraCatalogState("loading");
  }

  useEffect(() => {
    if (!sessionToken) return;

    let cancelled = false;

    async function loadRuntimeCameras() {
      try {
        const runtimeCameras = await fetchRuntimeCameras(
          signalingDefaults.url,
          CAMERAS,
          signalingDefaults.authToken,
        );
        if (!cancelled) {
          setCameras(runtimeCameras);
          setSelectedCamera((current) => runtimeCameras.find((camera) => camera.id === current.id) ?? runtimeCameras[0]);
          setCameraCatalogState("ready");
        }
      } catch {
        if (!cancelled) {
          setCameras(CAMERAS);
          setSelectedCamera(DEFAULT_CAMERA);
          setCameraCatalogState("error");
        }
      }
    }

    loadRuntimeCameras();

    return () => {
      cancelled = true;
    };
  }, [sessionToken, signalingDefaults.url]);

  useEffect(() => {
    if (!sessionExpiresAt) return;

    const remaining = sessionExpiresAt - Date.now();
    if (remaining <= 0) {
      setSessionToken(null);
      setSessionExpiresAt(null);
      return;
    }

    const timer = setTimeout(() => {
      signaling.disconnect();
      setSessionToken(null);
      setSessionExpiresAt(null);
      setCameras(CAMERAS);
      setSelectedCamera(DEFAULT_CAMERA);
    }, remaining);

    return () => clearTimeout(timer);
  }, [sessionExpiresAt, signaling.disconnect]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [view]);

  // These text styles flip alignment for Arabic, while keeping TR/EN left aligned.
  const contentTextStyle = isRTL ? styles.rtlText : styles.ltrText;
  const paragraphText = isRTL ? styles.textRTL : styles.textLTR;

  // Android and notched devices need a safe top offset.
  const compactHeader = width < 390;
  const statusInset = Math.max(
    insets.top,
    Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0,
  );
  const topPadding = statusInset + (compactHeader ? 10 : 14);

  // These sizes scale slightly on narrow phones so the header does not collide with the status bar.
  const brandSize = compactHeader ? 52 : 58;
  const logoSize = compactHeader ? 38 : 42;
  const profileSize = compactHeader ? 48 : 52;
  const profileDockWidth = Math.min(width - 36, compactHeader ? 290 : 336);
  const profileMenuTop = profileSize + 10;

  if (!sessionToken) {
    return (
      <View style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <StatusBar style={theme === DARK_THEME ? "light" : "dark"} />
        <LoginScreen theme={theme} serverUrl={signalingDefaults.url} onLogin={login} />
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style={theme === DARK_THEME ? "light" : "dark"} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingTop: topPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top hero area: logo, profile button, title, subtitle, and summary badges. */}
        <AppHeader
          copy={copy}
          theme={theme}
          contentTextStyle={contentTextStyle}
          profileOpen={profileOpen}
          setProfileOpen={setProfileOpen}
          setView={setView}
          brandSize={brandSize}
          logoSize={logoSize}
          profileSize={profileSize}
          profileDockWidth={profileDockWidth}
          profileMenuTop={profileMenuTop}
        />

        {/* Main navigation tabs. These decide which screen is visible below. */}
        <ViewTabs copy={copy} theme={theme} view={view} setView={setView} />

        {/* Only one screen is rendered at a time. This keeps layout simple and predictable. */}
        {view === "overview" ? (
          <OverviewScreen
            copy={copy.overview}
            theme={theme}
            contentTextStyle={contentTextStyle}
            isRTL={isRTL}
            cameras={cameras}
            selectedCameraId={selectedCamera.id}
            cameraCatalogState={cameraCatalogState}
            onSelectCamera={setSelectedCamera}
            onOpenLive={() => setView("live")}
          />
        ) : null}

        {view === "setup" ? (
          <SetupScreen
            copy={copy.setup}
            theme={theme}
            contentTextStyle={contentTextStyle}
            isRTL={isRTL}
          />
        ) : null}

        {view === "live" ? (
          <LiveScreen
            copy={copy.live}
            theme={theme}
            isRTL={isRTL}
            playerUrl={go2rtcDefaults.playerUrl}
            streamStatusUrl={go2rtcDefaults.streamStatusUrl}
            streamName={go2rtcDefaults.streamName}
            cameraName={selectedCamera.name}
            cameraLocation={selectedCamera.location}
            requestHeaders={go2rtcDefaults.requestHeaders}
            signalingUrl={signalingDefaults.url}
            signalingAuthToken={signalingDefaults.authToken}
            iceServers={go2rtcDefaults.iceServers}
            nativeWebRtcEnabled={nativeWebRtcEnabled}
          />
        ) : null}

        {view === "settings" ? (
          <SettingsScreen
            copy={copy.settings}
            theme={theme}
            contentTextStyle={contentTextStyle}
            isRTL={isRTL}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            locale={locale}
            setLocale={setLocale}
            modeLabels={copy.modeLabels}
            languageButtons={copy.languageButtons}
          />
        ) : null}

        {view === "status" ? (
          <StatusScreen
            copy={copy.status}
            theme={theme}
            isRTL={isRTL}
            signaling={signaling}
            onConnect={signaling.connect}
            onDisconnect={signaling.disconnect}
          />
        ) : null}

        {view === "notes" ? (
          <NotesScreen
            copy={copy.notes}
            theme={theme}
            contentTextStyle={contentTextStyle}
            paragraphText={paragraphText}
            activeViewLabel={copy.views.find((item) => item.key === view)?.label ?? copy.views[0].label}
            isRTL={isRTL}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
