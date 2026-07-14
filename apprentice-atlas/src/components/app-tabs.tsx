import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Palette } from '@/constants/theme';
import { useLocale, t } from '@/lib/i18n';

export default function AppTabs() {
  const [locale] = useLocale();

  return (
    <NativeTabs
      backgroundColor={Palette.white}
      iconColor={{ default: Palette.textSecondary, selected: Palette.blue }}
      indicatorColor={Palette.blueSoft}
      minimizeBehavior="onScrollDown"
      labelStyle={{ default: { color: Palette.textSecondary }, selected: { color: Palette.blue, fontWeight: '700' } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t(locale, 'tabs.discover')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'map', selected: 'map.fill' }}
          md={{ default: 'map', selected: 'map' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="favorites" role="bookmarks">
        <NativeTabs.Trigger.Label>{t(locale, 'tabs.saved')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bookmark', selected: 'bookmark.fill' }}
          md={{ default: 'bookmark_border', selected: 'bookmark' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="atlas">
        <NativeTabs.Trigger.Label>{t(locale, 'tabs.atlas')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md={{ default: 'person', selected: 'person' }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
