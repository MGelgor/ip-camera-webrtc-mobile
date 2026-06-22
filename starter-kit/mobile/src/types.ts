export type ViewKey = "overview" | "setup" | "live" | "settings" | "status" | "notes";
export type ThemeMode = "system" | "light" | "dark";
export type LocaleMode = "tr" | "en" | "ar" | "ru";
export type SignalingConnectionState = "idle" | "connecting" | "connected" | "closing" | "disconnected" | "error";

export type SignalingEvent = {
  direction: "system" | "outbound" | "inbound";
  type: string;
  summary: string;
  at: string;
};

export type SignalingConnectionSnapshot = {
  status: SignalingConnectionState;
  serverUrl: string;
  room: string;
  role: "viewer" | "publisher";
  name: string;
  clientId: string | null;
  members: number;
  lastEvent: SignalingEvent | null;
  lastError: string | null;
};

export type Theme = {
  background: string;
  surface: string;
  surfaceStrong: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accent2: string;
  success: string;
  warning: string;
  danger: string;
  shadow: string;
  tabBackground: string;
};

export type ChecklistItem = {
  title: string;
  detail: string;
};

export type PlaceholderItem = {
  label: string;
  hint: string;
};

export type AppCopy = {
  views: Array<{ key: ViewKey; label: string }>;
  heroTitle: string;
  heroSubtitle: string;
  badges: {
    device: { label: string; value: string };
    camera: { label: string; value: string };
    network: { label: string; value: string };
  };
  displayModeLabel: string;
  modeLabels: Record<ThemeMode, string>;
  languageLabel: string;
  languageButtons: Array<{ key: LocaleMode; label: string }>;
  profileMenu: { about: string; settings: string; profile: string };
  overview: {
    title: string;
    subtitle: string;
    ready: { title: string; value: string };
    pending: { title: string; value: string };
    final: { title: string; value: string };
    roadmap: string[];
    cameraListTitle: string;
    cameraListSubtitle: string;
    cameraSelectedLabel: string;
    cameraLiveButton: string;
    cameraLoadingLabel: string;
    cameraErrorLabel: string;
    cameraEmptyLabel: string;
  };
  setup: {
    title: string;
    subtitle: string;
    checklist: ChecklistItem[];
  };
  links: {
    title: string;
    subtitle: string;
    placeholders: PlaceholderItem[];
  };
  settings: {
    title: string;
    subtitle: string;
    appearanceTitle: string;
    appearanceSubtitle: string;
    languageTitle: string;
    languageSubtitle: string;
    helperText: string;
  };
  live: {
    title: string;
    subtitle: string;
    sourceLabel: string;
    sourceHint: string;
    connectButton: string;
    disconnectButton: string;
    stateIdle: string;
    stateConnecting: string;
    stateConnected: string;
    stateClosing: string;
    stateDisconnected: string;
    stateError: string;
    streamHint: string;
    emptyFrame: string;
    loadingLabel: string;
    reloadButton: string;
    fullscreenButton: string;
    closeFullscreenButton: string;
    loadErrorTitle: string;
    loadErrorHint: string;
    offlineTitle: string;
    offlineHint: string;
    routeLabel: string;
    routeChecking: string;
    routeDirect: string;
    routeStun: string;
    routeTurn: string;
    modeLabel: string;
    modeAuto: string;
    modeStun: string;
    modeTurn: string;
    lastMessageLabel: string;
    lastMessageEmpty: string;
  };
  status: {
    title: string;
    subtitle: string;
    rows: Array<{ name: string; value: string; tone: "success" | "warning" | "neutral" }>;
    signaling: {
      title: string;
      subtitle: string;
      serverLabel: string;
      roomLabel: string;
      roleLabel: string;
      clientLabel: string;
      membersLabel: string;
      errorLabel: string;
      lastMessageLabel: string;
      lastMessageEmpty: string;
      connectButton: string;
      disconnectButton: string;
      stateIdle: string;
      stateConnecting: string;
      stateConnected: string;
      stateClosing: string;
      stateDisconnected: string;
      stateError: string;
    };
  };
  notes: {
    title: string;
    subtitle: (activeView: string) => string;
    paragraph: string;
    futureTitle: string;
    futureItems: string[];
  };
  waitingLabel: string;
};
