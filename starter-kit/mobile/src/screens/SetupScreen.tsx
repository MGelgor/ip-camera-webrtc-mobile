import React from "react";
import { Text, View } from "react-native";
import { Section } from "../components";
import { styles } from "../styles";
import type { AppCopy, Theme } from "../types";

type Props = {
  copy: AppCopy["setup"];
  theme: Theme;
  contentTextStyle: object;
  isRTL: boolean;
};

// Setup contains the work list that can be prepared before real camera data exists.
export function SetupScreen({ copy, theme, contentTextStyle, isRTL }: Props) {
  return (
    <Section title={copy.title} subtitle={copy.subtitle} theme={theme} rtl={isRTL}>
      {copy.checklist.map((item, index) => (
        <View
          key={item.title}
          style={[
            styles.checkRow,
            index < copy.checklist.length - 1 && {
              borderBottomWidth: 0.5,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <View style={[styles.checkIndex, { backgroundColor: theme.accent }]}>
            <Text style={styles.checkIndexText}>{index + 1}</Text>
          </View>
          <View style={styles.checkCopy}>
            <Text style={[styles.checkTitle, { color: theme.text }, contentTextStyle]}>
              {item.title}
            </Text>
            <Text style={[styles.checkDetail, { color: theme.textMuted }, contentTextStyle]}>
              {item.detail}
            </Text>
          </View>
        </View>
      ))}
    </Section>
  );
}
