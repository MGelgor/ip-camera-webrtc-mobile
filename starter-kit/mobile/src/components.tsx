import React from "react";
import { Text, View, Pressable } from "react-native";
import { Theme } from "./types";
import { styles } from "./styles";

export function Badge({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: Theme;
}) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: theme.surfaceStrong,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.badgeLabel, { color: theme.textSoft }]}>{label}</Text>
      <Text style={[styles.badgeValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

export function Section({
  title,
  subtitle,
  theme,
  rtl = false,
  children,
}: {
  title: string;
  subtitle: string;
  theme: Theme;
  rtl?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.accent },
              rtl ? styles.textRTL : styles.textLTR,
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.sectionSubtitle,
              { color: theme.textMuted },
              rtl ? styles.textRTL : styles.textLTR,
            ]}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

export function MetricCard({
  title,
  value,
  accent,
  theme,
}: {
  title: string;
  value: string;
  accent: string;
  theme: Theme;
}) {
  return (
    <View
      style={[
        styles.metricCard,
        {
          backgroundColor: theme.surfaceStrong,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <Text style={[styles.metricLabel, { color: theme.textSoft }]}>{title}</Text>
      <Text style={[styles.metricValue, { color: theme.accent }]}>{value}</Text>
    </View>
  );
}

export function StatusRow({
  name,
  value,
  tone,
  theme,
}: {
  name: string;
  value: string;
  tone: "success" | "warning" | "neutral";
  theme: Theme;
}) {
  const toneColor =
    tone === "success"
      ? theme.success
      : tone === "warning"
        ? theme.warning
        : theme.textSoft;

  return (
    <View
      style={[
        styles.statusRow,
        {
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.statusName, { color: theme.text }]}>{name}</Text>
      <Text style={[styles.statusValue, { color: toneColor }]}>{value}</Text>
    </View>
  );
}

export function ProfileGlyph({ theme }: { theme: Theme }) {
  return (
    <View style={styles.profileGlyph}>
      <View style={[styles.profileHead, { backgroundColor: theme.accent }]} />
      <View style={[styles.profileShoulders, { borderColor: theme.accent }]} />
    </View>
  );
}

export function ProfileMenuButton({
  label,
  active,
  theme,
  onPress,
}: {
  label: string;
  active?: boolean;
  theme: Theme;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.profileMenuItemButton,
        {
          backgroundColor: active ? theme.accent : theme.surfaceStrong,
          borderColor: active ? theme.accent : theme.border,
        },
      ]}
    >
      <Text
        style={[
          styles.profileMenuItemText,
          { color: active ? "#ffffff" : theme.textSoft },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
