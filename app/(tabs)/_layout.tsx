import { Tabs, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur"; // fallback за iOS < 26
import React, { useState, useEffect } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TouchableNativeFeedback,
  Animated,
  Pressable,
  BackHandler,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useReducedMotion } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { useReduceTransparency } from "@/hooks/useReduceTransparency";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ANDROID_TAB_BAR_HEIGHT,
  TAB_BAR_HEIGHT,
  iosTabBarBottom,
} from "@/constants/layout";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** Labels may grow with Dynamic Type, but not enough to break the fixed bar (U-16). */
const LABEL_MAX_SCALE = 1.3;

// ─── Конфигурација на табови ──────────────────────────────────────────────────

const MORE_ITEMS = [
  { route: "/budget",   name: "budget",   icon: "wallet-outline"   as const, key: "budget"   },
  { route: "/settings", name: "settings", icon: "settings-outline" as const, key: "settings" },
] as const;

const MAIN_TABS: { name: string; icon: IconName; iconFocused: IconName; key: string }[] = [
  { name: "index",   icon: "pie-chart-outline", iconFocused: "pie-chart", key: "overview" },
  { name: "history", icon: "time-outline",      iconFocused: "time",      key: "history"  },
  { name: "add",     icon: "add",               iconFocused: "add",       key: "add"      },
  { name: "savings", icon: "cash-outline",      iconFocused: "cash",      key: "savings"  },
];

const MORE_ROUTE_NAMES: string[] = MORE_ITEMS.map((i) => i.name);

// ═══════════════════════════════════════════════════════════════════════════════
// iOS — Liquid Glass Tab Bar (нативен UIGlassEffect)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GlassPill — на iOS 26+ го користи вистинскиот нативен UIGlassEffect
 * преку expo-glass-effect; на постар iOS фалбекува на BlurView. Со вклучено
 * „Reduce Transparency" е обична непроѕирна површина (U-16).
 */
function GlassPill({
  style,
  glassStyle = "regular",
  tintColor,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  glassStyle?: "regular" | "clear";
  /** Потемнува/посветлува glass-от за читливост; на iOS < 26 ја заменува подлогата. */
  tintColor?: string;
  children: React.ReactNode;
}) {
  const { isDark, colors } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const scheme: "light" | "dark" = isDark ? "dark" : "light";

  if (reduceTransparency) {
    return (
      <View style={[style, { backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator }]}>
        {children}
      </View>
    );
  }

  // isGlassEffectAPIAvailable е функција: проверува дали уредот има UIGlassEffect.
  if (isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        style={style}
        glassEffectStyle={glassStyle}
        colorScheme={scheme}
        tintColor={tintColor}
      >
        {children}
      </GlassView>
    );
  }

  // Fallback за iOS < 26 — BlurView симулација
  return (
    <View style={[style, { overflow: "hidden" }]}>
      <BlurView
        intensity={90}
        tint={isDark ? "dark" : "systemUltraThinMaterial"}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor:
              tintColor ??
              (isDark ? "rgba(22,22,24,0.45)" : "rgba(255,255,255,0.20)"),
            borderWidth: 1,
            borderColor: isDark
              ? "rgba(255,255,255,0.10)"
              : "rgba(255,255,255,0.54)",
            borderRadius: (StyleSheet.flatten(style)?.borderRadius as number | undefined) ?? 20,
          },
        ]}
      />
      {children}
    </View>
  );
}

// ─── More Menu (floating pills) ───────────────────────────────────────────────

function MoreMenu({
  visible,
  onClose,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: (typeof MORE_ITEMS)[number]["route"]) => void;
}) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // Само translateY/scale — opacity НИКОГАШ не ставаме на родителот на GlassView,
  // инаку нативниот glass ефект престанува да се рендерира (ограничување на UIKit).
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 70,
      friction: 11,
    }).start();
  }, [visible, reduceMotion, anim]);

  // Менито се монтира само кога е отворено: ако GlassView се креира под
  // родител со opacity 0, glass ефектот воопшто не се рендерира.
  if (!visible) return null;

  const pillTint = isDark ? "rgba(28,28,30,0.65)" : "rgba(255,255,255,0.65)";
  const textColor = isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.84)";

  return (
    <Pressable
      style={[StyleSheet.absoluteFill, { zIndex: 99 }]}
      onPress={onClose}
      accessibilityLabel={t("common.close")}
    >
      {MORE_ITEMS.map((item, i) => {
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [14 + i * 8, 0],
        });
        const scale = anim.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [0.85, 0.95, 1],
          extrapolate: "clamp",
        });
        const bottomOffset = iosTabBarBottom(insets.bottom) + TAB_BAR_HEIGHT + 12 + i * 58;

        return (
          <Animated.View
            key={item.route}
            style={{
              position: "absolute",
              bottom: bottomOffset,
              right: 24,
              transform: [{ translateY }, { scale }],
            }}
          >
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
                onNavigate(item.route);
              }}
              accessibilityRole="menuitem"
            >
              <GlassPill style={styles.moreItemButton} glassStyle="regular" tintColor={pillTint}>
                <View
                  style={[
                    styles.moreItemBorder,
                    { borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.55)" },
                  ]}
                />
                <Ionicons name={item.icon} size={18} color={textColor} />
                <Text style={[styles.moreItemLabel, { color: textColor }]} maxFontSizeMultiplier={LABEL_MAX_SCALE}>
                  {t(`tabs.${item.key}`)}
                </Text>
              </GlassPill>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </Pressable>
  );
}

// ─── Tab Items ────────────────────────────────────────────────────────────────

/** Contrast-checked label/icon colours for the glass bar (U-7). */
function useIOSTabColors(focused: boolean) {
  const { isDark } = useTheme();
  return focused
    ? isDark ? "rgba(255,255,255,0.94)" : "rgba(0,0,0,0.86)"
    : isDark ? "rgba(255,255,255,0.62)" : "rgba(0,0,0,0.60)";
}

function IOSTabItem({
  label,
  icon,
  iconFocused,
  focused,
  onPress,
}: {
  label: string;
  icon: IconName;
  iconFocused: IconName;
  focused: boolean;
  onPress: () => void;
}) {
  const color = useIOSTabColors(focused);

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={styles.tabItemHitArea}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      {focused ? (
        // Нативен glass pill за активниот таб
        <GlassPill style={styles.iconPill} glassStyle="clear">
          <View style={styles.pillGlow} />
          <Ionicons name={iconFocused} size={20} color={color} />
        </GlassPill>
      ) : (
        <View style={styles.iconPill}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
      )}
      <Text style={[styles.label, { color }]} maxFontSizeMultiplier={LABEL_MAX_SCALE} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function IOSAddTabItem({ focused, onPress }: { focused: boolean; onPress: () => void }) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const color = useIOSTabColors(focused);

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={styles.tabItemHitArea}
      accessibilityRole="tab"
      accessibilityLabel={t("tabs.add")}
      accessibilityState={{ selected: focused }}
    >
      {/* Add секогаш го добива glass pill — focused = clear, unfocused = regular */}
      <GlassPill
        style={[
          styles.addPill,
          {
            borderColor: focused
              ? isDark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.80)"
              : "transparent",
          },
        ]}
        glassStyle={focused ? "clear" : "regular"}
      >
        <View style={styles.pillGlow} />
        <Ionicons name="add" size={21} color={color} />
      </GlassPill>
      <Text style={[styles.label, { color }]} maxFontSizeMultiplier={LABEL_MAX_SCALE} numberOfLines={1}>
        {t("tabs.add")}
      </Text>
    </TouchableOpacity>
  );
}

function IOSMoreButton({ onPress, active, open }: { onPress: () => void; active: boolean; open: boolean }) {
  const { t } = useTranslation();
  const color = useIOSTabColors(active || open);
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={styles.tabItemHitArea}
      accessibilityRole="tab"
      accessibilityLabel={t("tabs.more")}
      accessibilityState={{ selected: active, expanded: open }}
    >
      {active || open ? (
        <GlassPill style={styles.iconPill} glassStyle="clear">
          <View style={styles.pillGlow} />
          <Ionicons name="ellipsis-horizontal" size={20} color={color} />
        </GlassPill>
      ) : (
        <View style={styles.iconPill}>
          <Ionicons name="ellipsis-horizontal" size={20} color={color} />
        </View>
      )}
      <Text style={[styles.label, { color }]} maxFontSizeMultiplier={LABEL_MAX_SCALE} numberOfLines={1}>
        {t("tabs.more")}
      </Text>
    </TouchableOpacity>
  );
}

// ─── iOS Tab Bar pill ─────────────────────────────────────────────────────────

interface BarProps {
  focusedName: string;
  navigate: (name: string) => void;
  moreOpen: boolean;
  onMorePress: () => void;
}

function IOSTabBar({ focusedName, navigate, moreOpen, onMorePress }: BarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.iosTabBarOuter, { bottom: iosTabBarBottom(insets.bottom) }]}
      pointerEvents="box-none"
      accessibilityRole="tablist"
    >
      <GlassPill style={styles.tabBarPill} glassStyle="regular">
        <View style={styles.tabRow}>
          {MAIN_TABS.map((tab) =>
            tab.name === "add" ? (
              <IOSAddTabItem key={tab.name} focused={focusedName === "add"} onPress={() => navigate("add")} />
            ) : (
              <IOSTabItem
                key={tab.name}
                label={t(`tabs.${tab.key}`)}
                icon={tab.icon}
                iconFocused={tab.iconFocused}
                focused={focusedName === tab.name}
                onPress={() => navigate(tab.name)}
              />
            )
          )}
          {/* Budget and Settings live behind "More", so it shows as active there (U-11). */}
          <IOSMoreButton onPress={onMorePress} active={MORE_ROUTE_NAMES.includes(focusedName)} open={moreOpen} />
        </View>
      </GlassPill>
    </View>
  );
}

/** Material ripple on Android; a plain touchable elsewhere (the ripple API is Android-only). */
function Ripple({
  rippleColor,
  borderless = false,
  children,
  ...rest
}: Omit<React.ComponentProps<typeof TouchableNativeFeedback>, "background"> & {
  rippleColor: string;
  borderless?: boolean;
}) {
  if (Platform.OS !== "android") {
    return (
      <TouchableOpacity activeOpacity={0.7} {...rest}>
        {children}
      </TouchableOpacity>
    );
  }
  return (
    <TouchableNativeFeedback background={TouchableNativeFeedback.Ripple(rippleColor, borderless)} {...rest}>
      {children}
    </TouchableNativeFeedback>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Android — Material3 Tab Bar
// ═══════════════════════════════════════════════════════════════════════════════

function useAndroidTabColors() {
  const { isDark, colors } = useTheme();
  return {
    active: colors.accent,
    inactive: isDark ? "rgba(255,255,255,0.66)" : "rgba(0,0,0,0.62)",
    indicator: isDark ? "rgba(255,255,255,0.12)" : `${colors.accent}20`,
    ripple: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
  };
}

function AndroidTabItem({
  label,
  icon,
  iconFocused,
  focused,
  onPress,
  expanded,
}: {
  label: string;
  icon: IconName;
  iconFocused: IconName;
  focused: boolean;
  onPress: () => void;
  expanded?: boolean;
}) {
  const c = useAndroidTabColors();
  const color = focused ? c.active : c.inactive;

  return (
    <Ripple
      onPress={onPress}
      rippleColor={c.ripple}
      borderless
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused, expanded }}
    >
      <View style={styles.androidTabItem}>
        {focused && <View style={[styles.androidPillIndicator, { backgroundColor: c.indicator }]} />}
        <Ionicons name={focused ? iconFocused : icon} size={22} color={color} />
        <Text
          style={[styles.androidLabel, { color, fontWeight: focused ? "600" : "400" }]}
          maxFontSizeMultiplier={LABEL_MAX_SCALE}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Ripple>
  );
}

function AndroidAddTabItem({ focused, onPress }: { focused: boolean; onPress: () => void }) {
  const { isDark, colors } = useTheme();
  const { t } = useTranslation();
  const c = useAndroidTabColors();

  return (
    <Ripple
      onPress={onPress}
      rippleColor={c.ripple}
      borderless
      accessibilityRole="tab"
      accessibilityLabel={t("tabs.add")}
      accessibilityState={{ selected: focused }}
    >
      <View style={styles.androidTabItem}>
        <View
          style={[
            styles.androidAddPill,
            { backgroundColor: focused ? c.active : isDark ? "rgba(255,255,255,0.10)" : `${c.active}18` },
          ]}
        >
          <Ionicons name="add" size={22} color={focused ? colors.onAccent : c.active} />
        </View>
        <Text
          style={[styles.androidLabel, { color: focused ? c.active : c.inactive, fontWeight: focused ? "600" : "400" }]}
          maxFontSizeMultiplier={LABEL_MAX_SCALE}
          numberOfLines={1}
        >
          {t("tabs.add")}
        </Text>
      </View>
    </Ripple>
  );
}

function AndroidMoreMenu({
  visible,
  onClose,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: (typeof MORE_ITEMS)[number]["route"]) => void;
}) {
  const { isDark, colors } = useTheme();
  const { t } = useTranslation();
  const insets       = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [slideAnim]  = useState(() => new Animated.Value(200));
  const [fadeAnim]   = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      slideAnim.setValue(0);
      fadeAnim.setValue(1);
      return;
    }
    slideAnim.setValue(200);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [visible, reduceMotion, slideAnim, fadeAnim]);

  if (!visible) return null;

  return (
    <Pressable style={[StyleSheet.absoluteFill, { zIndex: 99 }]} onPress={onClose} accessibilityLabel={t("common.close")}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.32)", opacity: fadeAnim }]} />
      <Animated.View
        style={[
          styles.androidMoreSheet,
          {
            backgroundColor: colors.card,
            paddingBottom: insets.bottom + ANDROID_TAB_BAR_HEIGHT + 16,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        accessibilityRole="menu"
      >
        <View style={[styles.androidSheetHandle, { backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" }]} />
        {MORE_ITEMS.map((item) => (
          <Ripple
            key={item.route}
            onPress={() => {
              onClose();
              onNavigate(item.route);
            }}
            rippleColor={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
            accessibilityRole="menuitem"
          >
            <View style={styles.androidSheetRow}>
              <View style={[styles.androidSheetIconBox, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : `${colors.accent}15` }]}>
                <Ionicons name={item.icon} size={20} color={colors.accent} />
              </View>
              <Text style={[styles.androidSheetLabel, { color: colors.text }]}>{t(`tabs.${item.key}`)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          </Ripple>
        ))}
      </Animated.View>
    </Pressable>
  );
}

function AndroidTabBar({ focusedName, navigate, moreOpen, onMorePress }: BarProps) {
  const { isDark, colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.androidTabBar,
        {
          backgroundColor: colors.card,
          paddingBottom: Math.max(insets.bottom, 8),
          shadowColor: colors.shadow,
          shadowOpacity: isDark ? 0.4 : 0.1,
          borderTopColor: colors.separator,
        },
      ]}
      accessibilityRole="tablist"
    >
      {MAIN_TABS.map((tab) =>
        tab.name === "add" ? (
          <AndroidAddTabItem key={tab.name} focused={focusedName === "add"} onPress={() => navigate("add")} />
        ) : (
          <AndroidTabItem
            key={tab.name}
            label={t(`tabs.${tab.key}`)}
            icon={tab.icon}
            iconFocused={tab.iconFocused}
            focused={focusedName === tab.name}
            onPress={() => navigate(tab.name)}
          />
        )
      )}
      <AndroidTabItem
        label={t("tabs.more")}
        icon="ellipsis-horizontal"
        iconFocused="ellipsis-horizontal"
        focused={moreOpen || MORE_ROUTE_NAMES.includes(focusedName)}
        expanded={moreOpen}
        onPress={onMorePress}
      />
    </View>
  );
}

// ─── Unified CustomTabBar ─────────────────────────────────────────────────────

function CustomTabBar({
  state,
  navigation,
  moreOpen,
  onMorePress,
  onNavigate,
}: TabBarProps & { moreOpen: boolean; onMorePress: () => void; onNavigate: () => void }) {
  const barProps: BarProps = {
    focusedName: state.routes[state.index]?.name ?? "index",
    navigate: (name) => {
      onNavigate();
      navigation.navigate(name);
    },
    moreOpen,
    onMorePress,
  };
  return Platform.OS === "ios" ? <IOSTabBar {...barProps} /> : <AndroidTabBar {...barProps} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Root TabLayout
// ═══════════════════════════════════════════════════════════════════════════════

export default function TabLayout() {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const { t } = useTranslation();

  // Android back closes the More menu instead of leaving the app (B-9).
  useEffect(() => {
    if (!moreOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setMoreOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [moreOpen]);

  const MoreMenuForPlatform = Platform.OS === "ios" ? MoreMenu : AndroidMoreMenu;

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <CustomTabBar
            {...props}
            moreOpen={moreOpen}
            onMorePress={() => setMoreOpen((v) => !v)}
            onNavigate={() => setMoreOpen(false)}
          />
        )}
      >
        <Tabs.Screen name="index"    options={{ title: t("tabs.overview") }} />
        <Tabs.Screen name="history"  options={{ title: t("tabs.history")  }} />
        <Tabs.Screen name="add"      options={{ title: t("tabs.add")      }} />
        <Tabs.Screen name="savings"  options={{ title: t("tabs.savings")  }} />
        <Tabs.Screen name="budget"   options={{ title: t("tabs.budget")   }} />
        <Tabs.Screen name="settings" options={{ title: t("tabs.settings") }} />
      </Tabs>

      <MoreMenuForPlatform
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        onNavigate={(route) => router.push(route)}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════════

const PILL_RADIUS = TAB_BAR_HEIGHT / 2;

const styles = StyleSheet.create({
  // ── iOS Styles ──────────────────────────────────────────────────────────────
  iosTabBarOuter: {
    position: "absolute",
    left: 20,
    right: 20,
    height: TAB_BAR_HEIGHT,
    // Shadow останува — дава длабочина под pill-от
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 18,
  },
  tabBarPill: {
    flex: 1,
    borderRadius: PILL_RADIUS,
    // ⚠️ overflow: "hidden" е намерно отстрането!
    // GlassView (UIGlassEffect) мора да ги семплира пикселите зад себе —
    // overflow: "hidden" го прекинува тоа и glass-от не се рендерира.
    // GlassView сам го прави borderRadius clipping нативно.
  },
  tabRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 10,
    paddingTop: 2,
  },
  tabItemHitArea: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  iconPill: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    // overflow: "hidden" отстрането — GlassView сам клипира
  },
  addPill: {
    width: 46,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    // overflow: "hidden" отстрането — GlassView сам клипира
    borderWidth: 1,
  },
  pillGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.1,
    textAlign: "center",
    marginTop: 1,
  },
  moreItemButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 20,
    // overflow: "hidden" отстрането — GlassView сам клипира
    minWidth: 150,
    minHeight: 48,
  },
  moreItemBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderRadius: 20,
  },
  moreItemLabel: {
    fontSize: 15,
    fontWeight: "500",
    zIndex: 10,
  },

  // ── Android Styles ──────────────────────────────────────────────────────────
  androidTabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    zIndex: 50,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  androidTabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 3,
    position: "relative",
    minHeight: 56,
    overflow: "hidden",
  },
  androidPillIndicator: {
    position: "absolute",
    top: 4,
    width: 64,
    height: 32,
    borderRadius: 16,
  },
  androidAddPill: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  androidLabel: {
    fontSize: 12,
    letterSpacing: 0.1,
    textAlign: "center",
  },
  androidMoreSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
  },
  androidSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  androidSheetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  androidSheetIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  androidSheetLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
});
