const { withProjectBuildGradle } = require('@expo/config-plugins');

// Google Play Services Ads (and its transitive kotlin-stdlib) started shipping
// Kotlin 2.1-compiled classes before Expo SDK 51's Kotlin 1.9 compiler can
// read that metadata, which hard-fails every Android build. The Kotlin
// compiler itself documents this exact escape hatch in the error message.
const MARKER = '-Xskip-metadata-version-check';
const INJECTION = `
subprojects {
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    kotlinOptions {
      freeCompilerArgs += ["${MARKER}"]
    }
  }
}
`;

module.exports = function withKotlinSkipMetadataCheck(config) {
  return withProjectBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(MARKER)) {
      config.modResults.contents += INJECTION;
    }
    return config;
  });
};
