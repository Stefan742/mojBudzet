import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { Icon } from "@/components/Icon";
import { dateLocale, formatDate } from "@/utils/dates";
import { ROW_MIN, corners, radius, space, type } from "@/constants/design";

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
        <Text style={[type.body, { color: colors.text }]}>{label}</Text>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
          locale={dateLocale(i18n.language)}
          themeVariant={isDark ? "dark" : "light"}
          accentColor={colors.accent}
          accessibilityLabel={label}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable
        style={styles.row}
        onPress={() => setShowAndroidPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value, i18n.language)}`}
      >
        <Text style={[type.body, { color: colors.text }]}>{label}</Text>
        <View style={[styles.androidValue, { backgroundColor: colors.fill }]}>
          <Icon name="calendar" size={16} color={colors.accent} />
          <Text style={[type.subheadline, { color: colors.text }]}>{formatDate(value, i18n.language)}</Text>
        </View>
      </Pressable>
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
    paddingHorizontal: space[4],
    paddingVertical: space[1] + 2,
    minHeight: ROW_MIN + 4,
  },
  androidValue: { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], paddingVertical: space[2], ...corners(radius.sm) },
});
