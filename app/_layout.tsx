// Must stay the first import: uuid needs the crypto.getRandomValues polyfill (S-9).
import 'react-native-get-random-values';
import { useSyncExternalStore } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import {
  Stack,
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { ThemeProvider } from '@/components/ThemeProvider';
import LoadingScreen from '@/components/LoadingScreen';
import { ToastHost } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/Icon';
import { space, type } from '@/constants/design';
import { useTheme } from '@/hooks/useTheme';
import { useLargeTitleOptions } from '@/hooks/useLargeTitleOptions';

const subscribeHydration = (onChange: () => void) => useAppStore.persist.onFinishHydration(onChange);
const getHydrated = () => useAppStore.persist.hasHydrated();

export default function RootLayout() {
  // Nothing that reads saved data renders before it has loaded (D-4). The
  // saved language is applied during hydration, before this first render (B-3).
  const hydrated    = useSyncExternalStore(subscribeHydration, getHydrated);
  const isOnboarded = useAppStore((s) => s.isOnboarded);
  const { t }       = useTranslation();
  const { colors, isDark } = useTheme();
  const headerOptions = useLargeTitleOptions();

  // Native navigation (tabs, headers) draws with the app's colours, so there
  // is no white flash behind the iOS 26 tab bar in dark mode.
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.separator,
    },
  };

  return (
    <ThemeProvider>
      {hydrated ? (
        // Protected routes redirect synchronously once isOnboarded is known,
        // so returning users never see onboarding flash (B-4).
        <NavigationThemeProvider value={navTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={isOnboarded}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
          <Stack.Protected guard={!isOnboarded}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Screen
            name="privacy"
            options={{ ...headerOptions, headerShown: true, title: t('privacy.title') }}
          />
        </Stack>
        <ToastHost />
        </NavigationThemeProvider>
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
      <Icon name="warning" size={44} color={colors.warning} />
      <Text style={[type.title2, styles.center, { color: colors.text }]} accessibilityRole="header">
        {t('error.title')}
      </Text>
      <Text style={[type.body, styles.center, { color: colors.textSecondary }]}>{t('error.body')}</Text>
      <Button title={t('error.retry')} onPress={retry} style={styles.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  errorRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[8], gap: space[3] },
  center: { textAlign: 'center' },
  retry: { marginTop: space[3], alignSelf: 'stretch' },
});
