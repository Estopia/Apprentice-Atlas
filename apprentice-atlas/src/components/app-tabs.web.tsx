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
          <TabTrigger name="index" href="/" asChild><TabButton icon="map">{t(locale, 'tabs.discover')}</TabButton></TabTrigger>
          <TabTrigger name="favorites" href="/favorites" asChild><TabButton icon="bookmark">{t(locale, 'tabs.saved')}</TabButton></TabTrigger>
          <TabTrigger name="atlas" href="/atlas" asChild><TabButton icon="person">{t(locale, 'tabs.atlas')}</TabButton></TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, icon, ...props }: TabTriggerSlotProps & { icon: 'map' | 'bookmark' | 'person' }) {
  const iconName = icon === 'map'
    ? { ios: 'map.fill', android: 'map', web: 'map' } as const
    : icon === 'bookmark'
      ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' } as const
      : { ios: 'person.crop.circle.fill', android: 'person', web: 'person' } as const;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: Boolean(isFocused) }} style={({ pressed }) => [styles.tabButton, isFocused && styles.tabButtonActive, pressed && styles.pressed]}>
      <AppIcon name={iconName} size={18} tintColor={isFocused ? Palette.white : Palette.textSecondary} />
      <Text style={[styles.tabText, isFocused && styles.tabTextActive]}>{children}</Text>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  return <View {...props} style={styles.tabListContainer}><View style={[styles.innerContainer, Shadows.floating]}>{props.children}</View></View>;
}

const styles = StyleSheet.create({
  tabListContainer: { position: 'absolute', left: 0, right: 0, bottom: 18, zIndex: 50, alignItems: 'center', pointerEvents: 'box-none' },
  innerContainer: { flexDirection: 'row', padding: 5, gap: 4, borderRadius: Radius.pill, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border },
  tabButton: { height: 46, minHeight: 44, width: 108, minWidth: 44, paddingHorizontal: 12, borderRadius: Radius.pill, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  tabButtonActive: { backgroundColor: Palette.blue },
  tabText: { color: Palette.textSecondary, fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: Palette.white },
  pressed: { opacity: 0.72 },
});
