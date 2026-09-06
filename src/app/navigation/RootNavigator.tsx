import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs, type TabParamList } from './MainTabs';
import { LibraryScreen } from '../../features/library/LibraryScreen';
import { DocumentScreen } from '../../features/library/DocumentScreen';
import { ImportScreen } from '../../features/import_/ImportScreen';
import { CameraOcrScreen } from '../../features/import_/CameraOcrScreen';
import { ReaderScreen } from '../../features/reader/ReaderScreen';
import { FullTextScreen } from '../../features/reader/FullTextScreen';

export type RootStackParamList = {
  Tabs: undefined;
  Document: { docId: string };
  Import: undefined;
  CameraOcr: undefined;
  Reader: { docId: string; from?: number; to?: number; ts?: number };
  FullText: { docId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Document" component={DocumentScreen} />
      <Stack.Screen name="Import" component={ImportScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="CameraOcr" component={CameraOcrScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen
        name="Reader"
        component={ReaderScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <Stack.Screen name="FullText" component={FullTextScreen} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}

export type { TabParamList };
