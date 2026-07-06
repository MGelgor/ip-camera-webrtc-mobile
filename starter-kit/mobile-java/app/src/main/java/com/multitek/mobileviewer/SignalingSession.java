package com.multitek.mobileviewer;

final class SignalingSession {
    final String accessToken;
    final long expiresAtMs;

    SignalingSession(String accessToken, long expiresAtMs) {
        this.accessToken = accessToken;
        this.expiresAtMs = expiresAtMs;
    }
}
