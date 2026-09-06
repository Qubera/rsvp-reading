import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: padded ? 20 : 0,
            paddingTop: 8,
            paddingBottom: insets.bottom + 32,
          }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: padded ? 20 : 0 }}>{children}</View>
      )}
    </View>
  );
}
