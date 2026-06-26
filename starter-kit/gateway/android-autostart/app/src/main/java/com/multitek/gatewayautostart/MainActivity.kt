package com.multitek.gatewayautostart

import android.os.Bundle
import android.text.InputType
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
  private lateinit var status: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(24), dp(24), dp(24), dp(24))
    }

    val title = TextView(this).apply {
      text = "Gateway"
      textSize = 22f
    }

    val subtitle = TextView(this).apply {
      text = "v${BuildConfig.VERSION_NAME} - kamera ekleme"
      textSize = 15f
    }

    val endpointInfo = TextView(this).apply {
      text = "Signaling: ${BuildConfig.PROVISIONING_SIGNALING_URL} / ${BuildConfig.PROVISIONING_LOCAL_SIGNALING_URL}"
      textSize = 12f
    }

    val startAction = Button(this).apply {
      text = "Simdi Baslat"
      setOnClickListener {
        GatewayServiceController.start(this@MainActivity)
        status.text = "Gateway watchdog baslatildi."
      }
    }

    val cameraName = input("Kamera adi", "Orn: ucuncu kamera")
    val cameraLocation = input("Konum", "Orn: arge")
    val streamName = input("Stream adi", "Orn: kamerauc")
    val rtspUrl = input("RTSP adresi", "Orn: 10 99 28 3 live main")
    val cameraUsername = input("Kamera kullanici adi", "Bos birakilabilir")
    val cameraPassword = input("Kamera sifre", "Bos birakilabilir").apply {
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
    }

    val addCameraAction = Button(this).apply {
      text = "Kamerayi Ekle"
      setOnClickListener {
        val request = CameraProvisioningRequest(
          name = cameraName.text.toString().trim(),
          location = cameraLocation.text.toString().trim(),
          streamName = streamName.text.toString().trim(),
          rtspUrl = rtspUrl.text.toString().trim(),
          cameraUsername = cameraUsername.text.toString().trim(),
          cameraPassword = cameraPassword.text.toString(),
        )
        submitCamera(request, this)
      }
    }

    status = TextView(this).apply {
      textSize = 14f
      setPadding(0, dp(12), 0, 0)
    }

    root.addView(title)
    root.addView(subtitle)
    root.addView(endpointInfo)
    root.addView(startAction)
    root.addView(sectionTitle("Yeni kamera"))
    root.addView(fieldLabel("Kamera adi"))
    root.addView(cameraName)
    root.addView(fieldLabel("Konum"))
    root.addView(cameraLocation)
    root.addView(fieldLabel("Stream adi"))
    root.addView(streamName)
    root.addView(fieldLabel("RTSP adresi"))
    root.addView(rtspUrl)
    root.addView(fieldLabel("Kamera kullanici adi"))
    root.addView(cameraUsername)
    root.addView(fieldLabel("Kamera sifre"))
    root.addView(cameraPassword)
    root.addView(addCameraAction)
    root.addView(status)
    setContentView(ScrollView(this).apply { addView(root) })
  }

  private fun submitCamera(request: CameraProvisioningRequest, button: Button) {
    button.isEnabled = false
    status.text = "Kamera kaydediliyor..."
    Thread {
      val result = CameraProvisioner.provision(request)
      runOnUiThread {
        button.isEnabled = true
        status.text = result.message
      }
    }.start()
  }

  private fun sectionTitle(text: String): TextView =
    TextView(this).apply {
      this.text = text
      textSize = 16f
      setPadding(0, dp(18), 0, dp(6))
    }

  private fun fieldLabel(text: String): TextView =
    TextView(this).apply {
      this.text = text
      textSize = 13f
      setPadding(0, dp(8), 0, 0)
    }

  private fun input(hint: String, value: String = ""): EditText =
    EditText(this).apply {
      this.hint = hint
      setText(value)
      setSingleLine(true)
    }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }
}
