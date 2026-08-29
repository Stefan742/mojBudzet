import { Tabs, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur"; // fallback за iOS < 26
import React, { useState, useRef, useEffect } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TouchableNativeFeedback,
  Animated,
  Pressable,
} from "react-native";
import { useAppStore } from "@/store/useAppStore";
import LoadingScreen from "@/app/loading";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_HEIGHT = 70;
const TAB_BAR_BOTTOM_IOS = 34;
const TAB_BAR_BOTTOM_ANDROID = 0;

// ─── Конфигурација на табови ──────────────────────────────────────────────────

const MORE_ITEMS = [
  { route: "/budget",   icon: "wallet-outline"   as const, key: "budget"   },
  { route: "/settings", icon: "settings-outline" as const, key: "settings" },
];

const MAIN_TABS = [
  { name: "index",   icon: "pie-chart-outline" as const, iconFocused: "pie-chart"  as const, key: "overview" },
  { name: "history", icon: "time-outline"       as const, iconFocused: "time"       as const, key: "history"  },
  { name: "add",     icon: "add"                as const, iconFocused: "add"        as const, key: "add"      },
  { name: "savings", icon: "cash-outline"       as const, iconFocused: "cash"       as const, key: "savings"  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// iOS — Liquid Glass Tab Bar (нативен UIGlassEffect)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GlassPill — на iOS 26+ го користи вистинскиот нативен UIGlassEffect
 * преку expo-glass-effect. На iOS < 26 фалбекува на BlurView.
 *
 * isGlassEffectAPIAvailable е boolean КОНСТАНТА (не функција) —
 * само со оваа вредност знаеме дали уредот поддржува UIGlassEffect.
 * GlassColorScheme поддржува само "light" | "dark" (нема "system").
 */
function GlassPill({
  style,
  glassStyle = "regular",
  children,
}: {
  style?: any;
  glassStyle?: "regular" | "clear";
  children: React.ReactNode;
}) {
  const { isDark } = useTheme();
  // isGlassEffectAPIAvailable е boolean константа, НЕ функција
  const scheme: "light" | "dark" = isDark ? "dark" : "light";

  if (isGlassEffectAPIAvailable()) {
    // ✅ Вистинскиот нативен iOS Liquid Glass (UIGlassEffect / UIVisualEffectView)
    return (
      <GlassView
        style={style}
        glassEffectStyle={glassStyle}
        colorScheme={scheme}
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
            backgroundColor: isDark
              ? "rgba(22,22,24,0.45)"
              : "rgba(255,255,255,0.20)",
            borderWidth: 1,
            borderColor: isDark
              ? "rgba(255,255,255,0.10)"
              : "rgba(255,255,255,0.54)",
            borderRadius: (style?.borderRadius as number) ?? 20,
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
  onNavigate: (route: string) => void;
}) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  // Само translateY — opacity НИКОГАШ не ставаме на родителот на GlassView,
  // инаку нативниот glass ефект престанува да се рендерира (ограничување на UIKit).
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 70,
      friction: 11,
    }).start();
  }, [visible]);

  return (
    <Pressable
      style={[StyleSheet.absoluteFill, { zIndex: 99 }]}
      onPress={onClose}
      pointerEvents={visible ? "auto" : "none"}
    >
      {MORE_ITEMS.map((item, i) => {
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [14 + i * 8, 0],
        });
        // Скалирање наместо opacity — не го допираме opacity за да не го скриеме glass-от
        const scale = anim.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [0.85, 0.95, 1],
          extrapolate: "clamp",
        });
        const bottomOffset = TAB_BAR_BOTTOM_IOS + TAB_BAR_HEIGHT + 12 + i * 58;

        return (
          <Animated.View
            key={item.route}
            style={{
              position: "absolute",
              bottom: bottomOffset,
              right: 24,
              transform: [{ translateY }, { scale }],
              // Кога не е visible, скалираме на 0 наместо opacity на 0
              opacity: visible ? 1 : 0,
            }}
            pointerEvents={visible ? "auto" : "none"}
          >
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
                onNavigate(item.route);
              }}
            >
              <GlassPill style={styles.moreItemButton} glassStyle="regular">
                <View
                  style={[
                    styles.moreItemBorder,
                    {
                      borderColor: isDark
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(255,255,255,0.55)",
                    },
                  ]}
                />
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={
                    isDark
                      ? "rgba(255,255,255,0.84)"
                      : "rgba(0,0,0,0.72)"
                  }
                />
                <Text
                  style={[
                    styles.moreItemLabel,
                    {
                      color: isDark
                        ? "rgba(255,255,255,0.84)"
                        : "rgba(0,0,0,0.76)",
                    },
                  ]}
                >
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

function IOSTabItem({
  label,
  icon,
  iconFocused,
  focused,
  onPress,
}: {
  label: string;
  icon: any;
  iconFocused: any;
  focused: boolean;
  onPress: () => void;
}) {
  const { isDark } = useTheme();
  const iconColor = focused
    ? isDark ? "rgba(255,255,255,0.94)" : "rgba(0,0,0,0.84)"
    : isDark ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.38)";

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={styles.tabItemHitArea}
    >
      {focused ? (
        // Нативен glass pill за активниот таб
        <GlassPill style={styles.iconPill} glassStyle="clear">
          <View style={styles.pillGlow} />
          <Ionicons name={iconFocused} size={20} color={iconColor} />
        </GlassPill>
      ) : (
        <View style={styles.iconPill}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
      )}
      <Text
        style={[
          styles.label,
          {
            color: focused
              ? isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.84)"
              : isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)",
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function IOSAddTabItem({
  focused,
  onPress,
}: {
  focused: boolean;
  onPress: () => void;
}) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const iconColor = focused
    ? isDark ? "rgba(255,255,255,0.96)" : "rgba(0,0,0,0.86)"
    : isDark ? "rgba(255,255,255,0.70)" : "rgba(0,0,0,0.62)";

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={styles.tabItemHitArea}
    >
      {/* Add секогаш го добива glass pill — focused = clear, unfocused = light clear */}
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
        <Ionicons name="add" size={21} color={iconColor} />
      </GlassPill>
      <Text
        style={[
          styles.label,
          {
            color: focused
              ? isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.84)"
              : isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)",
          },
        ]}
      >
        {t("tabs.add")}
      </Text>
    </TouchableOpacity>
  );
}

function IOSMoreButton({
  onPress,
  isOpen,
}: {
  onPress: () => void;
  isOpen: boolean;
}) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={styles.tabItemHitArea}
    >
      {isOpen ? (
        <GlassPill style={styles.iconPill} glassStyle="clear">
          <View style={styles.pillGlow} />
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.84)"}
          />
        </GlassPill>
      ) : (
        <View style={styles.iconPill}>
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={isDark ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.38)"}
          />
        </View>
      )}
      <Text
        style={[
          styles.label,
          {
            color: isOpen
              ? isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.84)"
              : isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)",
          },
        ]}
      >
        {t("tabs.more")}
      </Text>
    </TouchableOpacity>
  );
}

// ─── iOS Tab Bar pill ─────────────────────────────────────────────────────────

function IOSTabBar({
  state,
  navigation,
  moreOpen,
  onMorePress,
}: {
  state: any;
  navigation: any;
  moreOpen: boolean;
  onMorePress: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.iosTabBarOuter} pointerEvents="box-none">
      {/*
       * GlassPill = нативен UIGlassEffect на iOS 26+
       * Нема повеќе BlurView + LinearGradient — телефонот сам го прави ефектот.
       */}
      <GlassPill style={styles.tabBarPill} glassStyle="regular">
        <View style={styles.tabRow}>
          <IOSTabItem
            label={t("tabs.overview")}
            icon="pie-chart-outline"
            iconFocused="pie-chart"
            focused={state.index === 0}
            onPress={() => navigation.navigate("index")}
          />
          <IOSTabItem
            label={t("tabs.history")}
            icon="time-outline"
            iconFocused="time"
            focused={state.index === 1}
            onPress={() => navigation.navigate("history")}
          />
          <IOSAddTabItem
            focused={state.index === 2}
            onPress={() => navigation.navigate("add")}
          />
          <IOSTabItem
            label={t("tabs.savings")}
            icon="cash-outline"
            iconFocused="cash"
            focused={state.index === 3}
            onPress={() => navigation.navigate("savings")}
          />
          <IOSMoreButton onPress={onMorePress} isOpen={moreOpen} />
        </View>
      </GlassPill>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Android — Material3 Native Tab Bar (непроменет)
// ═══════════════════════════════════════════════════════════════════════════════

function AndroidTabItem({
  label,
  icon,
  iconFocused,
  focused,
  onPress,
}: {
  label: string;
  icon: any;
  iconFocused: any;
  focused: boolean;
  onPress: () => void;
}) {
  const { isDark, colors } = useTheme();
  const activeColor   = colors.accent;
  const inactiveColor = isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.45)";

  return (
    <TouchableNativeFeedback
      onPress={onPress}
      background={TouchableNativeFeedback.Ripple(
        isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        true
      )}
    >
      <View style={styles.androidTabItem}>
        {focused && (
          <View
            style={[
              styles.androidPillIndicator,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.12)"
                  : `${activeColor}20`,
              },
            ]}
          />
        )}
        <Ionicons
          name={focused ? iconFocused : icon}
          size={22}
          color={focused ? activeColor : inactiveColor}
        />
        <Text
          style={[
            styles.androidLabel,
            {
              color: focused ? activeColor : inactiveColor,
              fontWeight: focused ? "600" : "400",
            },
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableNativeFeedback>
  );
}

function AndroidAddTabItem({
  focused,
  onPress,
}: {
  focused: boolean;
  onPress: () => void;
}) {
  const { isDark, colors } = useTheme();
  const { t } = useTranslation();
  const activeColor = colors.accent;

  return (
    <TouchableNativeFeedback
      onPress={onPress}
      background={TouchableNativeFeedback.Ripple(
        isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        true
      )}
    >
      <View style={styles.androidTabItem}>
        <View
          style={[
            styles.androidAddPill,
            {
              backgroundColor: focused
                ? activeColor
                : isDark
                ? "rgba(255,255,255,0.10)"
                : `${activeColor}18`,
            },
          ]}
        >
          <Ionicons name="add" size={22} color={focused ? "#fff" : activeColor} />
        </View>
        <Text
          style={[
            styles.androidLabel,
            {
              color: focused
                ? activeColor
                : isDark
                ? "rgba(255,255,255,0.50)"
                : "rgba(0,0,0,0.45)",
              fontWeight: focused ? "600" : "400",
            },
          ]}
        >
          {t("tabs.add")}
        </Text>
      </View>
    </TouchableNativeFeedback>
  );
}

function AndroidMoreButton({
  onPress,
  isOpen,
}: {
  onPress: () => void;
  isOpen: boolean;
}) {
  const { isDark, colors } = useTheme();
  const { t } = useTranslation();
  const activeColor   = colors.accent;
  const inactiveColor = isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.45)";

  return (
    <TouchableNativeFeedback
      onPress={onPress}
      background={TouchableNativeFeedback.Ripple(
        isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        true
      )}
    >
      <View style={styles.androidTabItem}>
        {isOpen && (
          <View
            style={[
              styles.androidPillIndicator,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.12)"
                  : `${activeColor}20`,
              },
            ]}
          />
        )}
        <Ionicons
          name="ellipsis-horizontal"
          size={22}
          color={isOpen ? activeColor : inactiveColor}
        />
        <Text
          style={[
            styles.androidLabel,
            {
              color: isOpen ? activeColor : inactiveColor,
              fontWeight: isOpen ? "600" : "400",
            },
          ]}
        >
          {t("tabs.more")}
        </Text>
      </View>
    </TouchableNativeFeedback>
  );
}

function AndroidMoreMenu({
  visible,
  onClose,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  const { isDark, colors } = useTheme();
  const { t } = useTranslation();
  const insets      = useSafeAreaInsets();
  const slideAnim   = useRef(new Animated.Value(200)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 200,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Pressable
      style={[StyleSheet.absoluteFill, { zIndex: 99 }]}
      onPress={onClose}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(0,0,0,0.32)", opacity: fadeAnim },
        ]}
      />
      <Animated.View
        style={[
          styles.androidMoreSheet,
          {
            backgroundColor: isDark ? "#1c1c1e" : "#ffffff",
            paddingBottom: insets.bottom + 80,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.androidSheetHandle,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.15)"
                : "rgba(0,0,0,0.15)",
            },
          ]}
        />
        {MORE_ITEMS.map((item) => (
          <TouchableNativeFeedback
            key={item.route}
            onPress={() => {
              onClose();
              onNavigate(item.route);
            }}
            background={TouchableNativeFeedback.Ripple(
              isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              false
            )}
          >
            <View style={styles.androidSheetRow}>
              <View
                style={[
                  styles.androidSheetIconBox,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : `${colors.accent}15`,
                  },
                ]}
              >
                <Ionicons name={item.icon} size={20} color={colors.accent} />
              </View>
              <Text
                style={[
                  styles.androidSheetLabel,
                  {
                    color: isDark
                      ? "rgba(255,255,255,0.87)"
                      : "rgba(0,0,0,0.87)",
                  },
                ]}
              >
                {t(`tabs.${item.key}`)}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={
                  isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.25)"
                }
              />
            </View>
          </TouchableNativeFeedback>
        ))}
      </Animated.View>
    </Pressable>
  );
}

function AndroidTabBar({
  state,
  navigation,
  moreOpen,
  onMorePress,
}: {
  state: any;
  navigation: any;
  moreOpen: boolean;
  onMorePress: () => void;
}) {
  const { isDark, colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.androidTabBar,
        {
          backgroundColor: isDark ? "#1c1c1e" : "#ffffff",
          paddingBottom: Math.max(insets.bottom, 8),
          shadowColor: "#000",
          shadowOpacity: isDark ? 0.4 : 0.1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.08)",
        },
      ]}
    >
      <AndroidTabItem
        label={t("tabs.overview")}
        icon="pie-chart-outline"
        iconFocused="pie-chart"
        focused={state.index === 0}
        onPress={() => navigation.navigate("index")}
      />
      <AndroidTabItem
        label={t("tabs.history")}
        icon="time-outline"
        iconFocused="time"
        focused={state.index === 1}
        onPress={() => navigation.navigate("history")}
      />
      <AndroidAddTabItem
        focused={state.index === 2}
        onPress={() => navigation.navigate("add")}
      />
      <AndroidTabItem
        label={t("tabs.savings")}
        icon="cash-outline"
        iconFocused="cash"
        focused={state.index === 3}
        onPress={() => navigation.navigate("savings")}
      />
      <AndroidMoreButton onPress={onMorePress} isOpen={moreOpen} />
    </View>
  );
}

// ─── Unified CustomTabBar ─────────────────────────────────────────────────────

function CustomTabBar({
  state,
  navigation,
  moreOpen,
  onMorePress,
}: {
  state: any;
  navigation: any;
  moreOpen: boolean;
  onMorePress: () => void;
}) {
  if (Platform.OS === "ios") {
    return (
      <IOSTabBar
        state={state}
        navigation={navigation}
        moreOpen={moreOpen}
        onMorePress={onMorePress}
      />
    );
  }
  return (
    <AndroidTabBar
      state={state}
      navigation={navigation}
      moreOpen={moreOpen}
      onMorePress={onMorePress}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Root TabLayout
// ═══════════════════════════════════════════════════════════════════════════════

export default function TabLayout() {
  const router     = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (useAppStore.persist.hasHydrated()) {
      setHydrated(true);
    } else {
      const unsub = useAppStore.persist.onFinishHydration(() =>
        setHydrated(true)
      );
      return unsub;
    }
  }, []);

  if (!hydrated) return <LoadingScreen />;

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <CustomTabBar
            {...props}
            moreOpen={moreOpen}
            onMorePress={() => setMoreOpen((v) => !v)}
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

      {Platform.OS === "ios" && (
        <MoreMenu
          visible={moreOpen}
          onClose={() => setMoreOpen(false)}
          onNavigate={(route) => router.push(route as any)}
        />
      )}

      {Platform.OS === "android" && (
        <AndroidMoreMenu
          visible={moreOpen}
          onClose={() => setMoreOpen(false)}
          onNavigate={(route) => router.push(route as any)}
        />
      )}
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
    bottom: TAB_BAR_BOTTOM_IOS,
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
    overflow: "hidden",
    minWidth: 150,
  },
  moreItemBorder: {
    ...StyleSheet.absoluteFillObject,
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
    fontSize: 11,
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
    paddingHorizontal: 0,
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