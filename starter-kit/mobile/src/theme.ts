import type { ColorSchemeName } from "react-native";
import { Theme } from "./types";

export const LIGHT_THEME: Theme = {
  background: "#f4f7fb",
  surface: "#ffffff",
  surfaceStrong: "#eef3fb",
  surfaceMuted: "#f7f9fd",
  border: "#d6deea",
  text: "#0b1320",
  textMuted: "#526175",
  textSoft: "#6d7c90",
  accent: "#b91c1c",
  accent2: "#ef4444",
  success: "#118a58",
  warning: "#b7791f",
  danger: "#d64545",
  shadow: "rgba(12, 24, 48, 0.12)",
  tabBackground: "#fbeaec",
};

export const DARK_THEME: Theme = {
  background: "#08111f",
  surface: "#0f172a",
  surfaceStrong: "#111c33",
  surfaceMuted: "#09111f",
  border: "#1e293b",
  text: "#f8fbff",
  textMuted: "#c8d3e2",
  textSoft: "#8ea0b6",
  accent: "#ef4444",
  accent2: "#fb7185",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  shadow: "rgba(0, 0, 0, 0.35)",
  tabBackground: "#2a1214",
};

export function resolveTheme(
  mode: "system" | "light" | "dark",
  scheme: ColorSchemeName,
) {
  if (mode === "light") return LIGHT_THEME;
  if (mode === "dark") return DARK_THEME;
  return scheme === "dark" ? DARK_THEME : LIGHT_THEME;
}
