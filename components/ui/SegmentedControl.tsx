import React, { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { corners, elevation, radius, type } from "@/constants/design";
import { useMotion } from "@/hooks/useMotion";
import { useTheme } from "@/hooks/useTheme";
import { haptics } from "@/utils/haptics";

/**
 * iOS-style segmented control: neutral track, a raised thumb that slides to
 * the selected segment, label-coloured text (DESIGN.md §3.9).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();
  const { spring } = useMotion();
  const [width, setWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width > 0 ? (width - 4) / options.length : 0;

  useEffect(() => {
    if (segment > 0) spring(x, index * segment, "snappy").start();
    // spring is recreated each render; only the target matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, segment, x]);

  return (
    <View
      style={[styles.track, { backgroundColor: colors.fill }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {segment > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            { width: segment, backgroundColor: isDark ? "#636366" : "#FFFFFF", transform: [{ translateX: x }] },
            elevation.raised(isDark),
          ]}
        />
      )}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={styles.segment}
            onPress={() => {
              if (!selected) {
                haptics.selection();
                onChange(o.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[type.subheadline, { color: colors.text, fontWeight: selected ? "600" : "500" }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 2, minHeight: 36, ...corners(radius.sm) },
  thumb: { position: "absolute", top: 2, bottom: 2, left: 2, ...corners(radius.sm - 2) },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 32, paddingHorizontal: 8 },
});
