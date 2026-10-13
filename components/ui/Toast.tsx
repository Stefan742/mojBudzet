import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSurface } from "./GlassSurface";
import { Icon } from "@/components/Icon";
import { corners, elevation, radius, space, type } from "@/constants/design";
import { useMotion } from "@/hooks/useMotion";
import { useTheme } from "@/hooks/useTheme";
import { useSession } from "@/store/session";

const HIDDEN_Y = -160;
const VISIBLE_MS = 2200;
/** Longer when there is a button to reach (Undo). */
const VISIBLE_WITH_ACTION_MS = 5000;
/** About how long the standard spring takes to slide in or out. */
const SLIDE_MS = 450;

/**
 * The one toast of the app, mounted once at the root so it shows above the
 * native tab bar and survives closing sheets. Call showToast() from
 * store/session. A glass pill slides down; only translation is animated,
 * never opacity, which would break the glass (DESIGN.md §3.6). With Reduce
 * Motion it simply appears and disappears.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { spring, reduceMotion } = useMotion();
  const toast = useSession((s) => s.toast);
  const clearToast = useSession((s) => s.clearToast);
  const [y] = useState(() => new Animated.Value(HIDDEN_Y));

  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(toast.message);
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (reduceMotion) y.setValue(0);
    else {
      y.setValue(HIDDEN_Y);
      spring(y, 0, "standard").start();
    }
    // Visible time is counted from when the slide-in is done, and removal is
    // timed rather than tied to the animation's end callback, which may not
    // fire if the spring settles short of its target.
    timers.push(
      setTimeout(() => {
        if (!reduceMotion) spring(y, HIDDEN_Y, "standard").start();
        timers.push(setTimeout(() => clearToast(toast.id), reduceMotion ? 0 : SLIDE_MS));
      }, (reduceMotion ? 0 : SLIDE_MS) + (toast.action ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS))
    );
    return () => timers.forEach(clearTimeout);
    // spring is recreated each render; a new toast id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents={toast.action ? "box-none" : "none"}
      style={[styles.wrap, { top: insets.top + space[2], transform: [{ translateY: y }] }]}
    >
      <View style={[elevation.floating(isDark), corners(radius.pill)]}>
        <GlassSurface style={styles.pill} tinted>
          <Icon name={toast.icon} size={18} color={toast.color ?? colors.success} />
          <Text style={[type.subheadline, styles.text, { color: colors.text }]} numberOfLines={2}>
            {toast.message}
          </Text>
          {toast.action && (
            <Pressable
              onPress={() => {
                toast.action?.onPress();
                clearToast(toast.id);
              }}
              hitSlop={12}
              accessibilityRole="button"
            >
              <Text style={[type.subheadline, styles.text, { color: colors.accent }]}>{toast.action.label}</Text>
            </Pressable>
          )}
        </GlassSurface>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: space[4], right: space[4], alignItems: "center", zIndex: 1000 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    ...corners(radius.pill),
  },
  text: { fontWeight: "600", flexShrink: 1 },
});
