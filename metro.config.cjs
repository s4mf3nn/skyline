const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// NativeWind lit global.css pour générer les styles au bundling.
module.exports = withNativeWind(getDefaultConfig(__dirname), { input: "./global.css" });
