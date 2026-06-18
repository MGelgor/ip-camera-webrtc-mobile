import React from "react";
import { Text, View } from "react-native";
import { MetricCard, Section } from "../components";
import { styles } from "../styles";
import type { AppCopy, Theme } from "../types";

type Props = {
  copy: AppCopy["overview"];
  theme: Theme;
  contentTextStyle: object;
  isRTL: boolean;
};

// Overview is the "big picture" screen.
// It explains the project state in a simple dashboard form.
export function OverviewScreen({ copy, theme, contentTextStyle, isRTL }: Props) {
  return (
    <Section title={copy.title} subtitle={copy.subtitle} theme={theme} rtl={isRTL}>
      <View style={styles.metricGrid}>
        <MetricCard title={copy.ready.title} value={copy.ready.value} accent={theme.accent} theme={theme} />
        <MetricCard title={copy.pending.title} value={copy.pending.value} accent={theme.warning} theme={theme} />
        <MetricCard title={copy.final.title} value={copy.final.value} accent={theme.success} theme={theme} />
      </View>

      <View style={styles.roadmap}>
        {copy.roadmap.map((item, index) => (
          <View
            key={item}
            style={[
              styles.roadmapRow,
              index < copy.roadmap.length - 1 && {
                borderBottomWidth: 0.5,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <View style={[styles.stepPill, { backgroundColor: theme.accent }]}>
              <Text style={styles.stepPillText}>{index + 1}</Text>
            </View>
            <Text style={[styles.roadmapText, { color: theme.text }, contentTextStyle]}>
              {item}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}
