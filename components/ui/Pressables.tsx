import React, { useState } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { PRESS_SCALE } from "@/constants/design";
import { useMotion } from "@/hooks/useMotion";
import { useTheme } from "@/hooks/useTheme";

type Props = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; children: React.ReactNode };

/** Buttons and cards: scale to 0.97 with a snappy spring (none with Reduce Motion). */
export function PressableScale({ style, children, onPressIn, onPressOut, ...rest }: Props) {
  const { spring, reduceMotion } = useMotion();
  const [scale] = useState(() => new Animated.Value(1));

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        if (!reduceMotion) spring(scale, PRESS_SCALE, "snappy").start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduceMotion) spring(scale, 1, "snappy").start();
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** List rows: grey highlight while pressed, like iOS table cells. */
export function PressableRow({ style, children, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && { backgroundColor: colors.fill }]}>
      {children}
    </Pressable>
  );
}
