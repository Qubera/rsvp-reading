import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTextInput, Button, Card, SectionTitle, Sheet, useToast } from '../../ui/components';
import { useTheme, UI_FONT_BOLD, UI_FONT_MEDIUM, UI_FONT_SEMIBOLD } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { useLibraryStore } from '../../app/stores/libraryStore';
import { useSettingsStore } from '../../app/stores/settingsStore';
import {
  ImportError,
  importClipboardFlow,
  importPickedFile,
  importTypedFlow,
  importUrlFlow,
} from '../../data/importers/ImportService';
import type { RootStackParamList } from '../../app/navigation/RootNavigator';
import { haptic } from '../../services/haptics/Haptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ImportScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const addDoc = useLibraryStore((s) => s.upsert);
  const toast = useToast((s) => s.show);

  const [busy, setBusy] = useState<null | 'file' | 'url' | 'clipboard' | 'paste'>(null);
  const [urlSheet, setUrlSheet] = useState(false);
  const [url, setUrl] = useState('');
  const [pasteSheet, setPasteSheet] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');

  const errText = (e: unknown): string => {
    if (e instanceof ImportError) {
      const key = `import_err_${e.code}` as const;
      return t(key as never);
    }
    return t('common_error');
  };

  const finish = (title: string) => {
    haptic.success();
    toast(t('import_success', { title }));
    nav.goBack();
  };

  const doFile = async () => {
    setBusy('file');
    try {
      const doc = await importPickedFile();
      addDoc(doc);
      finish(doc.title);
    } catch (e) {
      if (e instanceof ImportError && e.code === 'PICK_CANCELED') return;
      haptic.warning();
      toast(errText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const doUrl = async () => {
    setUrlSheet(false);
    setBusy('url');
    try {
      const doc = await importUrlFlow(url);
      addDoc(doc);
      finish(doc.title);
    } catch (e) {
      haptic.warning();
      toast(errText(e), 'error');
    } finally {
      setBusy(null);
      setUrl('');
    }
  };

  const doClipboard = async () => {
    setBusy('clipboard');
    try {
      const doc = await importClipboardFlow();
      addDoc(doc);
      finish(doc.title);
    } catch (e) {
      haptic.warning();
      toast(errText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const doPaste = async () => {
    setPasteSheet(false);
    setBusy('paste');
    try {
      const doc = await importTypedFlow(pasteTitle, pasteText);
      addDoc(doc);
      finish(doc.title);
    } catch (e) {
      haptic.warning();
      toast(errText(e), 'error');
    } finally {
      setBusy(null);
      setPasteTitle('');
      setPasteText('');
    }
  };

  const options: {
    key: 'file' | 'url' | 'clipboard' | 'camera' | 'paste';
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    hint: string;
    onPress: () => void;
  }[] = [
    { key: 'file', icon: 'document-outline', title: t('import_file'), hint: t('import_file_hint'), onPress: doFile },
    { key: 'url', icon: 'link-outline', title: t('import_web'), hint: t('import_web_hint'), onPress: () => setUrlSheet(true) },
    { key: 'clipboard', icon: 'clipboard-outline', title: t('import_clipboard'), hint: t('import_clipboard_hint'), onPress: doClipboard },
    { key: 'camera', icon: 'camera-outline', title: t('import_camera'), hint: t('import_camera_hint'), onPress: () => nav.navigate('CameraOcr') },
    { key: 'paste', icon: 'create-outline', title: t('import_paste_title'), hint: t('import_paste_placeholder_text'), onPress: () => setPasteSheet(true) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ width: 38, height: 38, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 22 }}>{t('import_title')}</Text>
      </View>

      <View style={{ paddingHorizontal: 20, flex: 1 }}>
        <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 14, marginTop: 4, marginBottom: 18 }}>
          {t('library_empty_text')}
        </Text>

        <View style={{ gap: 12 }}>
          {options.map((o) => (
            <Card key={o.key} onPress={o.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={o.icon} size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontFamily: UI_FONT_SEMIBOLD, fontSize: 16 }}>{o.title}</Text>
                <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                  {o.hint}
                </Text>
              </View>
              {busy === o.key ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              )}
            </Card>
          ))}
        </View>

        {busy ? (
          <View style={{ alignItems: 'center', marginTop: 24, gap: 8 }}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 13 }}>
              {t('import_importing')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* URL-шид */}
      <Sheet visible={urlSheet} onClose={() => setUrlSheet(false)} title={t('import_web')}>
        <View style={{ gap: 14 }}>
          <AppTextInput
            value={url}
            onChangeText={setUrl}
            placeholder={t('import_url_placeholder')}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
          <Button label={t('import_button')} icon="globe-outline" onPress={doUrl} disabled={!url.trim()} />
        </View>
      </Sheet>

      {/* Ручной ввод */}
      <Sheet visible={pasteSheet} onClose={() => setPasteSheet(false)} title={t('import_paste_title')}>
        <View style={{ gap: 14 }}>
          <AppTextInput value={pasteTitle} onChangeText={setPasteTitle} placeholder={t('import_paste_placeholder_title')} />
          <AppTextInput
            value={pasteText}
            onChangeText={setPasteText}
            placeholder={t('import_paste_placeholder_text')}
            multiline
            style={{ minHeight: 180 }}
          />
          <Button
            label={t('import_from_clipboard_btn')}
            variant="secondary"
            icon="clipboard-outline"
            onPress={async () => {
              const Clipboard = await import('expo-clipboard');
              const s = await Clipboard.getStringAsync();
              if (s) setPasteText(s);
            }}
          />
          <Button label={t('import_button')} icon="checkmark" onPress={doPaste} disabled={pasteText.trim().length < 3} />
        </View>
      </Sheet>
    </View>
  );
}
