import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { MIN_TOUCH } from "@/constants/layout";

/**
 * Cancel / title / Save row for page-sheet modals. iOS page sheets already
 * sit below the status bar; Android shows the modal full-screen, so the top
 * inset is added there (B-10).
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
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const paddingTop = 8 + (Platform.OS === "android" ? insets.top : 0);

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.background, borderBottomColor: colors.separator, paddingTop },
      ]}
    >
      <TouchableOpacity onPress={onCancel} style={styles.side} accessibilityRole="button">
        <Text style={[styles.cancel, { color: colors.destructive }]}>{cancelLabel}</Text>
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      <TouchableOpacity
        onPress={onSave}
        disabled={saveDisabled}
        style={[styles.side, styles.sideRight]}
        accessibilityRole="button"
        accessibilityState={{ disabled: saveDisabled }}
      >
        <Text style={[styles.save, { color: colors.accent }, saveDisabled && styles.disabled]}>{saveLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: { minHeight: MIN_TOUCH, minWidth: 80, paddingHorizontal: 8, justifyContent: "center" },
  sideRight: { alignItems: "flex-end" },
  title: { flex: 1, fontSize: 17, fontWeight: "600", textAlign: "center" },
  cancel: { fontSize: 17 },
  save: { fontSize: 17, fontWeight: "600" },
  disabled: { opacity: 0.4 },
});
