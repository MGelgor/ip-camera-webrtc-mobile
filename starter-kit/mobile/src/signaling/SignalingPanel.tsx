import React from "react";
import { Pressable, Text, View } from "react-native";
import { Section } from "../components";
import { styles } from "../styles";
import type { AppCopy, Theme } from "../types";
import type { SignalingConnectionSnapshot } from "../types";

type Props = {
  copy: AppCopy["status"]["signaling"];
  theme: Theme;
  isRTL: boolean;
  signaling: SignalingConnectionSnapshot;
  onConnect: () => void;
  onDisconnect: () => void;
};

function stateLabel(copy: AppCopy["status"]["signaling"], status: SignalingConnectionSnapshot["status"]) {
  switch (status) {
    case "connecting":
      return copy.stateConnecting;
    case "connected":
      return copy.stateConnected;
    case "closing":
      return copy.stateClosing;
    case "error":
      return copy.stateError;
    case "disconnected":
      return copy.stateDisconnected;
    case "idle":
    default:
      return copy.stateIdle;
  }
}

function stateTone(status: SignalingConnectionSnapshot["status"]): "success" | "warning" | "neutral" {
  if (status === "error") return "warning";
  if (status === "connected") return "success";
  if (status === "connecting" || status === "closing") return "warning";
  return "neutral";
}

// This panel is the first live link between the mobile app and the signaling server.
// It does not start WebRTC yet. It only proves that the app can reach the server,
// enter a room, and receive relayed messages.
export function SignalingPanel({
  copy,
  theme,
  isRTL,
  signaling,
  onConnect,
  onDisconnect,
}: Props) {
  const statusLabel = stateLabel(copy, signaling.status);
  const tone = stateTone(signaling.status);
  const toneColor =
    signaling.status === "error"
      ? theme.danger
      : tone === "success"
      ? theme.success
      : tone === "warning"
        ? theme.warning
        : theme.textSoft;

  return (
    <Section title={copy.title} subtitle={copy.subtitle} theme={theme} rtl={isRTL}>
      <View
        style={[
          styles.signalPanel,
          {
            backgroundColor: theme.surfaceStrong,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={styles.signalHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.signalPanelTitle, { color: theme.text }]}>{copy.serverLabel}</Text>
            <Text style={[styles.signalPanelHint, { color: theme.textMuted }]}>
              {signaling.serverUrl}
            </Text>
          </View>

          <View style={[styles.signalStatePill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.signalStateText, { color: toneColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.signalMetaGrid}>
          <View style={[styles.signalMetaItem, { borderColor: theme.border }]}>
            <Text style={[styles.signalMetaLabel, { color: theme.textSoft }]}>{copy.roomLabel}</Text>
            <Text style={[styles.signalMetaValue, { color: theme.text }]}>{signaling.room}</Text>
          </View>
          <View style={[styles.signalMetaItem, { borderColor: theme.border }]}>
            <Text style={[styles.signalMetaLabel, { color: theme.textSoft }]}>{copy.roleLabel}</Text>
            <Text style={[styles.signalMetaValue, { color: theme.text }]}>{signaling.role}</Text>
          </View>
          <View style={[styles.signalMetaItem, { borderColor: theme.border }]}>
            <Text style={[styles.signalMetaLabel, { color: theme.textSoft }]}>{copy.clientLabel}</Text>
            <Text style={[styles.signalMetaValue, { color: theme.text }]} numberOfLines={1}>
              {signaling.clientId ?? "—"}
            </Text>
          </View>
          <View style={[styles.signalMetaItem, { borderColor: theme.border }]}>
            <Text style={[styles.signalMetaLabel, { color: theme.textSoft }]}>{copy.membersLabel}</Text>
            <Text style={[styles.signalMetaValue, { color: theme.text }]}>{signaling.members}</Text>
          </View>
        </View>

        {signaling.lastError ? (
          <View style={[styles.signalErrorBox, { borderColor: theme.danger, backgroundColor: theme.surface }]}>
            <Text style={[styles.signalErrorTitle, { color: theme.danger }]}>{copy.errorLabel}</Text>
            <Text style={[styles.signalErrorText, { color: theme.text }]}>{signaling.lastError}</Text>
          </View>
        ) : null}

        <View style={styles.signalButtonRow}>
          <Pressable
            onPress={onConnect}
            style={[
              styles.signalButton,
              {
                backgroundColor: theme.accent,
                borderColor: theme.accent,
              },
            ]}
          >
            <Text style={[styles.signalButtonText, { color: "#ffffff" }]}>{copy.connectButton}</Text>
          </Pressable>
          <Pressable
            onPress={onDisconnect}
            style={[
              styles.signalButton,
              {
                backgroundColor: theme.tabBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.signalButtonText, { color: theme.text }]}>{copy.disconnectButton}</Text>
          </Pressable>
        </View>

        <View style={[styles.signalLogBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.signalLogLabel, { color: theme.textSoft }]}>{copy.lastMessageLabel}</Text>
          <Text style={[styles.signalLogText, { color: theme.text }]}>
            {signaling.lastEvent ? `${signaling.lastEvent.type} · ${signaling.lastEvent.summary}` : copy.lastMessageEmpty}
          </Text>
        </View>
      </View>
    </Section>
  );
}
