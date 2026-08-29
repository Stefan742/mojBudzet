import React from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../hooks/useTheme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDark, colors } = useTheme();

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