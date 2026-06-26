package com.multitek.gatewayautostart

import android.net.Uri
import android.util.Base64
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

data class CameraProvisioningRequest(
  val name: String,
  val location: String,
  val streamName: String,
  val rtspUrl: String,
  val cameraUsername: String,
  val cameraPassword: String,
)

data class CameraProvisioningResult(
  val ok: Boolean,
  val message: String,
)

object CameraProvisioner {
  fun provision(request: CameraProvisioningRequest): CameraProvisioningResult {
    val normalizedRequest = request.copy(
      streamName = request.streamName.trim(),
      rtspUrl = applyRtspCredentials(
        rtspUrl = normalizeRtspUrl(request.rtspUrl),
        username = request.cameraUsername.trim(),
        password = request.cameraPassword,
      ),
    )
    val validationError = validate(normalizedRequest)
    if (validationError != null) {
      return CameraProvisioningResult(false, validationError)
    }

    return try {
      registerWithSignaling(normalizedRequest)
      CameraProvisioningResult(true, "Kamera kaydedildi.")
    } catch (error: Exception) {
      CameraProvisioningResult(false, error.message ?: "Kamera kaydedilemedi.")
    }
  }

  private fun normalizeRtspUrl(value: String): String {
    val trimmed = value.trim()
    if (trimmed.startsWith("rtsp://") || trimmed.startsWith("rtsps://")) return trimmed

    val tokens = trimmed
      .replace(Regex("^rtsp\\s+", RegexOption.IGNORE_CASE), "")
      .split(Regex("\\s+"))
      .filter { it.isNotBlank() }

    if (tokens.size >= 5 && tokens.take(4).all { it.toIntOrNull() in 0..255 }) {
      val host = tokens.take(4).joinToString(".")
      val path = tokens.drop(4).joinToString("/")
      return "rtsp://$host:554/$path"
    }

    return trimmed
  }

  private fun applyRtspCredentials(rtspUrl: String, username: String, password: String): String {
    if (username.isBlank() && password.isBlank()) return rtspUrl

    val schemeEnd = rtspUrl.indexOf("://")
    if (schemeEnd < 0) return rtspUrl

    val authorityStart = schemeEnd + 3
    val pathStart = rtspUrl.indexOf('/', startIndex = authorityStart).let { if (it < 0) rtspUrl.length else it }
    val scheme = rtspUrl.substring(0, authorityStart)
    val authority = rtspUrl.substring(authorityStart, pathStart)
    val path = rtspUrl.substring(pathStart)
    val hostPort = authority.substringAfterLast('@')
    val encodedUser = Uri.encode(username)
    val encodedPassword = Uri.encode(password)

    return "$scheme$encodedUser:$encodedPassword@$hostPort$path"
  }

  private fun validate(request: CameraProvisioningRequest): String? {
    if (request.name.isBlank()) return "Kamera adi zorunlu."
    if (!Regex("^[A-Za-z0-9_-]{2,64}$").matches(request.streamName)) {
      return "Stream adi 2-64 karakter olmali."
    }
    if (!request.rtspUrl.startsWith("rtsp://") && !request.rtspUrl.startsWith("rtsps://")) {
      return "RTSP adresi rtsp:// veya rtsps:// ile baslamali."
    }
    if (
      BuildConfig.PROVISIONING_SIGNALING_URL.isBlank() ||
      BuildConfig.PROVISIONING_USERNAME.isBlank() ||
      BuildConfig.PROVISIONING_PASSWORD.isBlank()
    ) {
      return "Signaling ayari APK build config icinde eksik."
    }
    return null
  }

  private fun registerWithSignaling(request: CameraProvisioningRequest) {
    val body = JSONObject()
      .put("name", request.name)
      .put("location", request.location)
      .put("streamName", request.streamName)
      .put("rtspUrl", request.rtspUrl)
      .toString()

    val errors = mutableListOf<String>()
    for (baseUrl in provisioningUrls()) {
      var lastError: Exception? = null
      repeat(2) { attempt ->
        if (attempt > 0) Thread.sleep(500)
        try {
          sendCameraRegistration(baseUrl, body)
          return
        } catch (error: Exception) {
          lastError = error
        }
      }
      val error = lastError
      if (error != null) {
        errors += "${baseUrl.trimEnd('/')}: ${error.message ?: error.javaClass.simpleName}"
      }
    }

    throw IllegalStateException(errors.joinToString(" | "))
  }

  private fun sendCameraRegistration(baseUrl: String, body: String) {
    val connection = openConnection(
      url = "${baseUrl.trimEnd('/')}/admin/cameras",
      method = "POST",
      username = BuildConfig.PROVISIONING_USERNAME,
      password = BuildConfig.PROVISIONING_PASSWORD,
    )
    try {
      connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
      connection.doOutput = true
      connection.outputStream.use { output ->
        output.write(body.toByteArray(StandardCharsets.UTF_8))
      }
      ensureSuccess(connection, "Signaling kamera kaydi basarisiz")
    } finally {
      connection.disconnect()
    }
  }

  private fun provisioningUrls(): List<String> {
    return listOf(
      BuildConfig.PROVISIONING_SIGNALING_URL,
      BuildConfig.PROVISIONING_FALLBACK_SIGNALING_URL,
      BuildConfig.PROVISIONING_LOCAL_SIGNALING_URL,
    )
      .map { it.trim() }
      .filter { it.isNotBlank() }
      .distinct()
  }

  private fun openConnection(
    url: String,
    method: String,
    username: String,
    password: String,
  ): HttpURLConnection {
    val connection = URL(url).openConnection() as HttpURLConnection
    connection.requestMethod = method
    connection.connectTimeout = 7_000
    connection.readTimeout = 7_000
    connection.setRequestProperty("Accept", "application/json")
    val credentials = "$username:$password"
    val encoded = Base64.encodeToString(credentials.toByteArray(StandardCharsets.UTF_8), Base64.NO_WRAP)
    connection.setRequestProperty("Authorization", "Basic $encoded")
    return connection
  }

  private fun ensureSuccess(connection: HttpURLConnection, fallback: String) {
    val statusCode = connection.responseCode
    if (statusCode in 200..299) return

    val errorBody = runCatching {
      (connection.errorStream ?: connection.inputStream)
        ?.bufferedReader()
        ?.use { it.readText() }
    }.getOrNull().orEmpty()
    throw IllegalStateException("$fallback: HTTP $statusCode ${errorBody.take(120)}".trim())
  }
}
