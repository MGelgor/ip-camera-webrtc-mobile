import React from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";
import type { AppCopy, Theme, ViewKey } from "../types";

type ViewTabsProps = {
  copy: AppCopy;
  theme: Theme;
  view: ViewKey;
  setView: React.Dispatch<React.SetStateAction<ViewKey>>;
};

// This is the row of main tabs under the hero:
// Overview, Setup, Status, Notes.
// It keeps the primary navigation predictable on every Android device.
export function ViewTabs({ copy, theme, view, setView }: ViewTabsProps) {
  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      {copy.views.map((item) => {
        const active = item.key === view;
        return (
          <Pressable
            key={item.key}
            onPress={() => setView(item.key)}
            style={[
              styles.tabButton,
              {
                backgroundColor: active ? theme.accent : theme.tabBackground,
                borderColor: active ? theme.accent : theme.border,
              },
            ]}
          >
            <Text style={[styles.tabText, { color: active ? "#ffffff" : theme.textMuted }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
