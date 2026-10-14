import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { SvgXml } from "react-native-svg";
import { useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { bill1Svg, bill2Svg, logoColors, walletSvg } from "@/components/logoSvg";

const LOGO_W = 132;
const LOGO_H = 177;
const DUR    = 2400;

/** Runs a looping animation while mounted and stops it on unmount (P-6). */
function useLoop(make: () => Animated.CompositeAnimation, enabled: boolean) {
  const [animation] = useState(make);
  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(animation);
    loop.start();
    return () => loop.stop();
  }, [animation, enabled]);
}

// ─── Dot ──────────────────────────────────────────────────────────────────────
function Dot({ delay, color, animate }: { delay: number; color: string; animate: boolean }) {
  const [anim] = useState(() => new Animated.Value(0));

  useLoop(
    () =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 380, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.delay(840 - delay),
      ]),
    animate
  );

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.65] }),
        },
      ]}
    />
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
/** Shown while saved data loads from storage. Honours Reduce Motion. */
export default function LoadingScreen() {
  const { t } = useTranslation();
  const { isDark, colors } = useTheme();
  const animate = !useReducedMotion();

  const [billsProgress] = useState(() => new Animated.Value(0));
  const [logoScale] = useState(() => new Animated.Value(1));
  const smooth = Easing.bezier(0.37, 0, 0.63, 1);

  useLoop(
    () =>
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.045, duration: DUR / 2, easing: smooth, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: DUR / 2, easing: smooth, useNativeDriver: true }),
      ]),
    animate
  );
  useLoop(
    () =>
      Animated.sequence([
        Animated.timing(billsProgress, { toValue: 1, duration: DUR * 0.46, easing: smooth, useNativeDriver: true }),
        Animated.timing(billsProgress, { toValue: 0, duration: DUR * 0.54, easing: smooth, useNativeDriver: true }),
      ]),
    animate
  );

  const { fg, fg2 } = logoColors(isDark);

  const bill = (rotate: string, x: number, maxOpacity: number) => ({
    opacity: billsProgress.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, maxOpacity, maxOpacity] }),
    transform: [
      { translateX: x },
      { translateY: billsProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -(LOGO_H * 0.03)] }) },
      { rotate: billsProgress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", rotate] }) },
    ],
  });

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
    >
      <Animated.View style={{ width: LOGO_W, height: LOGO_H, transform: [{ scale: logoScale }] }}>
        <Animated.View style={[styles.layer, { width: LOGO_W, height: LOGO_H }, bill("-6deg", -3, 1)]}>
          <SvgXml xml={bill1Svg(fg)} width={LOGO_W} height={LOGO_H} />
        </Animated.View>
        <Animated.View style={[styles.layer, { width: LOGO_W, height: LOGO_H }, bill("4deg", 3, 0.9)]}>
          <SvgXml xml={bill2Svg(fg2)} width={LOGO_W} height={LOGO_H} />
        </Animated.View>
        <View style={[styles.layer, styles.walletTop, { width: LOGO_W, height: LOGO_H }]}>
          <SvgXml xml={walletSvg(fg)} width={LOGO_W} height={LOGO_H} />
        </View>
      </Animated.View>

      <View style={styles.dotsRow}>
        <Dot delay={0} color={fg} animate={animate} />
        <Dot delay={180} color={fg} animate={animate} />
        <Dot delay={360} color={fg} animate={animate} />
      </View>

      <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>{t("common.loading")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  layer: { position: "absolute", top: 0, left: 0 },
  walletTop: { zIndex: 10 },
  dotsRow: { flexDirection: "row", gap: 7, marginTop: 52 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  loadingLabel: {
    marginTop: 18,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.18,
    textTransform: "uppercase",
  },
});
