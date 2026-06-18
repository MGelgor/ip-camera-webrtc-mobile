package com.multitek.gatewayautostart

object GatewayStarter {
  private const val DeviceStartScript = "/data/local/tmp/staj-gateway/start-go2rtc-device.sh"
  private const val DevicePidFile = "/data/local/tmp/staj-gateway/go2rtc.pid"

  fun startGateway(): Boolean {
    if (isGatewayRunning()) {
      return true
    }

    return runCommand(arrayOf("su", "-c", DeviceStartScript))
  }

  fun isGatewayRunning(): Boolean {
    val command = arrayOf(
      "sh",
      "-c",
      "pid=$(cat $DevicePidFile 2>/dev/null); " +
        "[ -n \"${'$'}pid\" ] && [ -d \"/proc/${'$'}pid\" ] && " +
        "tr '\\0' ' ' < \"/proc/${'$'}pid/cmdline\" 2>/dev/null | grep -q go2rtc",
    )
    return runCommand(command)
  }

  private fun runCommand(command: Array<String>): Boolean {
    return try {
      val process = Runtime.getRuntime().exec(command)
      process.waitFor() == 0
    } catch (_: Exception) {
      false
    }
  }
}
