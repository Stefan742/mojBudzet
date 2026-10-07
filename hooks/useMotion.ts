import { Animated } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { FADE_MS, REDUCED_FADE_MS, springs, type SpringPreset } from "@/constants/design";

/**
 * Shared motion (DESIGN.md §3.7): springs from the presets, or a short fade
 * when Reduce Motion is on, so every animation follows the setting.
 */
export function useMotion() {
  const reduceMotion = useReducedMotion();

  /** Moves a value with a spring preset (or a short timing with Reduce Motion). */
  const spring = (value: Animated.Value, toValue: number, preset: SpringPreset = "standard") =>
    reduceMotion
      ? Animated.timing(value, { toValue, duration: REDUCED_FADE_MS, useNativeDriver: true })
      : Animated.spring(value, { toValue, ...springs[preset], useNativeDriver: true });

  /** A plain fade. */
  const fade = (value: Animated.Value, toValue: number) =>
    Animated.timing(value, { toValue, duration: reduceMotion ? REDUCED_FADE_MS : FADE_MS, useNativeDriver: true });

  return { reduceMotion, spring, fade };
}
