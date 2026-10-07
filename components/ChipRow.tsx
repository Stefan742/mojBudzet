import React from "react";
import { ScrollView, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { dataColor } from "@/constants/palette";
import { corners, radius, space, type } from "@/constants/design";
import { haptics } from "@/utils/haptics";

export interface Chip {
  key: string;
  label: string;
  /** Data colour (stored light value) used when selected; defaults to the accent. */
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
  const { colors, isDark } = useTheme();
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
        const fill = chip.color ? dataColor(chip.color, isDark) : colors.accent;
        return (
          <Pressable
            key={chip.key}
            style={[styles.chip, { backgroundColor: selected ? fill : colors.fill }]}
            onPress={() => {
              if (!selected) haptics.selection();
              onSelect(chip.key);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
          >
            <Text style={[type.subheadline, { color: selected ? colors.onAccent : colors.text, fontWeight: selected ? "600" : "400" }]}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[4], paddingTop: space[1], paddingBottom: space[3], gap: space[2] },
  chip: { paddingHorizontal: space[4], minHeight: 36, justifyContent: "center", ...corners(radius.pill) },
});
