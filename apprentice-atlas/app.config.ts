import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig = config as ExpoConfig;
  const isAndroidEasBuild = process.env.EAS_BUILD_PLATFORM === 'android';
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (isAndroidEasBuild && !googleMapsApiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY must be set for Android EAS builds.');
  }
  const mapsPlugin = isAndroidEasBuild && googleMapsApiKey
    ? ([['react-native-maps', { androidGoogleMapsApiKey: googleMapsApiKey }]] as [string, { androidGoogleMapsApiKey: string }][])
    : [];

  return {
    ...baseConfig,
    plugins: [
      ...(baseConfig.plugins ?? []),
      ...mapsPlugin,
      
    ],
  };
};
