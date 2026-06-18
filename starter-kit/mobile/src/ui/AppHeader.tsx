import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Badge, ProfileGlyph } from "../components";
import { styles } from "../styles";
import type { AppCopy, Theme, ViewKey } from "../types";

type AppHeaderProps = {
  copy: AppCopy;
  theme: Theme;
  contentTextStyle: object;
  profileOpen: boolean;
  setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setView: React.Dispatch<React.SetStateAction<ViewKey>>;
  brandSize: number;
  logoSize: number;
  profileSize: number;
  profileDockWidth: number;
  profileMenuTop: number;
};

// This component owns the top hero area:
// - brand/logo on the left
// - profile button on the right
// - the three-button profile menu that opens under the profile button
// - the hero title and three summary badges
export function AppHeader({
  copy,
  theme,
  contentTextStyle,
  profileOpen,
  setProfileOpen,
  setView,
  brandSize,
  logoSize,
  profileSize,
  profileDockWidth,
  profileMenuTop,
}: AppHeaderProps) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View
          style={[
            styles.brandMark,
            {
              width: brandSize,
              height: brandSize,
              backgroundColor: theme.surface,
              shadowColor: theme.shadow,
              borderColor: theme.border,
            },
          ]}
        >
          <Image
            source={require("../../assets/multitek-logo.png")}
            style={[styles.brandLogoImage, { width: logoSize, height: logoSize }]}
            resizeMode="contain"
          />
        </View>

        <View style={[styles.profileDock, { width: profileDockWidth }]}>
          <Pressable
            onPress={() => setProfileOpen((value) => !value)}
            style={[
              styles.profileButton,
              {
                width: profileSize,
                height: profileSize,
                backgroundColor: theme.surface,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
            hitSlop={14}
          >
            <ProfileGlyph theme={theme} />
          </Pressable>

          {profileOpen ? (
            <View
              style={[
                styles.profileMenu,
                {
                  position: "absolute",
                  top: profileMenuTop,
                  right: 0,
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                  width: profileDockWidth,
                },
              ]}
            >
              <View style={styles.profileMenuBar}>
                {/* Placeholder button: visible for the final design, not wired yet. */}
                <Pressable
                  disabled
                  style={[
                    styles.profileMenuItemButton,
                    { backgroundColor: theme.surfaceStrong, borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[styles.profileMenuItemText, { color: theme.textSoft }, contentTextStyle]}
                  >
                    {copy.profileMenu.about}
                  </Text>
                </Pressable>

                {/* Placeholder button: visible for the final design, not wired yet. */}
                <Pressable
                  disabled
                  style={[
                    styles.profileMenuItemButton,
                    { backgroundColor: theme.surfaceStrong, borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[styles.profileMenuItemText, { color: theme.textSoft }, contentTextStyle]}
                  >
                    {copy.profileMenu.profile}
                  </Text>
                </Pressable>

                {/* This is the only active menu item for now. It opens Settings. */}
                <Pressable
                  onPress={() => {
                    setView("settings");
                    setProfileOpen(false);
                  }}
                  style={[
                    styles.profileMenuItemButton,
                    { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}
                >
                  <Text
                    style={[styles.profileMenuItemText, { color: "#ffffff" }, contentTextStyle]}
                  >
                    {copy.profileMenu.settings}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.heroCopy}>
        <Text style={[styles.title, { color: theme.accent }, contentTextStyle]}>
          {copy.heroTitle}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }, contentTextStyle]}>
          {copy.heroSubtitle}
        </Text>
      </View>

      <View style={styles.heroMetaRow}>
        <Badge label={copy.badges.device.label} value={copy.badges.device.value} theme={theme} />
        <Badge label={copy.badges.camera.label} value={copy.badges.camera.value} theme={theme} />
        <Badge label={copy.badges.network.label} value={copy.badges.network.value} theme={theme} />
      </View>
    </View>
  );
}
