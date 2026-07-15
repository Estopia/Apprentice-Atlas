import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { getCompanyBrand } from '@/lib/company-brand';

export function CompanyBrandMark({ company, size = 48 }: { company: string; size?: number }) {
  const brand = getCompanyBrand(company);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showLogo = brand.logoUrl !== null && failedUrl !== brand.logoUrl;

  return (
    <View
      accessibilityLabel={company}
      style={[styles.mark, { width: size, height: size, borderRadius: Math.round(size * 0.27), backgroundColor: showLogo ? Palette.white : brand.soft }]}
    >
      {showLogo ? (
        <Image
          accessibilityElementsHidden
          cachePolicy="disk"
          contentFit="contain"
          onError={() => setFailedUrl(brand.logoUrl)}
          source={{ uri: brand.logoUrl! }}
          style={{ width: size * 0.7, height: size * 0.7 }}
          transition={140}
        />
      ) : (
        <Text style={[styles.initials, { color: brand.accent, fontSize: Math.max(14, size * 0.34) }]}>{brand.initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(8,31,77,0.09)', overflow: 'hidden' },
  initials: { fontWeight: '900', letterSpacing: -0.6 },
});
