import { TabList, TabSlot, Tabs, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius, Shadows } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';

export default function AppTabs() {
  const [locale] = useLocale();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild><TabButton icon="home">{t(locale, 'tabs.home')}</TabButton></TabTrigger>
          <TabTrigger name="map" href="/map" asChild><TabButton icon="map">{t(locale, 'tabs.map')}</TabButton></TabTrigger>
          <TabTrigger name="favorites" href="/favorites" asChild><TabButton icon="bookmark">{t(locale, 'tabs.saved')}</TabButton></TabTrigger>
          <TabTrigger name="atlas" href="/atlas" asChild><TabButton icon="person">{t(locale, 'tabs.atlas')}</TabButton></TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, icon, ...props }: TabTriggerSlotProps & { icon: 'home' | 'map' | 'bookmark' | 'person' }) {
  const iconName = icon === 'home'
    ? { ios: 'house.fill', android: 'home', web: 'home' } as const
    : icon === 'map'
    ? { ios: 'map.fill', android: 'map', web: 'map' } as const
    : icon === 'bookmark'
      ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' } as const
      : { ios: 'person.crop.circle.fill', android: 'person', web: 'person' } as const;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: Boolean(isFocused) }} style={({ pressed }) => [styles.tabButton, isFocused && styles.tabButtonActive, pressed && styles.pressed]}>
      <AppIcon name={iconName} size={17} tintColor={isFocused ? Palette.white : Palette.textSecondary} />
      <Text numberOfLines={1} style={[styles.tabText, isFocused && styles.tabTextActive]}>{children}</Text>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  return <View {...props} style={styles.tabListContainer}><View style={[styles.innerContainer, Shadows.floating]}>{props.children}</View></View>;
}

const styles = StyleSheet.create({
  tabListContainer: { position: 'absolute', left: 0, right: 0, bottom: 18, zIndex: 50, alignItems: 'center', paddingHorizontal: 8, pointerEvents: 'box-none' },
  innerContainer: { width: '100%', maxWidth: 380, flexDirection: 'row', padding: 4, gap: 3, borderRadius: Radius.pill, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border },
  tabButton: { height: 46, minHeight: 44, flex: 1, minWidth: 0, paddingHorizontal: 6, borderRadius: Radius.pill, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  tabButtonActive: { backgroundColor: Palette.blue },
  tabText: { flexShrink: 1, color: Palette.textSecondary, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: Palette.white },
  pressed: { opacity: 0.72 },
});
