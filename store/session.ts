import { create } from "zustand";
import type { IconName } from "@/components/Icon";

/**
 * In-memory UI state that must outlive a single screen but is never saved:
 * the global toast and the month-rollover prompt for this app session.
 */
interface SessionState {
  toast: { id: number; message: string; icon: IconName; color?: string } | null;
  /** The leftover sheet was shown this session (dismissed or "Later"). */
  rolloverPrompted: boolean;
  showToast: (message: string, icon?: IconName, color?: string) => void;
  clearToast: (id: number) => void;
  setRolloverPrompted: () => void;
}

let nextId = 1;

export const useSession = create<SessionState>()((set) => ({
  toast: null,
  rolloverPrompted: false,
  showToast: (message, icon = "checkCircle", color) => set({ toast: { id: nextId++, message, icon, color } }),
  clearToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : {})),
  setRolloverPrompted: () => set({ rolloverPrompted: true }),
}));

/** Show a toast from anywhere (handlers, sheets that are about to close). */
export const showToast = (message: string, icon?: IconName, color?: string) =>
  useSession.getState().showToast(message, icon, color);
