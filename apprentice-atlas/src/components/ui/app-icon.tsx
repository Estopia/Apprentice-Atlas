import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

type AppIconProps = Pick<SymbolViewProps, 'name' | 'size' | 'tintColor'> & {
  accessibilityLabel?: string;
};

export function AppIcon({ name, size = 20, tintColor, accessibilityLabel }: AppIconProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.frame, { width: size, height: size }]}>
      <SymbolView name={name} size={size} tintColor={tintColor} style={styles.symbol} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    width: '100%',
    height: '100%',
  },
});
