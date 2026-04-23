module.exports = function (api) {
  const isTest = process.env.NODE_ENV === 'test' || api.env('test');
  api.cache.invalidate(() => process.env.NODE_ENV);
  return {
    presets: isTest
      // Em Jest: babel-preset-expo puro (sem nativewind) — nativewind/babel transforma
      // className e injeta helpers globais incompatíveis com jest.mock hoisting.
      ? ['babel-preset-expo']
      : [
          ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
          'nativewind/babel',
        ],
    // react-native-reanimated/plugin é incompatível com Jest (usa worklets).
    plugins: isTest ? [] : ['react-native-reanimated/plugin'],
  };
};
