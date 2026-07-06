package com.multitek.mobileviewer;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.Headers;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

final class ApiClient {
    interface Result<T> {
        void onSuccess(T value);

        void onError(String message);
    }

    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");
    private final OkHttpClient httpClient;
    private final String signalingUrl;

    ApiClient(String signalingUrl) {
        this.signalingUrl = signalingUrl;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .build();
    }

    OkHttpClient httpClient() {
        return httpClient;
    }

    String signalingUrl() {
        return signalingUrl;
    }

    String httpBase() {
        return signalingHttpBase(signalingUrl);
    }

    static String signalingHttpBase(String signalingUrl) {
        String base = signalingUrl;
        if (base.startsWith("wss://")) {
            base = "https://" + base.substring("wss://".length());
        } else if (base.startsWith("ws://")) {
            base = "http://" + base.substring("ws://".length());
        }
        if (base.endsWith("/ws")) {
            base = base.substring(0, base.length() - 3);
        }
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base;
    }

    void login(String username, String password, Result<SignalingSession> result) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("username", username);
            payload.put("password", password);
        } catch (JSONException error) {
            result.onError("Giris bilgileri hazirlanamadi.");
            return;
        }

        Request request = new Request.Builder()
                .url(httpBase() + "/auth/login")
                .post(RequestBody.create(payload.toString(), JSON))
                .header("Content-Type", "application/json")
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                result.onError("Signaling sunucusuna erisilemedi. Sunucu adresini ve port forwarding'i kontrol et.");
            }

            @Override
            public void onResponse(Call call, Response response) {
                try (Response ignored = response) {
                    String body = response.body() == null ? "{}" : response.body().string();
                    JSONObject json = new JSONObject(body);
                    String token = json.optString("accessToken", "");
                    long expiresIn = json.optLong("expiresIn", 0);
                    if (!response.isSuccessful() || token.isEmpty() || expiresIn <= 0) {
                        if (response.code() == 401) {
                            result.onError("Kullanici adi veya parola hatali.");
                        } else if (response.code() == 429) {
                            result.onError("Cok fazla giris denemesi yapildi. Bir sure bekleyip tekrar dene.");
                        } else {
                            result.onError(json.optString("error", "Oturum acilamadi."));
                        }
                        return;
                    }
                    result.onSuccess(new SignalingSession(token, System.currentTimeMillis() + expiresIn * 1000L));
                } catch (IOException | JSONException error) {
                    result.onError("Oturum yaniti okunamadi.");
                }
            }
        });
    }

    void fetchCameras(String authToken, Result<List<CameraConfig>> result) {
        Request.Builder builder = new Request.Builder().url(httpBase() + "/cameras");
        if (authToken != null && !authToken.isEmpty()) {
            builder.header("Authorization", "Bearer " + authToken);
        }

        httpClient.newCall(builder.build()).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                result.onError("Kamera katalogu alinamadi.");
            }

            @Override
            public void onResponse(Call call, Response response) {
                try (Response ignored = response) {
                    if (!response.isSuccessful()) {
                        result.onError("Kamera katalogu alinamadi: " + response.code());
                        return;
                    }
                    String body = response.body() == null ? "{}" : response.body().string();
                    JSONObject json = new JSONObject(body);
                    JSONArray cameraArray = json.optJSONArray("cameras");
                    if (cameraArray == null || cameraArray.length() == 0) {
                        result.onSuccess(Collections.singletonList(CameraConfig.fallback()));
                        return;
                    }
                    result.onSuccess(parseCameras(cameraArray));
                } catch (IOException | JSONException error) {
                    result.onError("Kamera katalogu okunamadi.");
                }
            }
        });
    }

    void checkGateway(CameraConfig camera, String authToken, Result<Boolean> result) {
        String url = streamStatusUrl(camera);
        Request.Builder builder = new Request.Builder().url(url);
        if (authToken != null && !authToken.isEmpty()) {
            builder.header("Authorization", "Bearer " + authToken);
        }

        httpClient.newCall(builder.build()).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                result.onError("Gateway durumuna erisilemedi.");
            }

            @Override
            public void onResponse(Call call, Response response) {
                try (Response ignored = response) {
                    if (!response.isSuccessful()) {
                        result.onError("Gateway durum kodu: " + response.code());
                        return;
                    }
                    String body = response.body() == null ? "{}" : response.body().string();
                    JSONObject json = new JSONObject(body);
                    JSONObject stream = json.optJSONObject(camera.streamName);
                    JSONArray producers = stream == null ? null : stream.optJSONArray("producers");
                    result.onSuccess(producers != null && producers.length() > 0);
                } catch (IOException | JSONException error) {
                    result.onError("Gateway yaniti okunamadi.");
                }
            }
        });
    }

    String playerUrl(CameraConfig camera) {
        if (camera.playerUrl != null && !camera.playerUrl.isEmpty()) return camera.playerUrl;
        return httpBase() + "/player?src=" + urlEncode(camera.streamName);
    }

    String streamStatusUrl(CameraConfig camera) {
        if (camera.streamStatusUrl != null && !camera.streamStatusUrl.isEmpty()) return camera.streamStatusUrl;
        return httpBase() + "/gateway/status?src=" + urlEncode(camera.streamName);
    }

    Headers authHeaders(String authToken) {
        Headers.Builder builder = new Headers.Builder();
        if (authToken != null && !authToken.isEmpty()) {
            builder.add("Authorization", "Bearer " + authToken);
        }
        return builder.build();
    }

    private List<CameraConfig> parseCameras(JSONArray cameraArray) throws JSONException {
        List<CameraConfig> cameras = new ArrayList<>();
        CameraConfig fallback = CameraConfig.fallback();
        for (int index = 0; index < cameraArray.length(); index++) {
            JSONObject camera = cameraArray.optJSONObject(index);
            if (camera == null || camera.optString("streamName", "").isEmpty()) continue;

            List<IceServerConfig> iceServers = parseIceServers(camera.optJSONArray("iceServers"));
            cameras.add(new CameraConfig(
                    camera.optString("id", "camera-" + (index + 1)),
                    camera.optString("name", fallback.name),
                    camera.optString("location", fallback.location),
                    camera.optString("streamName"),
                    resolvePath(camera.optString("playerPath", "")),
                    resolvePath(camera.optString("streamStatusPath", "")),
                    iceServers.isEmpty() ? fallback.iceServers : iceServers
            ));
        }
        if (cameras.isEmpty()) cameras.add(fallback);
        return cameras;
    }

    private List<IceServerConfig> parseIceServers(JSONArray array) throws JSONException {
        List<IceServerConfig> servers = new ArrayList<>();
        if (array == null) return servers;
        for (int i = 0; i < array.length(); i++) {
            JSONObject server = array.optJSONObject(i);
            if (server == null) continue;
            JSONArray urlsArray = server.optJSONArray("urls");
            if (urlsArray == null || urlsArray.length() == 0) continue;
            List<String> urls = new ArrayList<>();
            for (int urlIndex = 0; urlIndex < urlsArray.length(); urlIndex++) {
                String url = urlsArray.optString(urlIndex, "");
                if (!url.isEmpty()) urls.add(url);
            }
            if (!urls.isEmpty()) {
                servers.add(new IceServerConfig(
                        urls,
                        server.optString("username", null),
                        server.optString("credential", null)
                ));
            }
        }
        return servers;
    }

    private String resolvePath(String path) {
        if (path == null || path.isEmpty()) return null;
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        try {
            URI base = new URI(httpBase() + "/");
            return base.resolve(path).toString();
        } catch (URISyntaxException error) {
            return null;
        }
    }

    private static String urlEncode(String raw) {
        return raw.replace(" ", "%20");
    }
}
