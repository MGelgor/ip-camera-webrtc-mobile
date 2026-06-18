import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { WebView as WebViewType } from "react-native-webview";
import { Section } from "../components";
import { styles } from "../styles";
import type { AppCopy, Theme } from "../types";

type Props = {
  copy: AppCopy["live"];
  theme: Theme;
  isRTL: boolean;
  playerUrl: string;
  streamStatusUrl: string;
  streamName: string;
  cameraName: string;
  cameraLocation: string;
  requestHeaders?: Record<string, string>;
};

// This is the first stable media screen.
// Instead of opening the RTSP address inside the app, it loads go2rtc's player.
// Flow:
// 1) Camera sends RTSP to go2rtc.
// 2) go2rtc converts that stream into browser-friendly playback.
// 3) The mobile app shows that player inside a WebView.
export function LiveScreen({
  copy,
  theme,
  isRTL,
  playerUrl,
  streamStatusUrl,
  streamName,
  cameraName,
  cameraLocation,
  requestHeaders,
}: Props) {
  const webViewRef = useRef<WebViewType>(null);
  const fullscreenWebViewRef = useRef<WebViewType>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isGatewayOffline, setIsGatewayOffline] = useState(false);

  function reloadPlayer() {
    setHasLoadError(false);
    setIsLoading(true);
    setIsGatewayOffline(false);
    webViewRef.current?.reload();
    fullscreenWebViewRef.current?.reload();
  }

  useEffect(() => {
    let cancelled = false;

    async function checkGateway() {
      try {
        const response = await fetch(streamStatusUrl, {
          headers: requestHeaders,
        });
        if (!response.ok) {
          throw new Error(`Gateway status request failed: ${response.status}`);
        }

        const payload = (await response.json()) as Record<
          string,
          { producers?: unknown[]; consumers?: unknown[] } | undefined
        >;

        const stream = payload[streamName];
        const hasProducer = Array.isArray(stream?.producers) && stream!.producers!.length > 0;

        if (!cancelled) {
          const offline = !hasProducer;
          setIsGatewayOffline(offline);
          if (offline) {
            setHasLoadError(true);
            setIsLoading(false);
          }
        }
      } catch {
        if (!cancelled) {
          setIsGatewayOffline(true);
          setHasLoadError(true);
          setIsLoading(false);
        }
      }
    }

    checkGateway();
    const timer = setInterval(checkGateway, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [streamName, streamStatusUrl]);

  const stateLabel = isGatewayOffline ? copy.stateError : copy.stateConnected;
  const stateColor = isGatewayOffline ? theme.danger : theme.accent;

  return (
    <Section title={copy.title} subtitle={copy.subtitle} theme={theme} rtl={isRTL}>
      <View
        style={[
          styles.livePanel,
          {
            backgroundColor: theme.surfaceStrong,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={styles.liveHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.livePanelTitle, { color: theme.text }]}>{copy.sourceLabel}</Text>
            <Text style={[styles.livePanelHint, { color: theme.textMuted }]}>{copy.sourceHint}</Text>
          </View>

          <View style={[styles.liveStatePill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.liveStateText, { color: stateColor }]}>{stateLabel}</Text>
          </View>
        </View>

        <View style={[styles.liveVideoFrame, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <WebView
            ref={webViewRef}
            source={{ uri: playerUrl, headers: requestHeaders }}
            style={styles.liveVideo}
            allowsInlineMediaPlayback
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            mixedContentMode="always"
            originWhitelist={["*"]}
            startInLoadingState
            onLoadStart={() => {
              setIsLoading(true);
              setHasLoadError(false);
              setIsGatewayOffline(false);
            }}
            onLoadEnd={() => {
              setIsLoading(false);
            }}
            onError={() => {
              setIsLoading(false);
              setHasLoadError(true);
            }}
          />

          {!isLoading && !hasLoadError ? (
            <Pressable
              onPress={() => setIsFullscreenOpen(true)}
              style={[
                styles.liveInlineFullscreenButton,
                {
                  backgroundColor: "rgba(5,7,13,0.72)",
                  borderColor: "rgba(255,255,255,0.2)",
                },
              ]}
            >
              <Text style={styles.liveInlineFullscreenText}>{copy.fullscreenButton}</Text>
            </Pressable>
          ) : null}

          {isLoading ? (
            <View style={styles.liveVideoOverlay}>
              <Text style={[styles.liveVideoPlaceholderText, { color: theme.text }]}>
                {copy.loadingLabel}
              </Text>
              <Text style={[styles.liveVideoPlaceholderHint, { color: theme.textSoft }]}>
                {copy.streamHint}
              </Text>
            </View>
          ) : null}

          {hasLoadError ? (
            <View style={styles.liveVideoOverlay}>
              <Text style={[styles.liveVideoPlaceholderText, { color: theme.danger }]}>
                {isGatewayOffline ? copy.offlineTitle : copy.loadErrorTitle}
              </Text>
              <Text style={[styles.liveVideoPlaceholderHint, { color: theme.textSoft }]}>
                {isGatewayOffline ? copy.offlineHint : copy.loadErrorHint}
              </Text>
              <Pressable
                onPress={reloadPlayer}
                style={[
                  styles.liveReloadButton,
                  {
                    backgroundColor: theme.accent,
                    borderColor: theme.accent,
                  },
                ]}
              >
                <Text style={styles.liveReloadButtonText}>{copy.reloadButton}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.liveActionRow}>
          <Pressable
            onPress={() => setIsFullscreenOpen(true)}
            style={[
              styles.liveActionButton,
              {
                backgroundColor: theme.accent,
                borderColor: theme.accent,
              },
            ]}
          >
            <Text style={styles.liveActionButtonText}>{copy.fullscreenButton}</Text>
          </Pressable>

          <Pressable
            onPress={reloadPlayer}
            style={[
              styles.liveActionButton,
              {
                backgroundColor: theme.tabBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.liveActionButtonText, { color: theme.text }]}>{copy.reloadButton}</Text>
          </Pressable>
        </View>

        <View style={[styles.signalLogBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.signalLogLabel, { color: theme.textSoft }]}>{copy.sourceLabel}</Text>
          <Text style={[styles.signalLogText, { color: theme.text }]}>{cameraName}</Text>
          <Text style={[styles.signalLogText, { color: theme.textMuted }]}>{cameraLocation}</Text>
          <Text style={[styles.signalLogText, { color: theme.text }]}>go2rtc stream: {streamName}</Text>
          <Text style={[styles.signalLogText, { color: theme.textMuted }]}>{playerUrl}</Text>
        </View>
      </View>

      <Modal
        visible={isFullscreenOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFullscreenOpen(false)}
      >
        <View style={styles.liveFullscreenRoot}>
          <View style={[styles.liveFullscreenHeader, { borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.liveFullscreenTitle, { color: "#ffffff" }]}>{cameraName}</Text>
              <Text style={[styles.liveFullscreenSubtitle, { color: "rgba(255,255,255,0.72)" }]}>
                {cameraLocation}
              </Text>
            </View>

            <Pressable
              onPress={() => setIsFullscreenOpen(false)}
              style={[styles.liveFullscreenCloseButton, { borderColor: "rgba(255,255,255,0.24)" }]}
            >
              <Text style={styles.liveFullscreenCloseText}>{copy.closeFullscreenButton}</Text>
            </Pressable>
          </View>

          <View style={styles.liveFullscreenVideoWrap}>
            <WebView
              ref={fullscreenWebViewRef}
              source={{ uri: playerUrl, headers: requestHeaders }}
              style={styles.liveFullscreenVideo}
              allowsInlineMediaPlayback
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={false}
              mixedContentMode="always"
              originWhitelist={["*"]}
            />
          </View>
        </View>
      </Modal>
    </Section>
  );
}
