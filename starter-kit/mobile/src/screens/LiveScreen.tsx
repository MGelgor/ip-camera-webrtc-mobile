import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { RTCView } from "react-native-webrtc";
import { WebView } from "react-native-webview";
import type { WebView as WebViewType } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import type { IceServerConfig } from "../cameras";
import { Section } from "../components";
import { styles } from "../styles";
import type { AppCopy, Theme } from "../types";
import { useGo2RtcWebrtc } from "../webrtc/useGo2RtcWebrtc";

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
  signalingUrl: string;
  signalingAuthToken?: string | null;
  iceServers: IceServerConfig[];
  nativeWebRtcEnabled: boolean;
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
  signalingUrl,
  signalingAuthToken,
  iceServers,
  nativeWebRtcEnabled,
}: Props) {
  const webViewRef = useRef<WebViewType>(null);
  const fullscreenWebViewRef = useRef<WebViewType>(null);
  const gatewayFailureCount = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlayerLoadError, setHasPlayerLoadError] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isGatewayOffline, setIsGatewayOffline] = useState(false);
  const [iceRoute, setIceRoute] = useState<"checking" | "direct" | "stun" | "turn">("checking");
  const [useWebViewFallback, setUseWebViewFallback] = useState(!nativeWebRtcEnabled);
  const nativeWebRtc = useGo2RtcWebrtc({
    wsUrl: signalingUrl,
    streamName,
    authToken: signalingAuthToken,
    iceServers,
    enabled: nativeWebRtcEnabled,
  });
  const nativeStreamUrl = nativeWebRtc.remoteStreamUrl;
  const hasLoadError = hasPlayerLoadError || isGatewayOffline;

  function reloadPlayer() {
    setHasPlayerLoadError(false);
    setIsLoading(true);
    setIsGatewayOffline(false);
    gatewayFailureCount.current = 0;
    setIceRoute("checking");
    setUseWebViewFallback(!nativeWebRtcEnabled);
    if (nativeWebRtcEnabled) {
      nativeWebRtc.disconnect();
      setTimeout(nativeWebRtc.connect, 100);
    }
    webViewRef.current?.reload();
    fullscreenWebViewRef.current?.reload();
  }

  function handlePlayerMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        candidateType?: string;
      };
      if (message.type !== "ice-route") return;
      if (message.candidateType === "relay") setIceRoute("turn");
      else if (message.candidateType === "srflx" || message.candidateType === "prflx") setIceRoute("stun");
      else if (message.candidateType === "host") setIceRoute("direct");
    } catch {
      // Ignore messages that are not emitted by the player route reporter.
    }
  }

  const routeLabel =
    iceRoute === "turn"
      ? copy.routeTurn
      : iceRoute === "stun"
        ? copy.routeStun
        : iceRoute === "direct"
          ? copy.routeDirect
          : copy.routeChecking;

  useEffect(() => {
    if (!nativeWebRtcEnabled) {
      setUseWebViewFallback(true);
      return;
    }

    if (nativeStreamUrl) {
      setUseWebViewFallback(false);
      setIsLoading(false);
      setHasPlayerLoadError(false);
      return;
    }

    if (nativeWebRtc.status === "error") {
      setUseWebViewFallback(true);
      return;
    }

    const fallbackTimer = setTimeout(() => {
      setUseWebViewFallback(true);
    }, 12000);

    return () => clearTimeout(fallbackTimer);
  }, [nativeStreamUrl, nativeWebRtc.status, nativeWebRtcEnabled]);

  useEffect(() => {
    if (nativeWebRtcEnabled && useWebViewFallback) {
      nativeWebRtc.disconnect();
    }
  }, [nativeWebRtc.disconnect, nativeWebRtcEnabled, useWebViewFallback]);

  useEffect(() => {
    if (!useWebViewFallback) return;

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

        if (!cancelled && hasProducer) {
          gatewayFailureCount.current = 0;
          setIsGatewayOffline(false);
        } else if (!cancelled) {
          gatewayFailureCount.current += 1;
          if (gatewayFailureCount.current >= 3) {
            setIsGatewayOffline(true);
            setIsLoading(false);
          }
        }
      } catch {
        if (!cancelled) {
          gatewayFailureCount.current += 1;
          if (gatewayFailureCount.current >= 3) {
            setIsGatewayOffline(true);
            setIsLoading(false);
          }
        }
      }
    }

    checkGateway();
    const timer = setInterval(checkGateway, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [requestHeaders, streamName, streamStatusUrl, useWebViewFallback]);

  const nativeConnecting = nativeWebRtcEnabled && !useWebViewFallback && !nativeStreamUrl;
  const stateLabel = isGatewayOffline
    ? copy.stateError
    : nativeConnecting
      ? copy.stateConnecting
      : copy.stateConnected;
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
          {nativeStreamUrl ? (
            <RTCView
              streamURL={nativeStreamUrl}
              style={styles.liveVideo}
              objectFit="cover"
            />
          ) : useWebViewFallback && !isFullscreenOpen ? (
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
              onMessage={handlePlayerMessage}
              startInLoadingState
              onLoadStart={() => {
                setIsLoading(true);
                setHasPlayerLoadError(false);
                setIsGatewayOffline(false);
                gatewayFailureCount.current = 0;
              }}
              onLoadEnd={() => {
                setIsLoading(false);
              }}
              onError={() => {
                setIsLoading(false);
                setHasPlayerLoadError(true);
              }}
            />
          ) : null}

          {(!isLoading || nativeStreamUrl) && !hasLoadError ? (
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

          {(nativeConnecting || (useWebViewFallback && isLoading)) && !hasLoadError ? (
            <View style={styles.liveVideoOverlay}>
              <Text style={[styles.liveVideoPlaceholderText, { color: theme.text }]}>
                {copy.loadingLabel}
              </Text>
              <Text style={[styles.liveVideoPlaceholderHint, { color: theme.textSoft }]}>
                {copy.streamHint}
              </Text>
            </View>
          ) : null}

          {useWebViewFallback && hasLoadError ? (
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
          <Text style={[styles.signalLogLabel, { color: theme.textSoft }]}>{copy.routeLabel}</Text>
          <Text style={[styles.signalLogText, { color: iceRoute === "turn" ? theme.warning : theme.success }]}>
            {routeLabel}
          </Text>
          <Text style={[styles.signalLogText, { color: theme.textMuted }]}>
            {nativeStreamUrl ? signalingUrl : playerUrl}
          </Text>
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
            {nativeStreamUrl ? (
              <RTCView
                streamURL={nativeStreamUrl}
                style={styles.liveFullscreenVideo}
                objectFit="contain"
              />
            ) : useWebViewFallback ? (
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
                onMessage={handlePlayerMessage}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </Section>
  );
}
