/**
 * Камера → фото → попытка распознавания через OcrEngine.
 * Если движок недоступен (Expo Go) — честно сообщаем и предлагаем
 * вставить текст из буфера. Архитектура: достаточно подставить
 * реализацию OcrEngine (см. services/ocr/OcrService.ts).
 */

import React, { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, useToast } from '../../ui/components';
import { useTheme, UI_FONT_BOLD, UI_FONT_MEDIUM, UI_FONT_SEMIBOLD } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { ocrEngine, OcrUnavailableError } from '../../services/ocr/OcrService';
import type { RootStackParamList } from '../../app/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CameraOcrScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const toast = useToast((s) => s.show);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const capture = async () => {
    setOcrError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: false, quality: 0.8 });
      if (photo?.uri) setShot(photo.uri);
    } catch {
      toast(t('common_error'), 'error');
    }
  };

  const recognize = async () => {
    if (!shot) return;
    setBusy(true);
    try {
      const res = await ocrEngine.recognize(shot);
      // успех: импортируем как текст
      const { importTypedFlow } = await import('../../data/importers/ImportService');
      const { useLibraryStore } = await import('../../app/stores/libraryStore');
      const doc = await importTypedFlow(t('import_ocr_title'), res.text);
      useLibraryStore.getState().upsert(doc);
      nav.goBack();
    } catch (e) {
      if (e instanceof OcrUnavailableError) {
        setOcrError(t('import_ocr_unavailable_text'));
      } else {
        setOcrError(t('common_error'));
      }
    } finally {
      setBusy(false);
    }
  };

  const granted = permission?.granted ?? false;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Превью камеры / фото */}
      <View style={{ flex: 1 }}>
        {!granted ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <Ionicons name="camera-outline" size={56} color={colors.textTertiary} />
            <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 17, textAlign: 'center' }}>
              {t('import_camera_permission')}
            </Text>
            <View style={{ alignSelf: 'stretch' }}>
              <Button label={t('import_camera_grant')} icon="shield-checkmark-outline" onPress={() => requestPermission()} />
            </View>
          </View>
        ) : shot ? (
          <Pressable style={{ flex: 1 }} onPress={() => setShot(null)}>
            {Platform.OS === 'web' ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="image-outline" size={64} color={colors.textTertiary} />
              </View>
            ) : null}
          </Pressable>
        ) : (
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        )}
      </View>

      {/* Нижняя панель */}
      <View
        style={{
          backgroundColor: colors.tabBar,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 20,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={8}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={{ flex: 1, color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 17 }}>
            {t('import_ocr_title')}
          </Text>
        </View>

        <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 13, lineHeight: 19 }}>
          {ocrError ?? t('import_ocr_hint')}
        </Text>

        {!shot ? (
          <View style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Pressable
              onPress={capture}
              accessibilityRole="button"
              accessibilityLabel={t('import_ocr_capture')}
              style={{
                width: 72,
                height: 72,
                borderRadius: 999,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 4,
                borderColor: colors.accentSoft,
              }}
            >
              <Ionicons name="camera" size={30} color={colors.onAccent} />
            </Pressable>
            <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12, marginTop: 8 }}>
              {t('import_ocr_capture')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Card style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="image-outline" size={22} color={colors.accent} />
              <Text style={{ flex: 1, color: colors.text, fontFamily: UI_FONT_SEMIBOLD, fontSize: 14 }}>
                {shot.split('/').pop()}
              </Text>
              <Pressable onPress={() => setShot(null)} hitSlop={6}>
                <Text style={{ color: colors.accent, fontFamily: UI_FONT_MEDIUM, fontSize: 14 }}>
                  {t('import_ocr_retake')}
                </Text>
              </Pressable>
            </Card>
            <Button
              label={t('import_ocr_try_recognize')}
              icon="scan-outline"
              onPress={recognize}
              loading={busy}
            />
          </View>
        )}
      </View>
    </View>
  );
}
