import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { ROW_MIN, corners, radius, space, tint, type } from "@/constants/design";

/**
 * Top bar of every onboarding screen: Back on the left, page dots (the
 * explanation pages) or a progress bar (the setup steps) in the middle,
 * Skip on the right. Empty slots keep their width, so nothing jumps.
 */
export function OnboardingTopBar({
  onBack,
  onSkip,
  dots,
  progress,
}: {
  onBack?: () => void;
  onSkip?: () => void;
  dots?: { count: number; index: number };
  /** Setup progress, 0–1, with the step for VoiceOver. */
  progress?: { value: number; current: number; total: number };
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const width = useSharedValue(progress?.value ?? 0);

  useEffect(() => {
    // withTiming follows the system Reduce Motion setting.
    width.value = withTiming(progress?.value ?? 0, { duration: 350 });
  }, [progress?.value, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={[styles.bar, { paddingTop: insets.top + space[1] }]}>
      <View style={styles.side}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("onboarding.back")}>
            <Icon name="chevronBack" size={22} color={colors.accent} />
          </Pressable>
        )}
      </View>
      <View style={styles.middle}>
        {dots && (
          <View style={styles.dots} accessible accessibilityLabel={t("onboarding.page", { current: dots.index + 1, total: dots.count })}>
            {Array.from({ length: dots.count }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === dots.index ? { width: 18, backgroundColor: colors.accent } : { backgroundColor: colors.separator },
                ]}
              />
            ))}
          </View>
        )}
        {progress && (
          <View
            style={[styles.track, { backgroundColor: colors.fill }]}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t("onboarding.step", { current: progress.current, total: progress.total })}
          >
            <Animated.View style={[styles.fill, { backgroundColor: colors.accent }, fill]} />
          </View>
        )}
      </View>
      <View style={[styles.side, styles.sideRight]}>
        {onSkip && (
          <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
            <Text style={[type.body, { color: colors.accent }]}>{t("onboarding.skip")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** The bottom of every screen: one primary action and an optional quiet one. */
export function OnboardingFooter({
  primary,
  secondary,
}: {
  primary: { title: string; onPress: () => void; disabled?: boolean; icon?: IconName };
  secondary?: { title: string; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
      <Button title={primary.title} onPress={primary.onPress} disabled={primary.disabled} icon={primary.icon} />
      {secondary && <Button title={secondary.title} variant="plain" onPress={secondary.onPress} />}
    </View>
  );
}

/** Setup-step heading: a tinted symbol tile, a title and one line of why. */
export function StepHeading({ icon, color, title, body }: { icon: IconName; color: string; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.heading}>
      <View style={[styles.headingTile, { backgroundColor: tint(color, "soft") }]}>
        <Icon name={icon} size={28} color={color} />
      </View>
      <Text style={[type.title1, styles.center, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[type.body, styles.center, { color: colors.textSecondary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar:         { flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], paddingBottom: space[2], minHeight: ROW_MIN },
  side:        { width: 84, minHeight: ROW_MIN, justifyContent: "center" },
  sideRight:   { alignItems: "flex-end" },
  back:        { width: ROW_MIN, height: ROW_MIN, justifyContent: "center", marginLeft: -space[2], paddingLeft: space[2] },
  middle:      { flex: 1, alignItems: "center" },
  dots:        { flexDirection: "row", gap: 6, alignItems: "center" },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  track:       { width: "100%", maxWidth: 160, height: 4, borderRadius: 2, overflow: "hidden" },
  fill:        { height: 4, borderRadius: 2 },
  footer:      { paddingHorizontal: space[4], paddingTop: space[3], gap: space[1] },
  heading:     { alignItems: "center", gap: space[3], paddingHorizontal: space[2] },
  headingTile: { width: 64, height: 64, alignItems: "center", justifyContent: "center", marginBottom: space[1], ...corners(radius.lg) },
  center:      { textAlign: "center" },
});
