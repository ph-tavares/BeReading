module.exports = function (api) {
  const isTest = process.env.NODE_ENV === 'test' || api.env('test');
  api.cache.invalidate(() => process.env.NODE_ENV);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated/plugin é incompatível com Jest (usa worklets).
    plugins: isTest ? [] : ['react-native-reanimated/plugin'],
  };
};
