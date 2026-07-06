package com.multitek.mobileviewer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class MainActivity extends Activity {
    private static final int GREEN = Color.rgb(31, 157, 106);
    private static final int INK = Color.rgb(21, 34, 28);
    private static final int MUTED = Color.rgb(91, 105, 98);
    private static final int BACKGROUND = Color.rgb(244, 247, 245);
    private static final int SURFACE = Color.WHITE;
    private static final int SURFACE_STRONG = Color.rgb(235, 242, 238);
    private static final int BORDER = Color.rgb(210, 221, 215);
    private static final int DANGER = Color.rgb(192, 57, 43);

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Button> tabButtons = new ArrayList<>();
    private ApiClient apiClient;
    private SignalingClient signalingClient;
    private SignalingSnapshot signalingSnapshot;
    private String sessionToken;
    private long sessionExpiresAtMs;
    private List<CameraConfig> cameras = new ArrayList<>();
    private CameraConfig selectedCamera = CameraConfig.fallback();
    private LinearLayout root;
    private LinearLayout content;
    private String activeView = "overview";
    private String iceMode = "auto";
    private int gatewayFailureCount;
    private WebView liveWebView;
    private final Runnable expireSessionRunnable = this::logout;
    private final Runnable gatewayChecker = new Runnable() {
        @Override
        public void run() {
            checkGatewayStatus();
            handler.postDelayed(this, 3000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        apiClient = new ApiClient(BuildConfig.SIGNALING_URL);
        cameras.add(selectedCamera);
        signalingSnapshot = new SignalingSnapshot(
                "idle",
                apiClient.signalingUrl(),
                selectedCamera.streamName,
                "viewer",
                "mobile-viewer-java",
                null,
                0,
                "Hazir.",
                null
        );
        signalingClient = new SignalingClient(apiClient.httpClient(), snapshot ->
                runOnUiThread(() -> {
                    signalingSnapshot = snapshot;
                    if ("status".equals(activeView)) renderActiveView();
                })
        );
        showLogin();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (signalingClient != null) signalingClient.disconnect();
        destroyLiveWebView();
        super.onDestroy();
    }

    private void showLogin() {
        handler.removeCallbacks(gatewayChecker);
        destroyLiveWebView();

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BACKGROUND);

        LinearLayout shell = column();
        shell.setGravity(Gravity.CENTER);
        shell.setPadding(dp(22), dp(30), dp(22), dp(30));
        scroll.addView(shell, matchWrap());

        LinearLayout card = column();
        card.setPadding(dp(22), dp(22), dp(22), dp(20));
        card.setBackground(card(SURFACE, BORDER, dp(8)));
        shell.addView(card, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        ImageView logo = new ImageView(this);
        logo.setImageResource(getResources().getIdentifier("multitek_logo", "drawable", getPackageName()));
        logo.setAdjustViewBounds(true);
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(112), dp(64));
        logoParams.gravity = Gravity.CENTER_HORIZONTAL;
        card.addView(logo, logoParams);

        TextView title = title("Kamera sistemine giris", 24);
        title.setGravity(Gravity.CENTER);
        card.addView(title, topMargin(dp(18)));

        TextView subtitle = body("Kamera katalogu ve canli yayin icin kisa omurlu guvenli oturum ac.");
        subtitle.setGravity(Gravity.CENTER);
        card.addView(subtitle, topMargin(dp(8)));

        TextView userLabel = label("Kullanici adi");
        card.addView(userLabel, topMargin(dp(22)));
        EditText username = input("Kullanici adi", false);
        card.addView(username, topMargin(dp(6)));

        TextView passLabel = label("Parola");
        card.addView(passLabel, topMargin(dp(14)));
        EditText password = input("Parola", true);
        card.addView(password, topMargin(dp(6)));

        TextView errorText = body("");
        errorText.setTextColor(DANGER);
        errorText.setVisibility(View.GONE);
        card.addView(errorText, topMargin(dp(10)));

        Button loginButton = primaryButton("Giris yap");
        ProgressBar progress = new ProgressBar(this);
        progress.setVisibility(View.GONE);

        card.addView(loginButton, topMargin(dp(18)));
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(dp(34), dp(34));
        progressParams.gravity = Gravity.CENTER_HORIZONTAL;
        progressParams.topMargin = dp(14);
        card.addView(progress, progressParams);

        TextView server = small(apiClient.signalingUrl());
        server.setGravity(Gravity.CENTER);
        card.addView(server, topMargin(dp(14)));

        View.OnClickListener submit = view -> {
            String user = username.getText().toString().trim();
            String pass = password.getText().toString();
            if (user.isEmpty() || pass.isEmpty()) {
                errorText.setText("Kullanici adi ve parola zorunludur.");
                errorText.setVisibility(View.VISIBLE);
                return;
            }
            errorText.setVisibility(View.GONE);
            loginButton.setEnabled(false);
            progress.setVisibility(View.VISIBLE);
            apiClient.login(user, pass, new ApiClient.Result<SignalingSession>() {
                @Override
                public void onSuccess(SignalingSession value) {
                    runOnUiThread(() -> {
                        sessionToken = value.accessToken;
                        sessionExpiresAtMs = value.expiresAtMs;
                        scheduleSessionExpiry();
                        loadRuntimeCameras();
                    });
                }

                @Override
                public void onError(String message) {
                    runOnUiThread(() -> {
                        loginButton.setEnabled(true);
                        progress.setVisibility(View.GONE);
                        errorText.setText(message);
                        errorText.setVisibility(View.VISIBLE);
                    });
                }
            });
        };
        loginButton.setOnClickListener(submit);
        password.setOnEditorActionListener((view, actionId, event) -> {
            submit.onClick(view);
            return true;
        });

        setContentView(scroll);
    }

    private void loadRuntimeCameras() {
        apiClient.fetchCameras(sessionToken, new ApiClient.Result<List<CameraConfig>>() {
            @Override
            public void onSuccess(List<CameraConfig> value) {
                runOnUiThread(() -> {
                    cameras = value;
                    selectedCamera = cameras.isEmpty() ? CameraConfig.fallback() : cameras.get(0);
                    connectSignaling();
                    showMain();
                });
            }

            @Override
            public void onError(String message) {
                runOnUiThread(() -> {
                    cameras.clear();
                    cameras.add(CameraConfig.fallback());
                    selectedCamera = cameras.get(0);
                    Toast.makeText(MainActivity.this, message + " Varsayilan kamera kullaniliyor.", Toast.LENGTH_LONG).show();
                    connectSignaling();
                    showMain();
                });
            }
        });
    }

    private void showMain() {
        root = column();
        root.setBackgroundColor(BACKGROUND);
        setContentView(root);
        renderHeader();
        renderTabs();
        content = column();
        ScrollView scroll = new ScrollView(this);
        scroll.addView(content, matchWrap());
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        renderActiveView();
    }

    private void renderHeader() {
        LinearLayout header = row();
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(18), dp(18), dp(18), dp(10));

        ImageView logo = new ImageView(this);
        logo.setImageResource(getResources().getIdentifier("multitek_logo", "drawable", getPackageName()));
        logo.setAdjustViewBounds(true);
        header.addView(logo, new LinearLayout.LayoutParams(dp(86), dp(44)));

        LinearLayout text = column();
        text.setPadding(dp(12), 0, 0, 0);
        TextView title = title("Multitek Kamera", 21);
        TextView subtitle = small(selectedCamera.name + " - " + selectedCamera.location);
        text.addView(title);
        text.addView(subtitle, topMargin(dp(3)));
        header.addView(text, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        Button logout = ghostButton("Cikis");
        logout.setOnClickListener(view -> logout());
        header.addView(logout, new LinearLayout.LayoutParams(dp(86), dp(42)));
        root.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    private void renderTabs() {
        HorizontalScrollView scroller = new HorizontalScrollView(this);
        scroller.setHorizontalScrollBarEnabled(false);
        LinearLayout tabs = row();
        tabs.setPadding(dp(14), dp(4), dp(14), dp(10));
        scroller.addView(tabs, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroller, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        addTab(tabs, "overview", "Genel");
        addTab(tabs, "setup", "Kurulum");
        addTab(tabs, "live", "Canli");
        addTab(tabs, "settings", "Ayarlar");
        addTab(tabs, "status", "Durum");
        addTab(tabs, "notes", "Notlar");
        updateTabState();
    }

    private void addTab(LinearLayout tabs, String key, String label) {
        Button tab = ghostButton(label);
        tab.setTag(key);
        tab.setOnClickListener(view -> {
            activeView = key;
            renderActiveView();
        });
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(42));
        params.rightMargin = dp(8);
        tabs.addView(tab, params);
        tabButtons.add(tab);
    }

    private void renderActiveView() {
        if (content == null) return;
        handler.removeCallbacks(gatewayChecker);
        if (!"live".equals(activeView)) destroyLiveWebView();
        content.removeAllViews();
        content.setPadding(dp(18), dp(8), dp(18), dp(24));
        updateTabState();

        if ("overview".equals(activeView)) renderOverview();
        else if ("setup".equals(activeView)) renderSetup();
        else if ("live".equals(activeView)) renderLive();
        else if ("settings".equals(activeView)) renderSettings();
        else if ("status".equals(activeView)) renderStatus();
        else renderNotes();
    }

    private void renderOverview() {
        LinearLayout section = section("Genel Bakis", "Kamera katalogu ve secili yayin.");
        Spinner spinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, cameraLabels());
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(adapter);
        spinner.setSelection(Math.max(0, cameras.indexOf(selectedCamera)));
        spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                selectedCamera = cameras.get(position);
                connectSignaling();
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
            }
        });
        section.addView(spinner, topMargin(dp(12)));
        section.addView(infoRow("Secili kamera", selectedCamera.name), topMargin(dp(16)));
        section.addView(infoRow("Konum", selectedCamera.location), topMargin(dp(8)));
        section.addView(infoRow("Stream", selectedCamera.streamName), topMargin(dp(8)));
        Button live = primaryButton("Canli ekrani ac");
        live.setOnClickListener(view -> {
            activeView = "live";
            renderActiveView();
        });
        section.addView(live, topMargin(dp(18)));
        content.addView(section);
    }

    private void renderSetup() {
        LinearLayout section = section("Kurulum", "Mobil uygulama RTSP'yi dogrudan acmaz; go2rtc ve signaling server uzerinden izler.");
        section.addView(bullet("IP kamera RTSP yayini go2rtc tarafina verilir."), topMargin(dp(12)));
        section.addView(bullet("Mobil uygulama once signaling server uzerinden oturum acar."), topMargin(dp(8)));
        section.addView(bullet("Canli ekran /player sayfasini WebView icinde Authorization header ile yukler."), topMargin(dp(8)));
        section.addView(bullet("Gateway status uc kez producer gormezse yayin cevrimdisi sayilir."), topMargin(dp(8)));
        content.addView(section);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void renderLive() {
        gatewayFailureCount = 0;
        LinearLayout section = section("Canli Goruntu", selectedCamera.name + " - " + selectedCamera.location);

        TextView state = label("Gateway kontrol ediliyor");
        section.addView(state, topMargin(dp(12)));

        LinearLayout modeRow = row();
        modeRow.setGravity(Gravity.CENTER_VERTICAL);
        modeRow.addView(modeButton("Auto", "auto"));
        modeRow.addView(modeButton("STUN", "stun"));
        modeRow.addView(modeButton("TURN", "turn"));
        section.addView(modeRow, topMargin(dp(12)));

        FrameLayout frame = new FrameLayout(this);
        frame.setBackground(card(Color.BLACK, BORDER, dp(6)));
        liveWebView = buildWebView();
        frame.addView(liveWebView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        LinearLayout.LayoutParams frameParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(260));
        frameParams.topMargin = dp(12);
        section.addView(frame, frameParams);

        LinearLayout actions = row();
        actions.setGravity(Gravity.CENTER_VERTICAL);
        Button reload = ghostButton("Yenile");
        reload.setOnClickListener(view -> loadPlayer(liveWebView));
        Button fullscreen = primaryButton("Tam ekran");
        fullscreen.setOnClickListener(view -> openFullscreenPlayer());
        actions.addView(reload, new LinearLayout.LayoutParams(0, dp(44), 1));
        LinearLayout.LayoutParams fsParams = new LinearLayout.LayoutParams(0, dp(44), 1);
        fsParams.leftMargin = dp(10);
        actions.addView(fullscreen, fsParams);
        section.addView(actions, topMargin(dp(12)));

        TextView details = small(apiClient.playerUrl(selectedCamera));
        section.addView(details, topMargin(dp(10)));
        content.addView(section);

        loadPlayer(liveWebView);
        checkGatewayStatus(state);
        handler.postDelayed(gatewayChecker, 3000);
    }

    private void renderSettings() {
        LinearLayout section = section("Ayarlar", "Java native surum icin calisma ayarlari.");
        section.addView(infoRow("Signaling", apiClient.signalingUrl()), topMargin(dp(12)));
        section.addView(infoRow("HTTP base", apiClient.httpBase()), topMargin(dp(8)));
        section.addView(infoRow("Dil", "Turkce"), topMargin(dp(8)));
        section.addView(infoRow("Tema", "Light"), topMargin(dp(8)));
        section.addView(bullet("Bu Java surumunde RN tarafindaki tema ve dil secimleri sade tutuldu."), topMargin(dp(16)));
        content.addView(section);
    }

    private void renderStatus() {
        LinearLayout section = section("Durum", "Signaling WebSocket baglantisi.");
        section.addView(infoRow("Durum", signalingSnapshot.status), topMargin(dp(12)));
        section.addView(infoRow("Server", nullToDash(signalingSnapshot.serverUrl)), topMargin(dp(8)));
        section.addView(infoRow("Oda", nullToDash(signalingSnapshot.room)), topMargin(dp(8)));
        section.addView(infoRow("Rol", nullToDash(signalingSnapshot.role)), topMargin(dp(8)));
        section.addView(infoRow("Client", nullToDash(signalingSnapshot.clientId)), topMargin(dp(8)));
        section.addView(infoRow("Uyeler", String.valueOf(signalingSnapshot.members)), topMargin(dp(8)));
        section.addView(infoRow("Son olay", nullToDash(signalingSnapshot.lastEvent)), topMargin(dp(8)));
        if (signalingSnapshot.lastError != null) {
            TextView error = body(signalingSnapshot.lastError);
            error.setTextColor(DANGER);
            section.addView(error, topMargin(dp(10)));
        }
        LinearLayout actions = row();
        Button connect = primaryButton("Baglan");
        connect.setOnClickListener(view -> connectSignaling());
        Button disconnect = ghostButton("Kapat");
        disconnect.setOnClickListener(view -> signalingClient.disconnect());
        actions.addView(connect, new LinearLayout.LayoutParams(0, dp(44), 1));
        LinearLayout.LayoutParams disconnectParams = new LinearLayout.LayoutParams(0, dp(44), 1);
        disconnectParams.leftMargin = dp(10);
        actions.addView(disconnect, disconnectParams);
        section.addView(actions, topMargin(dp(16)));
        content.addView(section);
    }

    private void renderNotes() {
        LinearLayout section = section("Notlar", "Operasyon notlari.");
        section.addView(bullet("APK icinde signaling admin tokeni tutulmaz; login tokeni yalnizca bellek icindedir."), topMargin(dp(12)));
        section.addView(bullet("Oturum suresi dolunca uygulama login ekranina doner."), topMargin(dp(8)));
        section.addView(bullet("Fiziksel cihaz testlerinde MOBILE_SIGNALING_URL ile erisilebilir ws/wss adresi verilmelidir."), topMargin(dp(8)));
        section.addView(bullet("Eski React Native uygulama starter-kit/mobile altinda korunur."), topMargin(dp(8)));
        content.addView(section);
    }

    private Button modeButton(String label, String mode) {
        Button button = ghostButton(label);
        button.setTextColor(mode.equals(iceMode) ? Color.WHITE : INK);
        button.setBackground(mode.equals(iceMode) ? card(GREEN, GREEN, dp(6)) : card(SURFACE, BORDER, dp(6)));
        button.setOnClickListener(view -> {
            iceMode = mode;
            renderActiveView();
        });
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(8);
        button.setLayoutParams(params);
        return button;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView buildWebView() {
        WebView webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        return webView;
    }

    private void loadPlayer(WebView webView) {
        if (webView == null) return;
        String playerUrl = apiClient.playerUrl(selectedCamera);
        String separator = playerUrl.contains("?") ? "&" : "?";
        String effectiveUrl = playerUrl + separator + "iceMode=" + iceMode;
        webView.loadUrl(effectiveUrl, authHeaderMap());
    }

    private void openFullscreenPlayer() {
        Dialog dialog = new Dialog(this, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        WebView webView = buildWebView();
        dialog.setOnDismissListener(d -> webView.destroy());
        dialog.setContentView(webView, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        Window window = dialog.getWindow();
        if (window != null) window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        dialog.show();
        loadPlayer(webView);
    }

    private void checkGatewayStatus() {
        checkGatewayStatus(null);
    }

    private void checkGatewayStatus(TextView stateView) {
        apiClient.checkGateway(selectedCamera, sessionToken, new ApiClient.Result<Boolean>() {
            @Override
            public void onSuccess(Boolean value) {
                runOnUiThread(() -> {
                    if (value) {
                        gatewayFailureCount = 0;
                        if (stateView != null) {
                            stateView.setText("Canli yayin hazir");
                            stateView.setTextColor(GREEN);
                        }
                    } else {
                        gatewayFailureCount += 1;
                        if (gatewayFailureCount >= 3 && stateView != null) {
                            stateView.setText("Gateway producer bulunamadi");
                            stateView.setTextColor(DANGER);
                        }
                    }
                });
            }

            @Override
            public void onError(String message) {
                runOnUiThread(() -> {
                    gatewayFailureCount += 1;
                    if (gatewayFailureCount >= 3 && stateView != null) {
                        stateView.setText(message);
                        stateView.setTextColor(DANGER);
                    }
                });
            }
        });
    }

    private void connectSignaling() {
        signalingClient.disconnect();
        signalingClient.connect(
                apiClient.signalingUrl(),
                selectedCamera.streamName,
                "viewer",
                "mobile-viewer-java",
                sessionToken
        );
    }

    private void logout() {
        handler.removeCallbacks(expireSessionRunnable);
        handler.removeCallbacks(gatewayChecker);
        sessionToken = null;
        sessionExpiresAtMs = 0;
        if (signalingClient != null) signalingClient.disconnect();
        showLogin();
    }

    private void scheduleSessionExpiry() {
        handler.removeCallbacks(expireSessionRunnable);
        long delay = Math.max(0, sessionExpiresAtMs - System.currentTimeMillis());
        handler.postDelayed(expireSessionRunnable, delay);
    }

    private void destroyLiveWebView() {
        if (liveWebView != null) {
            liveWebView.stopLoading();
            liveWebView.destroy();
            liveWebView = null;
        }
    }

    private List<String> cameraLabels() {
        List<String> labels = new ArrayList<>();
        for (CameraConfig camera : cameras) labels.add(camera.name + " - " + camera.streamName);
        return labels;
    }

    private Map<String, String> authHeaderMap() {
        Map<String, String> headers = new HashMap<>();
        if (sessionToken != null && !sessionToken.isEmpty()) {
            headers.put("Authorization", "Bearer " + sessionToken);
        }
        return headers;
    }

    private void updateTabState() {
        for (Button button : tabButtons) {
            boolean active = activeView.equals(String.valueOf(button.getTag()));
            button.setTextColor(active ? Color.WHITE : INK);
            button.setBackground(active ? card(GREEN, GREEN, dp(20)) : card(SURFACE, BORDER, dp(20)));
        }
    }

    private LinearLayout section(String title, String subtitle) {
        LinearLayout section = column();
        section.setPadding(dp(16), dp(16), dp(16), dp(16));
        section.setBackground(card(SURFACE, BORDER, dp(8)));
        section.addView(title(title, 20));
        section.addView(body(subtitle), topMargin(dp(6)));
        return section;
    }

    private View infoRow(String label, String value) {
        LinearLayout row = column();
        row.setPadding(dp(12), dp(10), dp(12), dp(10));
        row.setBackground(card(SURFACE_STRONG, BORDER, dp(6)));
        row.addView(label(label));
        row.addView(body(value == null ? "-" : value), topMargin(dp(3)));
        return row;
    }

    private TextView bullet(String text) {
        TextView view = body("- " + text);
        view.setLineSpacing(dp(2), 1.0f);
        return view;
    }

    private EditText input(String hint, boolean password) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setSingleLine(true);
        input.setTextColor(INK);
        input.setHintTextColor(MUTED);
        input.setPadding(dp(12), 0, dp(12), 0);
        input.setBackground(card(SURFACE_STRONG, BORDER, dp(6)));
        input.setInputType(password
                ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD
                : InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_NORMAL);
        input.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        return input;
    }

    private Button primaryButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextColor(Color.WHITE);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setBackground(card(GREEN, GREEN, dp(6)));
        return button;
    }

    private Button ghostButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextColor(INK);
        button.setBackground(card(SURFACE, BORDER, dp(6)));
        return button;
    }

    private TextView title(String text, int sp) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(INK);
        view.setTextSize(sp);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        return view;
    }

    private TextView label(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(INK);
        view.setTextSize(13);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        return view;
    }

    private TextView body(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(MUTED);
        view.setTextSize(15);
        return view;
    }

    private TextView small(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(MUTED);
        view.setTextSize(12);
        return view;
    }

    private LinearLayout column() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    private LinearLayout row() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        return layout;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams topMargin(int margin) {
        LinearLayout.LayoutParams params = matchWrap();
        params.topMargin = margin;
        return params;
    }

    private GradientDrawable card(int color, int stroke, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setStroke(dp(1), stroke);
        drawable.setCornerRadius(radius);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private String nullToDash(String value) {
        return value == null || value.isEmpty() ? "-" : value;
    }
}
