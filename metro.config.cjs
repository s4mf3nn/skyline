const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

// Sentry ajoute un Debug ID à chaque bundle (rattachement des sourcemaps) ; NativeWind lit global.css pour les styles.
module.exports = withNativeWind(getSentryExpoConfig(__dirname), { input: "./global.css" });
