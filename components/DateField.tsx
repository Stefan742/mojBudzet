import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { dateLocale, formatDate } from "@/utils/dates";
import { MIN_TOUCH } from "@/constants/layout";

/** Date row with the native picker, in the app language and theme (D-7, I-5). */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const { i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowAndroidPicker(false);
    if (event.type === "dismissed" || !date) return;
    onChange(date);
  };

  if (Platform.OS === "ios") {
    return (
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
          locale={dateLocale(i18n.language)}
          themeVariant={isDark ? "dark" : "light"}
          accessibilityLabel={label}
        />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={() => setShowAndroidPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value, i18n.language)}`}
      >
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <View style={[styles.androidValue, { backgroundColor: colors.accent + "18" }]}>
          <Ionicons name="calendar-outline" size={16} color={colors.accent} />
          <Text style={[styles.androidText, { color: colors.accent }]}>{formatDate(value, i18n.language)}</Text>
        </View>
      </TouchableOpacity>
      {showAndroidPicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display="calendar"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
    minHeight: MIN_TOUCH + 8,
  },
  label: { fontSize: 16 },
  androidValue: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  androidText: { fontSize: 14, fontWeight: "500" },
});
