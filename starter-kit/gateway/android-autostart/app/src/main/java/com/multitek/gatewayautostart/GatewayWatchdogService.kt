package com.multitek.gatewayautostart

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper

class GatewayWatchdogService : Service() {
  private val handler = Handler(Looper.getMainLooper())

  private val watchdog = object : Runnable {
    override fun run() {
      if (!GatewayStarter.isGatewayRunning()) {
        GatewayStarter.startGateway()
      }
      handler.postDelayed(this, WatchdogIntervalMs)
    }
  }

  override fun onCreate() {
    super.onCreate()
    startForeground(NotificationId, buildNotification())
    watchdog.run()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(watchdog)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun buildNotification(): Notification {
    val channelId = "gateway-watchdog"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "Gateway Watchdog",
        NotificationManager.IMPORTANCE_LOW,
      )
      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(channel)
    }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, channelId)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setSmallIcon(android.R.drawable.stat_sys_upload_done)
      .setContentTitle("Gateway Service")
      .setContentText("go2rtc izleniyor")
      .setOngoing(true)
      .build()
  }

  private companion object {
    const val NotificationId = 1001
    const val WatchdogIntervalMs = 30_000L
  }
}
