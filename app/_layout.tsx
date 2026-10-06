// Must stay the first import: uuid needs the crypto.getRandomValues polyfill (S-9).
import 'react-native-get-random-values';
import { useSyncExternalStore } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { ThemeProvider } from '@/components/ThemeProvider';
import LoadingScreen from '@/components/LoadingScreen';
import { useTheme } from '@/hooks/useTheme';

const subscribeHydration = (onChange: () => void) => useAppStore.persist.onFinishHydration(onChange);
const getHydrated = () => useAppStore.persist.hasHydrated();

export default function RootLayout() {
  // Nothing that reads saved data renders before it has loaded (D-4). The
  // saved language is applied during hydration, before this first render (B-3).
  const hydrated    = useSyncExternalStore(subscribeHydration, getHydrated);
  const isOnboarded = useAppStore((s) => s.isOnboarded);

  return (
    <ThemeProvider>
      {hydrated ? (
        // Protected routes redirect synchronously once isOnboarded is known,
        // so returning users never see onboarding flash (B-4).
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={isOnboarded}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
          <Stack.Protected guard={!isOnboarded}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
        </Stack>
      ) : (
        <LoadingScreen />
      )}
    </ThemeProvider>
  );
}

/** Shown instead of a white screen if a render error escapes a screen (R-10). */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.errorRoot, { backgroundColor: colors.background }]}>
      <Text style={[styles.errorTitle, { color: colors.text }]} accessibilityRole="header">
        {t('error.title')}
      </Text>
      <Text style={[styles.errorText, { color: colors.textSecondary }]}>{t('error.body')}</Text>
      <TouchableOpacity
        style={[styles.errorButton, { backgroundColor: colors.accent }]}
        onPress={retry}
        accessibilityRole="button"
      >
        <Text style={[styles.errorButtonText, { color: colors.onAccent }]}>{t('error.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  errorRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  errorTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  errorButton: { marginTop: 12, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, minHeight: 44 },
  errorButtonText: { fontSize: 16, fontWeight: '600' },
});
