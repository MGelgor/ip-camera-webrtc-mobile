package com.multitek.mobileviewer;

final class SignalingSnapshot {
    final String status;
    final String serverUrl;
    final String room;
    final String role;
    final String name;
    final String clientId;
    final int members;
    final String lastEvent;
    final String lastError;

    SignalingSnapshot(
            String status,
            String serverUrl,
            String room,
            String role,
            String name,
            String clientId,
            int members,
            String lastEvent,
            String lastError
    ) {
        this.status = status;
        this.serverUrl = serverUrl;
        this.room = room;
        this.role = role;
        this.name = name;
        this.clientId = clientId;
        this.members = members;
        this.lastEvent = lastEvent;
        this.lastError = lastError;
    }
}
