import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { SvgXml } from "react-native-svg";
import { useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";

// ─── Logo SVGs (colours from the theme, so the logo shows in dark mode) ──────
const walletSvg = (fg: string) => `<svg viewBox="0 0 694.81 837.83" xmlns="http://www.w3.org/2000/svg">
  <path fill="${fg}"
    d="M61.82,837.83c-12.05,0-27.38-2.61-39.38-13.34-15.55-13.91-21.06-37.15-16.39-69.07L1.23,331.03c-1.58-7.63-1.64-16.22-.15-25.71,2.31-14.8,9.51-26.6,21.39-35.06,30.44-21.68,81.69-12.77,83.85-12.38l-3.54,19.68,1.77-9.84-1.76,9.84c-.45-.08-45.21-7.8-68.75,9-7.21,5.14-11.49,12.04-13.07,21.06l.24,21.08c1.06,3.93,2.8,7.3,5.23,10.14,12.54,14.65,43.38,15.87,71.31,15.87,45.44,0,468.83,1.68,473.1,1.7,26.96,0,78.02,13.83,78.02,66.15l5.1,331.29c.42,4.92,2.69,41.51-20.89,64.66-15.06,14.79-36.78,20.62-64.57,17.34H80.2c-2.88,.65-9.8,1.97-18.38,1.97ZM21.56,360.86l4.5,395.92-.12,.8c-3.8,25.2-.52,42.68,9.77,51.94,14.7,13.24,40.5,6.73,40.75,6.66l1.24-.32h1.31s490.69,0,490.69,0l.61,.07c21.7,2.66,38.07-1.25,48.68-11.61,17.91-17.5,15.07-48.61,15.03-48.92l-.05-.86-5.1-331.82c0-45.54-55.72-46.3-58.09-46.31-4.29-.02-427.64-1.7-473.04-1.7-28.22,0-56.93-1.23-76.17-13.85Z"/>
  <path fill="${fg}"
    d="M649.07,684.41h-103.8c-51.49,0-93.38-41.89-93.38-93.38s41.89-93.38,93.38-93.38h103.8c25.22,0,45.73,20.52,45.73,45.73v95.29c0,25.22-20.52,45.73-45.73,45.73Zm-103.8-166.76c-40.46,0-73.38,32.92-73.38,73.38s32.92,73.38,73.38,73.38h103.8c14.19,0,25.74-11.55,25.74-25.74v-95.29c0-14.19-11.55-25.74-25.74-25.74h-103.8Z"/>
  <circle fill="${fg}" cx="545.27" cy="596.14" r="28.93"/>
</svg>`;

const bill1Svg = (fg: string) => `<svg viewBox="0 0 694.81 837.83" xmlns="http://www.w3.org/2000/svg">
  <polygon fill="${fg}"
    points="219.11 332.38 200.02 332.38 424.46 0 648.4 154.87 525.61 332.19 506.13 332.38 620.59 159.94 429.53 27.82 219.11 332.38"/>
  <path fill="${fg}"
    d="M463.98,318.68c0,4.62-.38,9.18-1.11,13.6h-163.42c-.73-4.42-1.11-8.98-1.11-13.6,0-45.74,37.08-82.82,82.82-82.82s82.82,37.08,82.82,82.82Z"/>
</svg>`;

const bill2Svg = (fg2: string) => `<svg viewBox="0 0 694.81 837.83" xmlns="http://www.w3.org/2000/svg">
  <polygon fill="${fg2}"
    points="327.31 75.34 323.52 92.51 277.74 83.62 217.41 71.92 205.75 131.95 163.24 332.38 146.42 332.38 203.49 51.31 327.31 75.34"/>
  <path fill="${fg2}"
    d="M280.21,75.14c-4.91,21.81-19.76,41.09-41.81,50.76-13.52,5.93-27.87,7.42-41.4,5.12l13.47-69.4,69.75,13.53Z"/>
</svg>`;

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

  const fg  = isDark ? "#f2f2f2" : "#111111";
  const fg2 = isDark ? "#b0b0b0" : "#333333";

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
