module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo automatically injects the react-native-worklets babel
    // plugin (required by Reanimated 4) when reanimated is installed. It must be
    // applied via a real babel.config.js — without this file the worklets plugin
    // never runs and every Reanimated animation silently snaps instead of running.
    presets: ["babel-preset-expo"],
  };
};
