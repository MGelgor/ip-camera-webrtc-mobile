import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { styles } from "../styles";
import type { Theme } from "../types";

type Props = {
  theme: Theme;
  serverUrl: string;
  onLogin: (username: string, password: string) => Promise<void>;
};

export function LoginScreen({ theme, serverUrl, onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!username.trim() || !password) {
      setError("Kullanici adi ve parola zorunludur.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onLogin(username.trim(), password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Oturum acilamadi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.loginRoot, { backgroundColor: theme.background }]}
    >
      <View
        style={[
          styles.loginCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={[styles.loginBrand, { backgroundColor: theme.surfaceStrong }]}>
          <Image source={require("../../assets/multitek-logo.png")} style={styles.loginLogo} />
        </View>
        <Text style={[styles.loginTitle, { color: theme.text }]}>Kamera sistemine giris</Text>
        <Text style={[styles.loginSubtitle, { color: theme.textMuted }]}>
          Kamera katalogu ve canli yayin icin kisa omurlu guvenli oturum ac.
        </Text>

        <Text style={[styles.loginLabel, { color: theme.textSoft }]}>Kullanici adi</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSubmitting}
          placeholder="Kullanici adi"
          placeholderTextColor={theme.textSoft}
          style={[
            styles.loginInput,
            { color: theme.text, backgroundColor: theme.surfaceStrong, borderColor: theme.border },
          ]}
        />

        <Text style={[styles.loginLabel, { color: theme.textSoft }]}>Parola</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isSubmitting}
          placeholder="Parola"
          placeholderTextColor={theme.textSoft}
          onSubmitEditing={submit}
          style={[
            styles.loginInput,
            { color: theme.text, backgroundColor: theme.surfaceStrong, borderColor: theme.border },
          ]}
        />

        {error ? <Text style={[styles.loginError, { color: theme.danger }]}>{error}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={isSubmitting}
          style={[
            styles.loginButton,
            { backgroundColor: theme.accent, opacity: isSubmitting ? 0.65 : 1 },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>Giris yap</Text>
          )}
        </Pressable>

        <Text style={[styles.loginServer, { color: theme.textSoft }]} numberOfLines={2}>
          {serverUrl}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
