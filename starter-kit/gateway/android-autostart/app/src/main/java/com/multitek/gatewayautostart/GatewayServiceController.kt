package com.multitek.gatewayautostart

import android.content.Context
import android.content.Intent
import android.os.Build

object GatewayServiceController {
  fun start(context: Context) {
    val intent = Intent(context, GatewayWatchdogService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
  }
}
