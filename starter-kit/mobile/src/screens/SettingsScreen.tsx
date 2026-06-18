import React from "react";
import { Pressable, Text, View } from "react-native";
import { Section } from "../components";
import { styles } from "../styles";
import type { AppCopy, LocaleMode, Theme, ThemeMode } from "../types";

type Props = {
  copy: AppCopy["settings"];
  theme: Theme;
  contentTextStyle: object;
  isRTL: boolean;
  themeMode: ThemeMode;
  setThemeMode: React.Dispatch<React.SetStateAction<ThemeMode>>;
  locale: LocaleMode;
  setLocale: React.Dispatch<React.SetStateAction<LocaleMode>>;
  modeLabels: AppCopy["modeLabels"];
  languageButtons: AppCopy["languageButtons"];
};

// Settings is intentionally small for now.
// Only appearance and language are active, which keeps the screen stable and easy to explain.
export function SettingsScreen({
  copy,
  theme,
  contentTextStyle,
  isRTL,
  themeMode,
  setThemeMode,
  locale,
  setLocale,
  modeLabels,
  languageButtons,
}: Props) {
  return (
    <Section title={copy.title} subtitle={copy.subtitle} theme={theme} rtl={isRTL}>
      <View style={styles.settingsGrid}>
        <View
          style={[
            styles.settingsPanel,
            {
              backgroundColor: theme.surfaceStrong,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.settingsPanelTitle, { color: theme.text }, contentTextStyle]}>
            {copy.appearanceTitle}
          </Text>
          <Text style={[styles.settingsPanelHint, { color: theme.textMuted }, contentTextStyle]}>
            {copy.appearanceSubtitle}
          </Text>
          <View style={styles.settingsChoiceRow}>
            {(["system", "light", "dark"] as ThemeMode[]).map((modeItem) => {
              const active = themeMode === modeItem;
              return (
                <Pressable
                  key={modeItem}
                  onPress={() => setThemeMode(modeItem)}
                  style={[
                    styles.tabButton,
                    styles.settingsChoiceButton,
                    {
                      backgroundColor: active ? theme.accent : theme.tabBackground,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.tabText, { color: active ? "#ffffff" : theme.textMuted }]}>
                    {modeLabels[modeItem]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.settingsPanel,
            {
              backgroundColor: theme.surfaceStrong,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.settingsPanelTitle, { color: theme.text }, contentTextStyle]}>
            {copy.languageTitle}
          </Text>
          <Text style={[styles.settingsPanelHint, { color: theme.textMuted }, contentTextStyle]}>
            {copy.languageSubtitle}
          </Text>
          <View style={styles.settingsChoiceRow}>
            {languageButtons.map((item) => {
              const active = locale === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setLocale(item.key)}
                  style={[
                    styles.tabButton,
                    styles.settingsChoiceButton,
                    styles.settingsChoiceButtonCompact,
                    {
                      backgroundColor: active ? theme.accent : theme.tabBackground,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      styles.settingsChoiceButtonTextCompact,
                      { color: active ? "#ffffff" : theme.textMuted },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.settingsHelper, { color: theme.textSoft }, contentTextStyle]}>
            {copy.helperText}
          </Text>
        </View>
      </View>
    </Section>
  );
}
