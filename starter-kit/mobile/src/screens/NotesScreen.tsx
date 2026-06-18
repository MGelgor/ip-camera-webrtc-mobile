import React from "react";
import { Text, View } from "react-native";
import { Section } from "../components";
import { styles } from "../styles";
import type { AppCopy, Theme } from "../types";

type Props = {
  copy: AppCopy["notes"];
  theme: Theme;
  contentTextStyle: object;
  paragraphText: object | null;
  activeViewLabel: string;
  isRTL: boolean;
};

// Notes is a text-heavy screen for future work and implementation reminders.
export function NotesScreen({
  copy,
  theme,
  contentTextStyle,
  paragraphText,
  activeViewLabel,
  isRTL,
}: Props) {
  return (
    <Section title={copy.title} subtitle={copy.subtitle(activeViewLabel)} theme={theme} rtl={isRTL}>
      <Text style={[styles.longText, { color: theme.textMuted }, paragraphText ?? undefined]}>
        {copy.paragraph}
      </Text>

      <View style={[styles.noteBox, { borderColor: theme.border }]}>
        <Text style={[styles.noteBoxTitle, { color: theme.text }, contentTextStyle]}>
          {copy.futureTitle}
        </Text>
        <Text style={[styles.noteBoxText, { color: theme.textMuted }, contentTextStyle]}>
          {copy.futureItems.map((item) => `- ${item}`).join("\n")}
        </Text>
      </View>
    </Section>
  );
}
