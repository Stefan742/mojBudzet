import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/** iOS "Reduce Transparency" setting; always false elsewhere (U-16). */
export function useReduceTransparency(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((value) => {
      if (mounted) setEnabled(value);
    });
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setEnabled);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return enabled;
}
