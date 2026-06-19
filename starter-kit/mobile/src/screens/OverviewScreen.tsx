import React from "react";
import { Pressable, Text, View } from "react-native";
import { MetricCard, Section } from "../components";
import { styles } from "../styles";
import type { AppCopy, Theme } from "../types";
import type { CameraConfig } from "../cameras";

type Props = {
  copy: AppCopy["overview"];
  theme: Theme;
  contentTextStyle: object;
  isRTL: boolean;
  cameras: CameraConfig[];
  selectedCameraId: string;
  cameraCatalogState: "loading" | "ready" | "error";
  onSelectCamera: (camera: CameraConfig) => void;
  onOpenLive: () => void;
};

// Overview is the "big picture" screen.
// It explains the project state in a simple dashboard form.
export function OverviewScreen({
  copy,
  theme,
  contentTextStyle,
  isRTL,
  cameras,
  selectedCameraId,
  cameraCatalogState,
  onSelectCamera,
  onOpenLive,
}: Props) {
  return (
    <Section title={copy.title} subtitle={copy.subtitle} theme={theme} rtl={isRTL}>
      <View style={styles.cameraCatalogHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cameraCatalogTitle, { color: theme.text }, contentTextStyle]}>
            {copy.cameraListTitle}
          </Text>
          <Text style={[styles.cameraCatalogSubtitle, { color: theme.textMuted }, contentTextStyle]}>
            {copy.cameraListSubtitle}
          </Text>
        </View>
        <Text style={[styles.cameraCatalogState, { color: cameraCatalogState === "error" ? theme.danger : theme.success }]}>
          {cameraCatalogState === "loading"
            ? copy.cameraLoadingLabel
            : cameraCatalogState === "error"
              ? copy.cameraErrorLabel
              : `${cameras.length}`}
        </Text>
      </View>

      <View style={styles.cameraCatalogList}>
        {cameras.length === 0 ? (
          <Text style={[styles.cameraCatalogEmpty, { color: theme.textMuted }]}>{copy.cameraEmptyLabel}</Text>
        ) : (
          cameras.map((camera, index) => {
            const selected = camera.id === selectedCameraId;
            return (
              <Pressable
                key={camera.id}
                onPress={() => onSelectCamera(camera)}
                style={[
                  styles.cameraCatalogRow,
                  index < cameras.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 },
                  selected && { backgroundColor: theme.surfaceStrong },
                ]}
              >
                <View style={[styles.cameraSelectionDot, { borderColor: selected ? theme.accent : theme.border }]}>
                  {selected ? <View style={[styles.cameraSelectionDotInner, { backgroundColor: theme.accent }]} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cameraCatalogName, { color: theme.text }, contentTextStyle]}>{camera.name}</Text>
                  <Text style={[styles.cameraCatalogMeta, { color: theme.textMuted }, contentTextStyle]}>
                    {camera.location} · {camera.streamName}
                  </Text>
                </View>
                {selected ? (
                  <Text style={[styles.cameraSelectedText, { color: theme.accent }]}>{copy.cameraSelectedLabel}</Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </View>

      <Pressable onPress={onOpenLive} style={[styles.cameraLiveButton, { backgroundColor: theme.accent }]}>
        <Text style={styles.cameraLiveButtonText}>{copy.cameraLiveButton}</Text>
      </Pressable>

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
