package com.multitek.gatewayautostart

object GatewayStarter {
  private const val DeviceStartScript = "/data/local/tmp/staj-gateway/start-go2rtc-device.sh"

  fun startGateway() {
    val command = arrayOf("su", "-c", DeviceStartScript)
    Runtime.getRuntime().exec(command)
  }
}
