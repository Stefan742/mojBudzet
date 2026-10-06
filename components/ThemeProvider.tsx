import React, { useEffect } from "react";
import { Appearance, View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../hooks/useTheme";
import { useAppStore } from "../store/useAppStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDark, colors } = useTheme();
  const theme = useAppStore((s) => s.theme);

  // Native pieces (alerts, date pickers, keyboard, page sheets) follow the
  // in-app theme choice instead of the system one (U-6).
  useEffect(() => {
    Appearance.setColorScheme(theme === "system" ? "unspecified" : theme);
  }, [theme]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
