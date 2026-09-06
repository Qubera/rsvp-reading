import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { Literata_400Regular, Literata_700Bold } from '@expo-google-fonts/literata';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { I18nProvider, useI18n } from '../core/i18n/I18nProvider';
import { ThemeProvider, useTheme, UI_FONT_MEDIUM } from '../ui/theme/ThemeProvider';
import { useAppStore } from './stores/appStore';
import { useSettingsStore } from './stores/settingsStore';
import { useReaderStore } from './stores/readerStore';
import { useToast, ToastHost } from '../ui/components';
import { RootNavigator } from './navigation/RootNavigator';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const FONT_MAP = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
  Literata_400Regular,
  Literata_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
};

function Root() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ready = useAppStore((s) => s.ready);
  const onboarded = useSettingsStore((s) => s.settings.onboarded);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  // гейт онбординга: ждать загрузки настроек, чтобы не мигнуть
  useEffect(() => {
    if (ready && showOnboarding === null) setShowOnboarding(!onboarded);
  }, [ready, onboarded, showOnboarding]);

  // Фон: пауза и сохранение
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        useReaderStore.getState().flush();
      }
    });
    return () => sub.remove();
  }, []);

  const navTheme = useMemo(() => {
    const base = colors.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.bg,
        card: colors.tabBar,
        text: colors.text,
        border: colors.border,
        primary: colors.accent,
      },
      fonts: {
        ...base.fonts,
        regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' as const },
        medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' as const },
        bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' as const },
        heavy: { fontFamily: 'Inter_700Bold', fontWeight: '700' as const },
      },
    };
  }, [colors]);

  if (!ready || showOnboarding === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style={colors.isDark ? 'light' : 'dark'} />
        <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 14 }}>
          {t('common_loading')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      {showOnboarding ? (
        <OnboardingScreen onDone={() => setShowOnboarding(false)} />
      ) : (
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
      )}
      <ToastHost />
    </>
  );
}

export function AppRoot() {
  const [fontsLoaded] = useFonts(FONT_MAP);

  // запрет выделения текста при перетаскивании пальцем/мышью (web);
  // поля ввода остаются выделяемыми
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent =
      '*, *::before, *::after { -webkit-user-select: none; -moz-user-select: none; user-select: none; }' +
      'input, textarea { -webkit-user-select: text; -moz-user-select: text; user-select: text; }';
    document.head.appendChild(style);
  }, []);

  const init = useAppStore((s) => s.init);
  const ready = useAppStore((s) => s.ready);
  const toast = useToast((s) => s.show);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (fontsLoaded && ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, ready]);

  useEffect(() => {
    // сообщения об ошибках хранилища
    // (глобальный обработчик обещаний не нужен — репозитории падают в UI-тосты)
    void toast;
  }, [toast]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <Root />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
