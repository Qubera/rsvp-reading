const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite не поддерживает web (нет wa-sqlite.wasm в пакете) —
// на web используется IndexedDB-драйвер, поэтому модуль заменяем заглушкой.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && (moduleName === 'expo-sqlite' || moduleName.startsWith('expo-sqlite/'))) {
    return { filePath: require('path').resolve(__dirname, 'src/storage/sqliteStub.ts'), type: 'sourceFile' };
  }
  if (platform === 'web' && moduleName === 'expo-notifications') {
    return { filePath: require('path').resolve(__dirname, 'src/storage/sqliteStub.ts'), type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
