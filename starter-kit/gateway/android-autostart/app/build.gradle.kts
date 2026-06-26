plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "com.multitek.gatewayautostart"
  compileSdk = 34

  fun env(name: String): String = System.getenv(name).orEmpty()
  fun escaped(value: String): String = value
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")
  val provisioningUrl = env("GATEWAY_PROVISIONING_SIGNALING_URL").ifBlank {
    val host = env("SIGNALING_HOST")
    val port = env("SIGNALING_PORT").ifBlank { "3000" }
    if (host.isNotBlank()) "http://$host:$port" else ""
  }
  val fallbackProvisioningUrl = env("GATEWAY_PROVISIONING_FALLBACK_SIGNALING_URL").ifBlank {
    val host = env("SIGNALING_PUBLIC_HOST")
    val port = env("SIGNALING_PUBLIC_PORT").ifBlank { "13000" }
    if (host.isNotBlank()) "http://$host:$port" else ""
  }
  val localProvisioningUrl = run {
    val host = env("SIGNALING_HOST")
    val port = env("SIGNALING_PORT").ifBlank { "3000" }
    if (host.isNotBlank()) "http://$host:$port" else ""
  }

  defaultConfig {
    applicationId = "com.multitek.gatewayautostart"
    minSdk = 23
    targetSdk = 25
    versionCode = 6
    versionName = "1.5"

    buildConfigField("String", "PROVISIONING_SIGNALING_URL", "\"${escaped(provisioningUrl)}\"")
    buildConfigField("String", "PROVISIONING_FALLBACK_SIGNALING_URL", "\"${escaped(fallbackProvisioningUrl)}\"")
    buildConfigField("String", "PROVISIONING_LOCAL_SIGNALING_URL", "\"${escaped(localProvisioningUrl)}\"")
    buildConfigField("String", "PROVISIONING_USERNAME", "\"${escaped(env("SIGNALING_AUTH_USERNAME"))}\"")
    buildConfigField("String", "PROVISIONING_PASSWORD", "\"${escaped(env("SIGNALING_AUTH_PASSWORD"))}\"")
  }

  buildFeatures {
    buildConfig = true
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro",
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("com.google.android.material:material:1.12.0")
}
