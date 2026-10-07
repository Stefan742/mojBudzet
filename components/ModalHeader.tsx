import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ROW_MIN, space, type } from "@/constants/design";

/**
 * Cancel / title / Save row for page-sheet editors, iOS style: plain text
 * buttons in the accent colour, bold confirm. iOS page sheets sit below the
 * status bar already; Android shows the modal full-screen, so the top inset
 * is added there (B-10).
 */
export function ModalHeader({
  title,
  cancelLabel,
  saveLabel,
  onCancel,
  onSave,
  saveDisabled = false,
}: {
  title: string;
  cancelLabel: string;
  saveLabel?: string;
  onCancel: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const paddingTop = space[2] + (Platform.OS === "android" ? insets.top : 0);

  return (
    <View style={[styles.header, { backgroundColor: colors.background, paddingTop }]}>
      <Pressable onPress={onCancel} style={styles.side} accessibilityRole="button" hitSlop={4}>
        <Text style={[type.body, { color: colors.accent }]}>{cancelLabel}</Text>
      </Pressable>
      <Text style={[type.headline, styles.title, { color: colors.text }]} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideRight]}>
        {saveLabel && onSave ? (
          <Pressable
            onPress={onSave}
            disabled={saveDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: saveDisabled }}
            hitSlop={4}
          >
            <Text style={[type.headline, { color: saveDisabled ? colors.placeholder : colors.accent }]}>{saveLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], paddingBottom: space[2] },
  side: { minHeight: ROW_MIN, minWidth: 72, justifyContent: "center" },
  sideRight: { alignItems: "flex-end" },
  title: { flex: 1, textAlign: "center" },
});
