import React from "react";
import { View } from "react-native";
import { Section, StatusRow } from "../components";
import { styles } from "../styles";
import type { AppCopy, Theme } from "../types";
import type { SignalingConnectionSnapshot } from "../types";
import { SignalingPanel } from "../signaling/SignalingPanel";

type Props = {
  copy: AppCopy["status"];
  theme: Theme;
  isRTL: boolean;
  signaling: SignalingConnectionSnapshot;
  onConnect: () => void;
  onDisconnect: () => void;
};

// Status is a simple table-like screen.
// It shows what is ready, waiting, or planned in a way that is easy to scan.
export function StatusScreen({ copy, theme, isRTL, signaling, onConnect, onDisconnect }: Props) {
  return (
    <>
      <SignalingPanel
        copy={copy.signaling}
        theme={theme}
        isRTL={isRTL}
        signaling={signaling}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />
      <Section title={copy.title} subtitle={copy.subtitle} theme={theme} rtl={isRTL}>
        <View style={styles.statusList}>
          {copy.rows.map((row) => (
            <StatusRow key={row.name} name={row.name} value={row.value} tone={row.tone} theme={theme} />
          ))}
        </View>
      </Section>
    </>
  );
}
