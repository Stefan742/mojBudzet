import React, { useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSurface } from "./GlassSurface";
import { Icon, type IconName } from "@/components/Icon";
import { corners, elevation, radius, space, type } from "@/constants/design";
import { useMotion } from "@/hooks/useMotion";
import { useTheme } from "@/hooks/useTheme";

const HIDDEN_Y = -140;
const VISIBLE_MS = 2200;

/**
 * One toast for the whole app: a glass pill that slides down from the top,
 * announced to screen readers. Only translation is animated, never opacity,
 * because opacity breaks the glass (DESIGN.md §3.6). Reduce Motion: it just
 * appears and disappears.
 */
export function useToast() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { spring, reduceMotion } = useMotion();
  const [toast, setToast] = useState<{ message: string; icon: IconName; color?: string } | null>(null);
  const [y] = useState(() => new Animated.Value(HIDDEN_Y));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (reduceMotion) {
      setToast(null);
      return;
    }
    spring(y, HIDDEN_Y, "standard").start(() => setToast(null));
  };

  const show = (message: string, icon: IconName = "checkCircle", color?: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, icon, color });
    AccessibilityInfo.announceForAccessibility(message);
    if (reduceMotion) y.setValue(0);
    else {
      y.setValue(HIDDEN_Y);
      spring(y, 0, "standard").start();
    }
    timer.current = setTimeout(hide, VISIBLE_MS);
  };

  const node = toast ? (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + space[2], transform: [{ translateY: y }] }]}
    >
      <View style={[styles.shadowHost, elevation.floating(isDark), corners(radius.pill)]}>
        <GlassSurface style={styles.pill} tinted>
          <Icon name={toast.icon} size={18} color={toast.color ?? colors.success} />
          <Text style={[type.subheadline, styles.text, { color: colors.text }]} numberOfLines={2}>
            {toast.message}
          </Text>
        </GlassSurface>
      </View>
    </Animated.View>
  ) : null;

  return { show, node };
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: space[4], right: space[4], alignItems: "center", zIndex: 1000 },
  shadowHost: { maxWidth: "100%" },
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
