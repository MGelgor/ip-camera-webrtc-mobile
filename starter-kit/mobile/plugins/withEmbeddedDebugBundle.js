const { withAppBuildGradle } = require("@expo/config-plugins");

const DEBUGGABLE_VARIANTS_EXAMPLE =
  '    // debuggableVariants = ["liteDebug", "prodDebug"]';
const EMBEDDED_DEBUG_BUNDLE_CONFIG = [
  "    // Include a fallback JS bundle so Android Studio debug runs do not require Metro.",
  "    // Metro remains available when it is running, while offline runs use the APK bundle.",
  "    debuggableVariants = []",
].join("\n");

module.exports = function withEmbeddedDebugBundle(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error("Embedded debug bundle plugin requires a Groovy app/build.gradle.");
    }

    if (gradleConfig.modResults.contents.includes("debuggableVariants = []")) {
      return gradleConfig;
    }

    if (!gradleConfig.modResults.contents.includes(DEBUGGABLE_VARIANTS_EXAMPLE)) {
      throw new Error("React Native debuggableVariants block was not found.");
    }

    gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
      DEBUGGABLE_VARIANTS_EXAMPLE,
      EMBEDDED_DEBUG_BUNDLE_CONFIG,
    );

    return gradleConfig;
  });
};
