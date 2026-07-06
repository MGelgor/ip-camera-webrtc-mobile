package com.multitek.mobileviewer;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

final class SignalingClient {
    interface Listener {
        void onSnapshot(SignalingSnapshot snapshot);
    }

    private final OkHttpClient httpClient;
    private final Listener listener;
    private WebSocket socket;
    private String url;
    private String room;
    private String role;
    private String name;
    private String authToken;
    private String clientId;
    private int members;
    private boolean closingByUser;

    SignalingClient(OkHttpClient httpClient, Listener listener) {
        this.httpClient = httpClient;
        this.listener = listener;
    }

    void connect(String url, String room, String role, String name, String authToken) {
        if (socket != null) return;
        this.url = url;
        this.room = room;
        this.role = role;
        this.name = name;
        this.authToken = authToken;
        this.closingByUser = false;
        emit("connecting", "Baglanti deneniyor: " + url, null);

        Request.Builder request = new Request.Builder().url(url);
        if (authToken != null && !authToken.isEmpty()) {
            request.header("Authorization", "Bearer " + authToken);
        }

        socket = httpClient.newWebSocket(request.build(), new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                JSONObject join = new JSONObject();
                try {
                    join.put("type", "join");
                    join.put("room", room);
                    join.put("role", role);
                    join.put("name", name);
                    webSocket.send(join.toString());
                    emit("connected", "join gonderildi", null);
                } catch (JSONException error) {
                    emit("error", "Join mesaji hazirlanamadi.", "Join mesaji hazirlanamadi.");
                }
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                handleMessage(text);
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                socket = null;
                emit("error", "WebSocket baglantisi kurulamadi.", "WebSocket baglantisi kurulamadi.");
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                socket = null;
                emit(closingByUser ? "disconnected" : "idle", "Baglanti kapandi: " + code, null);
            }
        });
    }

    void disconnect() {
        closingByUser = true;
        if (socket != null) {
            socket.close(1000, "Kullanici baglantiyi kapatti.");
            socket = null;
        }
        members = 0;
        emit("disconnected", "Kullanici baglantiyi kapatti.", null);
    }

    private void handleMessage(String text) {
        try {
            JSONObject json = new JSONObject(text);
            String type = json.optString("type", "message");
            if ("connected".equals(type)) {
                clientId = json.optString("clientId", clientId);
            } else if ("joined".equals(type)) {
                room = json.optString("room", room);
                clientId = json.optString("clientId", clientId);
                JSONArray memberArray = json.optJSONArray("members");
                if (memberArray != null) members = memberArray.length();
            } else if ("peer-joined".equals(type)) {
                members += 1;
            } else if ("peer-left".equals(type)) {
                members = Math.max(0, members - 1);
            } else if ("left".equals(type)) {
                members = 0;
            } else if ("error".equals(type)) {
                emit("error", text, json.optString("message", "WebSocket hata verdi."));
                return;
            }
            emit("connected", type + ": " + summarize(text), null);
        } catch (JSONException error) {
            emit("connected", "raw: " + summarize(text), null);
        }
    }

    private void emit(String status, String event, String error) {
        listener.onSnapshot(new SignalingSnapshot(
                status,
                url,
                room,
                role,
                name,
                clientId,
                members,
                event,
                error
        ));
    }

    private String summarize(String value) {
        if (value == null) return "";
        return value.length() > 160 ? value.substring(0, 157) + "..." : value;
    }
}
