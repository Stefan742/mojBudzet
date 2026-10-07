import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { corners, radius, space, type } from "@/constants/design";
import { useTheme } from "@/hooks/useTheme";

/**
 * iOS grouped section: optional uppercase header, a rounded card, optional
 * footer. Flat (no shadow): the card stands apart from the grouped
 * background by colour, as in iOS Settings.
 */
export function Section({
  title,
  footer,
  footerColor,
  children,
  style,
  cardStyle,
}: {
  title?: string;
  footer?: string | null;
  /** For an error footer. */
  footerColor?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={style}>
      {title ? (
        <Text style={[type.sectionHeader, styles.header, { color: colors.textSecondary }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.card }, cardStyle]}>{children}</View>
      {footer ? (
        <Text style={[type.footnote, styles.footer, { color: footerColor ?? colors.textSecondary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

/** Hairline between rows, inset from the leading edge like iOS lists. */
export function Separator({ inset = space[4] }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, marginLeft: inset, backgroundColor: colors.separator }} />;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space[4], marginBottom: space[2] },
  card: { overflow: "hidden", ...corners(radius.lg) },
  footer: { paddingHorizontal: space[4], marginTop: space[2] },
});
