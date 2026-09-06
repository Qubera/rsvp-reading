import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DocumentType } from '../../core/models/types';

const TYPE_STYLE: Record<DocumentType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  book: { icon: 'book', color: '#8B7CF6', bg: 'rgba(139, 124, 246, 0.16)' },
  article: { icon: 'globe-outline', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.14)' },
  pdf: { icon: 'document-text', color: '#F4574D', bg: 'rgba(244, 87, 77, 0.14)' },
  text: { icon: 'create-outline', color: '#F5A623', bg: 'rgba(245, 166, 35, 0.14)' },
};

export function DocumentTypeIcon({ type, size = 48 }: { type: DocumentType; size?: number }) {
  const s = TYPE_STYLE[type];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: s.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={s.icon} size={Math.round(size * 0.48)} color={s.color} />
    </View>
  );
}
