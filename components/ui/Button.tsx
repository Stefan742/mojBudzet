import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { PressableScale } from "./Pressables";
import { Icon, type IconName } from "@/components/Icon";
import { corners, radius, space, tint, type } from "@/constants/design";
import { useTheme } from "@/hooks/useTheme";
import { haptics } from "@/utils/haptics";

/**
 * The one button (DESIGN.md §3.9): filled, tinted or plain, optionally
 * destructive. 50 pt tall, headline text, continuous corners.
 */
export function Button({
  title,
  onPress,
  variant = "filled",
  destructive = false,
  disabled = false,
  icon,
  style,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  variant?: "filled" | "tinted" | "plain";
  destructive?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const base = destructive ? colors.destructive : colors.accent;

  const background =
    disabled ? colors.fill
    : variant === "filled" ? base
    : variant === "tinted" ? tint(base, "subtle")
    : "transparent";
  const foreground = disabled ? colors.placeholder : variant === "filled" ? colors.onAccent : base;

  return (
    <PressableScale
      onPress={() => {
        if (variant === "filled") haptics.light();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      style={[styles.button, { backgroundColor: background }, variant === "plain" && styles.plain, style]}
    >
      <View style={styles.content}>
        {icon && <Icon name={icon} size={18} color={foreground} />}
        <Text style={[type.headline, { color: foreground }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: space[5], justifyContent: "center", ...corners(radius.md) },
  plain: { minHeight: 44 },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] },
});
