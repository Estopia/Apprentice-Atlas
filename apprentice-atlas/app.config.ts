import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig = config as ExpoConfig;
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (process.env.EAS_BUILD_PROFILE && !googleMapsApiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY must be set for EAS native builds.');
  }
  const mapsPlugin = googleMapsApiKey
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
