import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { useTheme } from "@/hooks/useTheme";
import { useReduceTransparency } from "@/hooks/useReduceTransparency";

/**
 * Glass for floating controls only, never content cards (DESIGN.md §3.6).
 *
 * - iOS 26+: native Liquid Glass (UIGlassEffect), optional tint for
 *   legibility over dense content.
 * - Older iOS / Android: chrome blur + 50% surface overlay + hairline.
 * - Reduce Transparency: an opaque surface with a hairline.
 *
 * Rules: never put opacity < 1 on this view or a parent (the glass stops
 * rendering), never overflow: "hidden" on it, mount it only while visible.
 */
export function GlassSurface({
  style,
  tinted = false,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  /** Add a surface tint for legibility over busy content. */
  tinted?: boolean;
  children: React.ReactNode;
}) {
  const { isDark, colors } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const hairline = { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator };

  if (reduceTransparency) {
    return <View style={[style, { backgroundColor: colors.surfaceRaised }, hairline]}>{children}</View>;
  }

  if (isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        style={style}
        glassEffectStyle="regular"
        colorScheme={isDark ? "dark" : "light"}
        tintColor={tinted ? (isDark ? "rgba(28,28,30,0.65)" : "rgba(255,255,255,0.65)") : undefined}
      >
        {children}
      </GlassView>
    );
  }

  const flat = StyleSheet.flatten(style) ?? {};
  return (
    <View style={[style, { overflow: "hidden" }, hairline]}>
      <BlurView
        intensity={100}
        tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? "rgba(44,44,46,0.5)" : "rgba(255,255,255,0.5)", borderRadius: flat.borderRadius },
        ]}
      />
      {children}
    </View>
  );
}
