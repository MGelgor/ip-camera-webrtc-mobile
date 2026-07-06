package com.multitek.mobileviewer;

import java.util.ArrayList;
import java.util.List;

final class IceServerConfig {
    final List<String> urls;
    final String username;
    final String credential;

    IceServerConfig(List<String> urls, String username, String credential) {
        this.urls = urls == null ? new ArrayList<>() : urls;
        this.username = username;
        this.credential = credential;
    }
}
