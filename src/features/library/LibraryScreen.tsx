import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../ui/components/Screen';
import {
  AppTextInput,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  ProgressBar,
  Sheet,
  useToast,
} from '../../ui/components';
import { useTheme, UI_FONT_BOLD, UI_FONT_MEDIUM, UI_FONT_SEMIBOLD } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { categoryOf, useLibraryStore } from '../../app/stores/libraryStore';
import { formatNumber, wordsLabel } from '../../core/utils/format';
import type { RootStackParamList } from '../../app/navigation/RootNavigator';
import { haptic } from '../../services/haptics/Haptics';
import { DocumentTypeIcon } from './DocIcon';
import type { DocumentMeta } from '../../core/models/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Category = 'all' | 'book' | 'article' | 'pdf' | 'other';

const CATEGORY_KEYS: { key: Category; labelKey: string }[] = [
  { key: 'all', labelKey: 'library_cat_all' },
  { key: 'book', labelKey: 'library_cat_books' },
  { key: 'article', labelKey: 'library_cat_articles' },
  { key: 'pdf', labelKey: 'library_cat_pdf' },
  { key: 'other', labelKey: 'library_cat_other' },
];

export function LibraryScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const nav = useNavigation<Nav>();
  const docs = useLibraryStore((s) => s.docs);
  const removeDoc = useLibraryStore((s) => s.remove);
  const renameDoc = useLibraryStore((s) => s.rename);
  const toast = useToast((s) => s.show);

  const [category, setCategory] = useState<Category>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<DocumentMeta | null>(null);
  const [renameText, setRenameText] = useState('');

  const typeLabel = (d: DocumentMeta) =>
    t(`library_type_${d.type}` as never);

  const filtered = useMemo(() => {
    let list = docs;
    if (category !== 'all') list = list.filter((d) => categoryOf(d.type) === category);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((d) => d.title.toLowerCase().includes(q));
    return list;
  }, [docs, category, query]);

  // Подтверждение удаления и меню действий — внутри приложения
  // (нативный Alert.alert на web не работает)
  const [confirmDoc, setConfirmDoc] = useState<DocumentMeta | null>(null);
  const [actionsDoc, setActionsDoc] = useState<DocumentMeta | null>(null);

  const doDelete = async (d: DocumentMeta) => {
    setConfirmDoc(null);
    await removeDoc(d.id);
    haptic.warning();
    toast(`${d.title} — ${t('common_delete').toLowerCase()}`);
  };

  const openActions = (d: DocumentMeta) => {
    haptic.medium();
    setActionsDoc(d);
  };

  return (
    <Screen>
      {/* Заголовок */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 28, flex: 1 }}>
          {t('library_title')}
        </Text>
        <IconButton
          icon={searchOpen ? 'close' : 'search'}
          accessibilityLabel="search"
          onPress={() => {
            setSearchOpen(!searchOpen);
            if (searchOpen) setQuery('');
          }}
        />
        <IconButton
          icon="add"
          accessibilityLabel="add"
          background={colors.accent}
          tint={colors.onAccent}
          onPress={() => nav.navigate('Import')}
        />
      </View>

      {searchOpen ? (
        <View style={{ marginBottom: 14 }}>
          <AppTextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('library_search_placeholder')}
            style={{ height: 46, paddingVertical: 0 }}
          />
        </View>
      ) : null}

      {/* Категории */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {CATEGORY_KEYS.map((c) => (
          <Chip
            key={c.key}
            label={t(c.labelKey as never)}
            active={category === c.key}
            onPress={() => setCategory(c.key)}
          />
        ))}
      </View>

      {filtered.length === 0 ? (
        docs.length === 0 ? (
          <EmptyState
            icon="library-outline"
            title={t('library_empty_title')}
            text={t('library_empty_text')}
            actionLabel={t('home_add_text')}
            onAction={() => nav.navigate('Import')}
          />
        ) : (
          <EmptyState icon="search-outline" title={`${t('library_results', { n: filtered.length })}`} />
        )
      ) : (
        <View style={{ gap: 12 }}>
          {filtered.map((d) => (
            <Card
              key={d.id}
              onPress={() => nav.navigate('Document', { docId: d.id })}
              onLongPress={() => openActions(d)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
            >
              <DocumentTypeIcon type={d.type} size={52} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontFamily: UI_FONT_SEMIBOLD, fontSize: 16 }}>
                  {d.title}
                </Text>
                <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 13 }}>
                  {typeLabel(d)} · {formatNumber(d.wordCount)} {wordsLabel(d.wordCount, lang)}
                </Text>
                {d.status !== 'new' ? (
                  <View style={{ marginTop: 2, marginRight: 8 }}>
                    <ProgressBar progress={d.progress} height={4} />
                    <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 11, marginTop: 4 }}>
                      {t(`library_status_${d.status}` as never)} · {Math.round(d.progress * 100)}%
                    </Text>
                  </View>
                ) : null}
              </View>
              <IconButton
                icon="trash-outline"
                size={38}
                stopPropagation
                onPress={() => setConfirmDoc(d)}
                accessibilityLabel={t('common_delete')}
              />
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </Card>
          ))}
        </View>
      )}

      {/* Подтверждение удаления */}
      <Sheet visible={confirmDoc !== null} onClose={() => setConfirmDoc(null)} title={t('library_delete_title')}>
        <View style={{ gap: 16 }}>
          <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 14, lineHeight: 21 }}>
            {confirmDoc ? t('library_delete_text', { title: confirmDoc.title }) : ''}
          </Text>
          <View style={{ gap: 10 }}>
            <Button
              label={t('common_delete')}
              icon="trash-outline"
              variant="danger"
              onPress={async () => {
                if (confirmDoc) await doDelete(confirmDoc);
              }}
            />
            <Button label={t('common_cancel')} variant="secondary" onPress={() => setConfirmDoc(null)} />
          </View>
        </View>
      </Sheet>

      {/* Меню действий по документу */}
      <Sheet visible={actionsDoc !== null} onClose={() => setActionsDoc(null)} title={actionsDoc?.title ?? ''}>
        <View style={{ gap: 10 }}>
          <Button
            label={t('common_rename')}
            icon="pencil-outline"
            variant="secondary"
            onPress={() => {
              if (actionsDoc) {
                setRenameText(actionsDoc.title);
                setRenaming(actionsDoc);
              }
              setActionsDoc(null);
            }}
          />
          <Button
            label={t('common_delete')}
            icon="trash-outline"
            variant="danger"
            onPress={() => {
              setConfirmDoc(actionsDoc);
              setActionsDoc(null);
            }}
          />
        </View>
      </Sheet>

      {/* Переименование */}
      <Sheet visible={renaming !== null} onClose={() => setRenaming(null)} title={t('library_rename_title')}>
        <View style={{ gap: 14 }}>
          <AppTextInput value={renameText} onChangeText={setRenameText} placeholder={t('library_rename_placeholder')} />
          <Button
            label={t('common_save')}
            icon="checkmark"
            onPress={async () => {
              if (renaming && renameText.trim()) {
                await renameDoc(renaming.id, renameText);
                toast(t('common_save'));
              }
              setRenaming(null);
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
