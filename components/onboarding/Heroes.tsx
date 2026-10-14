import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop, SvgXml } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { formatMoney } from "../../utils/money";
import { useTheme } from "@/hooks/useTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { Icon, type IconName } from "@/components/Icon";
import { bill1Svg, bill2Svg, logoColors, walletSvg } from "@/components/logoSvg";
import { Separator } from "@/components/ui/Section";
import { ROW_MIN, corners, elevation, money, radius, space, tint, type } from "@/constants/design";

/**
 * The pictures of the explanation pages: small, real pieces of the app's own
 * screens, so the user recognises them later. Static data, entering motion
 * only (Reanimated layout animations follow Reduce Motion by themselves).
 */

const TYPE_MS = 120;

/** A light that fades to nothing at its edge (a radial gradient, not a disc). */
function Glow({ color, size, style }: { color: string; size: number; style: object }) {
  const id = `glow-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <Svg width={size} height={size} style={[styles.glow, style]}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  );
}

// The logo at the loading screen's size, so the first launch flows from one to the other.
const LOGO_W = 132;
const LOGO_H = 177;
/** The app logo, still, with a soft light behind it. */
export function WelcomeHero() {
  const { colors, isDark } = useTheme();
  const { fg, fg2 } = logoColors(isDark);
  return (
    <View style={styles.center} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.glows}>
        <Glow color={colors.success} size={300} style={styles.glowGreen} />
        <Glow color={colors.accent} size={300} style={styles.glowBlue} />
      </View>
      <View style={styles.logo}>
        <View style={styles.layer}>
          <SvgXml xml={bill1Svg(fg)} width={LOGO_W} height={LOGO_H} />
        </View>
        <View style={styles.layer}>
          <SvgXml xml={bill2Svg(fg2)} width={LOGO_W} height={LOGO_H} />
        </View>
        <View style={styles.layer}>
          <SvgXml xml={walletSvg(fg)} width={LOGO_W} height={LOGO_H} />
        </View>
      </View>
    </View>
  );
}

/** The Add form typing "Market", then Auto category choosing Needs › Food and drinks. */
export function TrackHero() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const currency = useCurrency();
  const reduceMotion = useReducedMotion();
  const merchant = t("onboarding.track.sampleMerchant");
  const [typed, setTyped] = useState(() => (reduceMotion ? merchant.length : 0));

  useEffect(() => {
    if (typed >= merchant.length) return;
    const timer = setTimeout(() => setTyped((n) => n + 1), TYPE_MS);
    return () => clearTimeout(timer);
  }, [typed, merchant.length]);

  const done = typed >= merchant.length;
  const chip = (label: string, selected: string | null) => (
    <View style={[styles.chip, { backgroundColor: selected ?? colors.fill }]}>
      <Text style={[type.subheadline, { color: selected ? "#FFFFFF" : colors.text, fontWeight: selected ? "600" : "400" }]}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.center} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.card, styles.wide, { backgroundColor: colors.card }, elevation.floating(isDark)]}>
        <View style={styles.row}>
          <Text style={[type.body, { color: colors.text }]}>{merchant.slice(0, typed)}</Text>
          {!done && <View style={[styles.caret, { backgroundColor: colors.accent }]} />}
        </View>
        <Separator />
        <View style={styles.row}>
          <Text style={[type.title2, money, styles.flex, { color: colors.text }]}>{formatMoney(1250, currency)}</Text>
        </View>
        <Separator />
        <View style={styles.row}>
          <Icon name="sparkles" size={18} color={colors.accent} />
          <Text style={[type.body, styles.flex, { color: colors.text }]}>{t("add.autoSuggestShort")}</Text>
          <View style={[styles.switch, { backgroundColor: colors.success }]}>
            <View style={styles.knob} />
          </View>
        </View>
        <Separator />
        <View style={styles.chips}>
          {done ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.chipLine}>
              {chip(t("categories.cat-needs"), colors.success)}
              {chip(t("subcategories.sub-food"), colors.accent)}
            </Animated.View>
          ) : (
            <View style={styles.chipLine}>
              {chip(t("categories.cat-needs"), null)}
              {chip(t("categories.cat-wants"), null)}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/** The Overview donut, with a "Due now" rent row in front of it. */
export function PlanHero() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const currency = useCurrency();
  const size = 132;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const parts = [
    { share: 0.58, color: colors.success },
    { share: 0.27, color: colors.warning },
    { share: 0.15, color: colors.accent },
  ];
  let offset = 0;

  return (
    <View style={styles.center} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.planStage}>
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={[styles.card, styles.donutCard, { backgroundColor: colors.card }, elevation.raised(isDark)]}
        >
          <Svg width={size} height={size} style={styles.rotate}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.fill} strokeWidth={stroke} fill="none" />
            {parts.map((p, i) => {
              const length = p.share * c - 3;
              const dash = (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={p.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${length} ${c - length}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += p.share * c;
              return dash;
            })}
          </Svg>
          <View style={[styles.donutHole, { width: size, height: size }]}>
            <Text style={[type.caption, { color: colors.textSecondary }]}>{t("overview.spent")}</Text>
            <Text style={[type.subheadline, money, { color: colors.text, fontWeight: "600" }]}>{formatMoney(31500, currency)}</Text>
          </View>
        </Animated.View>
        <Animated.View
          entering={FadeInDown.delay(250).duration(400)}
          style={[styles.card, styles.dueCard, { backgroundColor: colors.card }, elevation.floating(isDark)]}
        >
          <Text style={[type.caption, styles.dueHeader, { color: colors.textSecondary }]}>
            {t("repeating.dueNow", { count: 1 })}
          </Text>
          <View style={styles.row}>
            <View style={[styles.tile, { backgroundColor: tint(colors.accent, "soft") }]}>
              <Icon name="house" size={15} color={colors.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={[type.subheadline, { color: colors.text, fontWeight: "600" }]}>{t("onboarding.bills.rent")}</Text>
              <Text style={[type.caption, { color: colors.textSecondary }]}>{t("repeating.today")}</Text>
            </View>
            <Text style={[type.footnote, money, { color: colors.text }]}>{formatMoney(15000, currency)}</Text>
            <View style={[styles.pill, { backgroundColor: tint(colors.accent, "subtle") }]}>
              <Text style={[type.footnote, { color: colors.accent, fontWeight: "600" }]}>{t("repeating.add")}</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

/** A lock, and the three promises behind it. */
export function PrivateHero() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const promises: { icon: IconName; label: string }[] = [
    { icon: "personSlash", label: t("onboarding.private.noAccount") },
    { icon: "eyeSlash", label: t("onboarding.private.noAds") },
    { icon: "phone", label: t("onboarding.private.onDevice") },
  ];
  return (
    <View style={[styles.center, styles.privateStage]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.lockTile, { backgroundColor: tint(colors.success, "soft") }]}>
        <Icon name="lock" size={46} color={colors.success} />
      </Animated.View>
      <View style={styles.promises}>
        {promises.map((p, i) => (
          <Animated.View
            key={p.icon}
            entering={FadeInDown.delay(150 + i * 110).duration(350)}
            style={[styles.promise, { backgroundColor: colors.card }, elevation.raised(isDark)]}
          >
            <Icon name={p.icon} size={16} color={colors.success} />
            <Text style={[type.subheadline, { color: colors.text, fontWeight: "600" }]}>{p.label}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center:       { flex: 1, alignItems: "center", justifyContent: "center" },
  flex:         { flex: 1 },
  glow:         { position: "absolute" },
  glowGreen:    { transform: [{ translateX: -50 }, { translateY: -30 }] },
  glowBlue:     { transform: [{ translateX: 60 }, { translateY: 40 }] },
  glows:        { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  logo:         { width: LOGO_W, height: LOGO_H },
  layer:        { position: "absolute", top: 0, left: 0, width: LOGO_W, height: LOGO_H },
  card:         { overflow: "hidden", ...corners(radius.lg) },
  wide:         { width: "88%", maxWidth: 340 },
  row:          { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: ROW_MIN },
  caret:        { width: 2, height: 22, borderRadius: 1, marginLeft: 1 },
  switch:       { width: 44, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 2 },
  knob:         { width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF" },
  chips:        { paddingHorizontal: space[4], paddingVertical: space[3], minHeight: ROW_MIN + 8 },
  chipLine:     { flexDirection: "row", gap: space[2] },
  chip:         { paddingHorizontal: space[4], minHeight: 34, justifyContent: "center", ...corners(radius.pill) },
  planStage:    { width: 320, height: 290 },
  donutCard:    { position: "absolute", top: 0, left: 0, width: 220, height: 200, alignItems: "center", justifyContent: "center" },
  rotate:       { transform: [{ rotate: "-90deg" }] },
  donutHole:    { position: "absolute", alignItems: "center", justifyContent: "center" },
  dueCard:      { position: "absolute", right: 0, bottom: 0, width: 280, paddingTop: space[2], paddingBottom: space[1] },
  dueHeader:    { paddingHorizontal: space[4], textTransform: "uppercase" },
  tile:         { width: 28, height: 28, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  pill:         { paddingHorizontal: space[3], minHeight: 26, justifyContent: "center", ...corners(radius.pill) },
  privateStage: { gap: space[6] },
  lockTile:     { width: 104, height: 104, alignItems: "center", justifyContent: "center", ...corners(radius.xl) },
  promises:     { gap: space[2], alignItems: "center" },
  promise:      { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: 40, ...corners(radius.pill) },
});
