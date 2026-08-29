import 'react-native-get-random-values';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useAppStore } from '@/store/useAppStore';
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect, useState } from 'react';
import i18n from '@/i18n'; // ← додај

export const unstable_settings = { anchor: '(tabs)' };

function RouteGuard() {
  const isOnboarded = useAppStore((s) => s.isOnboarded);
  const router      = useRouter();
  const segments    = useSegments();

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!isOnboarded && !inOnboarding) {
      router.replace('/onboarding');
    } else if (isOnboarded && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [ready, isOnboarded, segments]);

  return null;
}

export default function RootLayout() {
  const language = useAppStore((s) => s.language); // ← додај

  // Примени зачуваниот јазик при секој старт
  useEffect(() => {
    if (language) i18n.changeLanguage(language);
  }, []); // ← само при mount, не при секоја промена

  return (
    <ThemeProvider>
      <RouteGuard />
      <Stack>
        <Stack.Screen name="(tabs)"     options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="modal"      options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}