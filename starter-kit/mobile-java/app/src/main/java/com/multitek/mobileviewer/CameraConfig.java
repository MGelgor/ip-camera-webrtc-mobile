package com.multitek.mobileviewer;

import java.util.ArrayList;
import java.util.List;

final class CameraConfig {
    final String id;
    final String name;
    final String location;
    final String streamName;
    final String playerUrl;
    final String streamStatusUrl;
    final List<IceServerConfig> iceServers;

    CameraConfig(
            String id,
            String name,
            String location,
            String streamName,
            String playerUrl,
            String streamStatusUrl,
            List<IceServerConfig> iceServers
    ) {
        this.id = id;
        this.name = name;
        this.location = location;
        this.streamName = streamName;
        this.playerUrl = playerUrl;
        this.streamStatusUrl = streamStatusUrl;
        this.iceServers = iceServers == null ? new ArrayList<>() : iceServers;
    }

    static CameraConfig fallback() {
        List<IceServerConfig> iceServers = new ArrayList<>();
        ArrayList<String> urls = new ArrayList<>();
        urls.add("stun:stun.cloudflare.com:3478");
        iceServers.add(new IceServerConfig(urls, null, null));
        return new CameraConfig(
                "ofis-kamera",
                "Ofis Kamera",
                "Multitek test alani",
                "ofis_kamera",
                null,
                null,
                iceServers
        );
    }
}
