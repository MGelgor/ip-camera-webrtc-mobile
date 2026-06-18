package com.multitek.gatewayautostart

import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(48, 48, 48, 48)
    }

    val title = TextView(this).apply {
      text = "Gateway Autostart"
      textSize = 22f
    }

    val subtitle = TextView(this).apply {
      text = "Boot sonrasinda /data/local/tmp/staj-gateway/start-go2rtc-device.sh komutunu calistirir."
      textSize = 15f
    }

    val action = Button(this).apply {
      text = "Simdi Baslat"
      setOnClickListener {
        GatewayStarter.startGateway()
      }
    }

    root.addView(title)
    root.addView(subtitle)
    root.addView(action)
    setContentView(root)
  }
}
