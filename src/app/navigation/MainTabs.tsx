import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { HomeScreen } from '../../features/home/HomeScreen';
import { LibraryScreen } from '../../features/library/LibraryScreen';
import { StatsScreen } from '../../features/stats/StatsScreen';
import { SettingsScreen } from '../../features/settings/SettingsScreen';

export type TabParamList = {
  Home: undefined;
  LibraryTab: undefined;
  Stats: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export function MainTabs() {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.select({ ios: 88, default: 68 }),
          paddingTop: 8,
          paddingBottom: Platform.select({ ios: 28, default: 10 }),
        },
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        tabBarIcon: ({ color, focused }) => {
          const icons = {
            Home: focused ? 'eye' : 'eye-outline',
            LibraryTab: focused ? 'library' : 'library-outline',
            Stats: focused ? 'stats-chart' : 'stats-chart-outline',
            Settings: focused ? 'settings' : 'settings-outline',
          } as const;
          return <Ionicons name={icons[route.name]} size={23} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('tab_reading') }} />
      <Tab.Screen name="LibraryTab" component={LibraryScreen} options={{ tabBarLabel: t('tab_library') }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: t('tab_stats') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('tab_settings') }} />
    </Tab.Navigator>
  );
}
