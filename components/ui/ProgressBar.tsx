import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";

const HEIGHT = 6;

/** One progress bar for goals and budgets: 6 pt, rounded, on the fill track. */
export function ProgressBar({ progress, color }: { progress: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.fill }]}>
      <View style={[styles.fill, { width: `${Math.min(1, Math.max(0, progress)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: HEIGHT, borderRadius: HEIGHT / 2, overflow: "hidden" },
  fill: { height: HEIGHT, borderRadius: HEIGHT / 2 },
});
