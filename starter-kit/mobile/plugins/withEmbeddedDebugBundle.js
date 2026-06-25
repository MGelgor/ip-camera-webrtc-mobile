const { withAppBuildGradle } = require("@expo/config-plugins");

const DEBUGGABLE_VARIANTS_EXAMPLE =
  '    // debuggableVariants = ["liteDebug", "prodDebug"]';
const EMBEDDED_DEBUG_BUNDLE_CONFIG = [
  "    // Include a fallback JS bundle so Android Studio debug runs do not require Metro.",
  "    // Metro remains available when it is running, while offline runs use the APK bundle.",
  "    debuggableVariants = []",
].join("\n");

const RELEASE_SIGNING_MARKER = "def releaseSigningConfigured = releaseSigningValues.every";
const RELEASE_SIGNING_CONFIG = [
  "def releaseSigningValues = [",
  '    System.getenv("ANDROID_RELEASE_KEYSTORE_PATH"),',
  '    System.getenv("ANDROID_RELEASE_STORE_PASSWORD"),',
  '    System.getenv("ANDROID_RELEASE_KEY_ALIAS"),',
  '    System.getenv("ANDROID_RELEASE_KEY_PASSWORD"),',
  "]",
  "def releaseSigningConfigured = releaseSigningValues.every { it != null && !it.trim().isEmpty() }",
  "",
].join("\n");

const DEBUG_SIGNING_BLOCK = [
  "    signingConfigs {",
  "        debug {",
  "            storeFile file('debug.keystore')",
  "            storePassword 'android'",
  "            keyAlias 'androiddebugkey'",
  "            keyPassword 'android'",
  "        }",
  "    }",
].join("\n");

const RELEASE_SIGNING_BLOCK = [
  "    signingConfigs {",
  "        debug {",
  "            storeFile file('debug.keystore')",
  "            storePassword 'android'",
  "            keyAlias 'androiddebugkey'",
  "            keyPassword 'android'",
  "        }",
  "        if (releaseSigningConfigured) {",
  "            release {",
  '                storeFile file(System.getenv("ANDROID_RELEASE_KEYSTORE_PATH"))',
  '                storePassword System.getenv("ANDROID_RELEASE_STORE_PASSWORD")',
  '                keyAlias System.getenv("ANDROID_RELEASE_KEY_ALIAS")',
  '                keyPassword System.getenv("ANDROID_RELEASE_KEY_PASSWORD")',
  "            }",
  "        }",
  "    }",
].join("\n");

const DEBUG_RELEASE_SIGNING = [
  "        release {",
  "            // Caution! In production, you need to generate your own keystore file.",
  "            // see https://reactnative.dev/docs/signed-apk-android.",
  "            signingConfig signingConfigs.debug",
].join("\n");
const SECURE_RELEASE_SIGNING = [
  "        release {",
  "            // Production releases must never fall back to the debug keystore.",
  "            if (releaseSigningConfigured) {",
  "                signingConfig signingConfigs.release",
  "            }",
].join("\n");

module.exports = function withEmbeddedDebugBundle(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error("Embedded debug bundle plugin requires a Groovy app/build.gradle.");
    }

    if (!gradleConfig.modResults.contents.includes(DEBUGGABLE_VARIANTS_EXAMPLE)) {
      if (!gradleConfig.modResults.contents.includes("debuggableVariants = []")) {
        throw new Error("React Native debuggableVariants block was not found.");
      }
    } else {
      gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
        DEBUGGABLE_VARIANTS_EXAMPLE,
        EMBEDDED_DEBUG_BUNDLE_CONFIG,
      );
    }

    if (!gradleConfig.modResults.contents.includes(RELEASE_SIGNING_MARKER)) {
      if (
        !gradleConfig.modResults.contents.includes(DEBUG_SIGNING_BLOCK) ||
        !gradleConfig.modResults.contents.includes(DEBUG_RELEASE_SIGNING)
      ) {
        throw new Error("Android release signing blocks were not found.");
      }
      gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
        "android {",
        `${RELEASE_SIGNING_CONFIG}android {`,
      );
      gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
        DEBUG_SIGNING_BLOCK,
        RELEASE_SIGNING_BLOCK,
      );
      gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
        DEBUG_RELEASE_SIGNING,
        SECURE_RELEASE_SIGNING,
      );
    }

    return gradleConfig;
  });
};
