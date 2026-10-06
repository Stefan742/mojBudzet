import React from "react";
import { ScrollView, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";

export interface Chip {
  key: string;
  label: string;
  /** Background when selected; defaults to the accent colour. */
  color?: string;
}

/**
 * Horizontal single-select chips. Padding is on the content (not the
 * ScrollView), so the last chip is never clipped at the edge (KB-1).
 */
export function ChipRow({
  chips,
  selectedKey,
  onSelect,
  accessibilityLabel,
}: {
  chips: Chip[];
  selectedKey: string | undefined;
  onSelect: (key: string) => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((chip) => {
        const selected = chip.key === selectedKey;
        return (
          <TouchableOpacity
            key={chip.key}
            style={[styles.chip, { backgroundColor: selected ? chip.color ?? colors.accent : colors.inputBg }]}
            onPress={() => onSelect(chip.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
          >
            <Text style={[styles.text, { color: selected ? colors.onAccent : colors.text }]}>{chip.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingBottom: 12, paddingRight: 20, gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 40, justifyContent: "center", borderRadius: 20, marginTop: 4 },
  text: { fontSize: 14 },
});
