// metro.config.js  (во root на проектот, до package.json)
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Дозволи .csv и .txt фајлови да се импортираат како стринг
config.resolver.assetExts.push("csv", "txt");

module.exports = config;