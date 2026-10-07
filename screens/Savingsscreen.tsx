// screens/SavingsScreen.tsx
import React, { useRef, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Modal, ScrollView, Switch, Alert,
  KeyboardAvoidingView, Animated, PanResponder, AccessibilityInfo,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { v4 as uuid } from "uuid";
import { useAppStore } from "../store/useAppStore";
import { SavingsGoal, calculateGoalProgress } from "../models";
import { formatMoney, validateAmount } from "../utils/money";
import { formatDate } from "../utils/dates";
import { useTheme } from "@/hooks/useTheme";
import { useAmountField } from "@/hooks/useAmountField";
import { ModalHeader } from "@/components/ModalHeader";
import { DateField } from "@/components/DateField";
import { MIN_TOUCH, useTabBarSpace } from "@/constants/layout";
import { COLOR_PALETTE } from "@/constants/palette";


const isAchieved = (g: SavingsGoal) => g.targetAmount > 0 && g.currentAmount >= g.targetAmount;

// ─── Milestone Toast ──────────────────────────────────────────────────────────
function useMilestoneToast() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [toast, setToast] = useState<{ msg: string; icon: string } | null>(null);
  const [translateY] = useState(() => new Animated.Value(-120));

  const show = (msg: string, icon: string) => {
    setToast({ msg, icon });
    AccessibilityInfo.announceForAccessibility(msg);
    Animated.sequence([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
      Animated.delay(2400),
      Animated.timing(translateY, { toValue: -120, duration: 280, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  const ToastView = toast ? (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { top: insets.top + 12, transform: [{ translateY }], backgroundColor: colors.card, borderColor: colors.separator, shadowColor: colors.shadow },
      ]}
    >
      <Text style={styles.toastIcon}>{toast.icon}</Text>
      <Text style={[styles.toastText, { color: colors.text }]}>{toast.msg}</Text>
    </Animated.View>
  ) : null;

  return { show, ToastView };
}

// ─── Vault Transfer Modal ─────────────────────────────────────────────────────
interface VaultTransferModalProps {
  visible: boolean;
  vaultAmount: number;
  currency: string;
  goals: SavingsGoal[];
  onTransfer: (goalId: string, amount: number) => void;
  onClose: () => void;
}

function VaultTransferModal({
  visible, vaultAmount, currency, goals, onTransfer, onClose,
}: VaultTransferModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const amountField = useAmountField();

  const selectedGoal = goals.find((g) => g.id === selectedGoalId);
  const parsed = validateAmount(amountField.text);
  const amount = "amount" in parsed ? parsed.amount : 0;
  const exceeds = amount > vaultAmount;
  const canConfirm = !!selectedGoalId && amount > 0 && !exceeds;

  const reset = () => {
    setSelectedGoalId(null);
    amountField.reset();
  };

  const handleConfirm = () => {
    if (!selectedGoalId || !canConfirm) return;
    onTransfer(selectedGoalId, amount);
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={vtStyles.overlay}>
          <View style={[vtStyles.sheet, { backgroundColor: colors.card, paddingBottom: 24 + insets.bottom }]}>
            <View style={[vtStyles.handle, { backgroundColor: colors.separator }]} />

            <Text style={[vtStyles.title, { color: colors.text }]} accessibilityRole="header">
              {t("savings.vaultTransfer.title")}
            </Text>
            <Text style={[vtStyles.subtitle, { color: colors.textSecondary }]}>
              {t("savings.vaultTransfer.availableAmount", { amount: formatMoney(vaultAmount, currency) })}
            </Text>

            <View style={[vtStyles.amountRow, { backgroundColor: colors.inputBg }]}>
              <Text style={[vtStyles.amountLabel, { color: colors.textSecondary }]}>
                {t("savings.vaultTransfer.amount")}
              </Text>
              <TextInput
                style={[vtStyles.amountInput, { color: colors.text }]}
                value={amountField.text}
                onChangeText={amountField.onChangeText}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                accessibilityLabel={t("savings.vaultTransfer.amount")}
              />
              <TouchableOpacity
                style={[vtStyles.maxBtn, { backgroundColor: colors.vaultBg }]}
                onPress={() => amountField.setAmount(vaultAmount)}
                accessibilityRole="button"
              >
                <Text style={[vtStyles.maxBtnText, { color: colors.vault }]}>{t("savings.vaultTransfer.all")}</Text>
              </TouchableOpacity>
            </View>
            {exceeds && (
              <Text style={[vtStyles.error, { color: colors.destructive }]}>
                {t("savings.vaultTransfer.exceeds", { amount: formatMoney(vaultAmount, currency) })}
              </Text>
            )}

            <Text style={[vtStyles.sectionLabel, { color: colors.textSecondary }]}>
              {t("savings.vaultTransfer.pickGoal")}
            </Text>

            <ScrollView style={vtStyles.goalList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {goals.length === 0 ? (
                <View style={vtStyles.noGoals}>
                  <Ionicons name="flag-outline" size={32} color={colors.separator} />
                  <Text style={[vtStyles.noGoalsText, { color: colors.textSecondary }]}>
                    {t("savings.vaultTransfer.noGoals")}
                  </Text>
                </View>
              ) : (
                goals.map((g) => {
                  const isSelected = selectedGoalId === g.id;
                  const pct = calculateGoalProgress(g.currentAmount, g.targetAmount) * 100;
                  const remaining = Math.max(0, g.targetAmount - g.currentAmount);
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[
                        vtStyles.goalRow,
                        { backgroundColor: colors.inputBg },
                        isSelected && { backgroundColor: colors.accent + "18", borderColor: colors.accent },
                      ]}
                      onPress={() => setSelectedGoalId(isSelected ? null : g.id)}
                      activeOpacity={0.7}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={[vtStyles.goalDotBox, { backgroundColor: g.colorHex + "22" }]}>
                        <View style={[vtStyles.goalDot, { backgroundColor: g.colorHex }]} />
                      </View>
                      <View style={vtStyles.goalInfo}>
                        <Text style={[vtStyles.goalName, { color: colors.text }]}>{g.name}</Text>
                        <Text style={[vtStyles.goalSub, { color: colors.textSecondary }]}>
                          {t("savings.remaining", { amount: formatMoney(remaining, currency) })}
                        </Text>
                        <View style={[vtStyles.progressTrack, { backgroundColor: colors.separator }]}>
                          <View style={[vtStyles.progressFill, { width: `${pct}%`, backgroundColor: g.colorHex }]} />
                        </View>
                      </View>
                      <View style={[
                        vtStyles.check,
                        { borderColor: colors.separator, backgroundColor: colors.card },
                        isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                      ]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color={colors.onAccent} />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={[vtStyles.confirmBtn, { backgroundColor: colors.accent }, !canConfirm && { opacity: 0.4 }]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canConfirm }}
            >
              <Ionicons name="arrow-forward-circle" size={20} color={colors.onAccent} style={{ marginRight: 8 }} />
              <Text style={[vtStyles.confirmText, { color: colors.onAccent }]}>
                {selectedGoal && amount > 0
                  ? t("savings.vaultTransfer.confirmTo", { name: selectedGoal.name })
                  : t("savings.vaultTransfer.confirm")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleClose} style={vtStyles.cancelBtn} accessibilityRole="button">
              <Text style={[vtStyles.cancelText, { color: colors.textSecondary }]}>
                {t("savings.vaultTransfer.cancel")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Vault Card ───────────────────────────────────────────────────────────────
function VaultCard({ amount, currency, onTransferPress }: { amount: number; currency: string; onTransferPress: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.vaultCard, { backgroundColor: colors.card, borderColor: colors.background, shadowColor: colors.shadow }]}>
      <View style={styles.vaultLeft}>
        <View style={[styles.vaultIconBox, { backgroundColor: colors.vaultBg }]}>
          <Ionicons name="lock-closed" size={22} color={colors.vault} />
        </View>
        <View style={styles.vaultText}>
          <Text style={[styles.vaultLabel, { color: colors.text }]}>{t("savings.vault")}</Text>
          <Text style={[styles.vaultSub, { color: colors.textSecondary }]}>{t("savings.vaultSub")}</Text>
        </View>
      </View>
      <View style={styles.vaultRight}>
        <Text style={[styles.vaultAmount, { color: colors.vault }]}>{formatMoney(amount, currency)}</Text>
        {amount > 0 && (
          <TouchableOpacity
            style={[styles.transferBtn, { backgroundColor: colors.background }]}
            onPress={onTransferPress}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-forward-circle-outline" size={14} color={colors.accent} />
            <Text style={[styles.transferBtnText, { color: colors.text }]}>{t("savings.transfer")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Swipeable Goal Card ──────────────────────────────────────────────────────
interface GoalCardProps {
  goal: SavingsGoal;
  currency: string;
  onPress: () => void;
  onDelete: () => void;
  onAddAmount: (amount: number) => void;
}

const DELETE_THRESHOLD = -80;

function GoalCard({ goal, currency, onPress, onDelete, onAddAmount }: GoalCardProps) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [showInput, setShowInput] = useState(false);
  const amountField = useAmountField();
  const [translateX] = useState(() => new Animated.Value(0));

  const [panResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, DELETE_THRESHOLD));
      },
      onPanResponderRelease: (_, g) => {
        const open = g.dx < DELETE_THRESHOLD / 2;
        Animated.spring(translateX, { toValue: open ? DELETE_THRESHOLD : 0, useNativeDriver: true }).start();
      },
    })
  );

  const progress  = calculateGoalProgress(goal.currentAmount, goal.targetAmount);
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const achieved  = isAchieved(goal);

  const handleAdd = () => {
    const value = amountField.parse();
    if (value === null) return;
    onAddAmount(value);
    amountField.reset();
    setShowInput(false);
  };

  return (
    <View style={styles.swipeWrapper}>
      <View style={[styles.deleteBackground, { backgroundColor: colors.destructive }]}>
        <TouchableOpacity style={styles.deleteAction} onPress={onDelete} accessibilityRole="button">
          <Ionicons name="trash" size={22} color={colors.onAccent} />
          <Text style={[styles.deleteActionText, { color: colors.onAccent }]}>{t("savings.delete")}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.goalCard,
          {
            transform: [{ translateX }],
            // Achieved goals get a tint that works in both themes (B-20).
            backgroundColor: achieved ? colors.successBg : colors.card,
            shadowColor: colors.shadow,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${goal.name}, ${formatMoney(goal.currentAmount, currency)} / ${formatMoney(goal.targetAmount, currency)}, ${Math.round(progress * 100)}%`}
          accessibilityHint={t("a11y.editHint")}
          // Swipe-to-delete is not reachable with a screen reader; offer it as an action.
          accessibilityActions={[{ name: "delete", label: t("savings.delete") }]}
          onAccessibilityAction={(e) => e.nativeEvent.actionName === "delete" && onDelete()}
        >
          <View style={styles.goalRow}>
            <View style={styles.goalTop}>
              <View style={[styles.goalColorDot, { backgroundColor: goal.colorHex }]} />
              <Text style={[styles.goalName, { color: colors.text }]} numberOfLines={1}>{goal.name}</Text>
              {achieved && (
                <View style={[styles.achievedBadge, { backgroundColor: colors.card }]}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.successText} />
                  <Text style={[styles.achievedText, { color: colors.successText }]}>{t("savings.achieved")}</Text>
                </View>
              )}
              <Text style={[styles.goalPct, { color: colors.text }]}>{Math.round(progress * 100)}%</Text>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: colors.separator }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: goal.colorHex }]} />
            </View>

            <View style={styles.goalBottom}>
              <Text style={[styles.goalCurrent, { color: colors.text }]}>{formatMoney(goal.currentAmount, currency)}</Text>
              <Text style={[styles.goalRemaining, { color: colors.textSecondary }]}>
                {remaining > 0 ? t("savings.remaining", { amount: formatMoney(remaining, currency) }) : t("savings.goalAchieved")}
              </Text>
              <Text style={[styles.goalTarget, { color: colors.textSecondary }]}>{formatMoney(goal.targetAmount, currency)}</Text>
            </View>

            {goal.deadline && (
              <View style={styles.deadlineRow}>
                <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.deadline, { color: colors.textSecondary }]}>
                  {t("savings.deadlineOn", { date: formatDate(goal.deadline, i18n.language) })}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {!achieved && (
          <View style={[styles.addSection, { borderTopColor: colors.separator }]}>
            {showInput ? (
              <>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.addInput, { backgroundColor: colors.background, color: colors.text }]}
                    value={amountField.text}
                    onChangeText={amountField.onChangeText}
                    placeholder={t("savings.enterAmount")}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    autoFocus
                    accessibilityLabel={t("savings.enterAmount")}
                  />
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: colors.accent }]}
                    onPress={handleAdd}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.confirm")}
                  >
                    <Ionicons name="checkmark" size={20} color={colors.onAccent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: colors.background }]}
                    onPress={() => { setShowInput(false); amountField.reset(); }}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.cancel")}
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {amountField.errorText && (
                  <Text style={[styles.fieldError, { color: colors.destructive }]}>{amountField.errorText}</Text>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={[styles.addMoneyBtn, { backgroundColor: colors.background }]}
                onPress={() => setShowInput(true)}
                accessibilityRole="button"
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
                <Text style={[styles.addMoneyText, { color: colors.text }]}>{t("savings.addMoney")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SavingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomSpace = useTabBarSpace();
  const currency = t("common.currency");

  const savingsGoals      = useAppStore((s) => s.savingsGoals);
  const vaultAmount       = useAppStore((s) => s.vaultAmount);
  const deleteGoal        = useAppStore((s) => s.deleteGoal);
  const saveFromBalance   = useAppStore((s) => s.saveFromBalance);
  const transferFromVault = useAppStore((s) => s.transferFromVault);

  const { show: showToast, ToastView } = useMilestoneToast();

  const [editor, setEditor] = useState<{ goal: SavingsGoal; isNew: boolean } | null>(null);
  const [showVaultTransfer, setShowVaultTransfer] = useState(false);

  // Goals that already passed 50% / 100% get no repeat toast. Filled on first use.
  const notified = useRef<{ half: Set<string>; full: Set<string> } | null>(null);

  const checkMilestones = (goal: SavingsGoal, added: number) => {
    if (goal.targetAmount <= 0) return;
    if (!notified.current) {
      notified.current = {
        half: new Set(savingsGoals.filter((g) => g.targetAmount > 0 && g.currentAmount / g.targetAmount >= 0.5).map((g) => g.id)),
        full: new Set(savingsGoals.filter(isAchieved).map((g) => g.id)),
      };
    }
    const ratio = (goal.currentAmount + added) / goal.targetAmount;
    if (ratio >= 1 && !notified.current.full.has(goal.id)) {
      notified.current.full.add(goal.id);
      notified.current.half.add(goal.id);
      showToast(t("savings.milestone100"), "🎉");
    } else if (ratio >= 0.5 && !notified.current.half.has(goal.id)) {
      notified.current.half.add(goal.id);
      showToast(t("savings.milestone50"), "💪");
    }
  };

  const handleAddAmount = (goal: SavingsGoal, amount: number) => {
    // Taken from the balance; not capped at the target, so nothing is dropped (D-5).
    saveFromBalance(amount, goal.id, "");
    checkMilestones(goal, amount);
  };

  const confirmDelete = (goal: SavingsGoal, afterDelete?: () => void) => {
    const message =
      goal.currentAmount > 0
        ? t("savings.confirmDeleteGoal", { amount: formatMoney(goal.currentAmount, currency) })
        : t("history.confirm");
    Alert.alert(t("savings.delete"), message, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          deleteGoal(goal.id);
          afterDelete?.();
        },
      },
    ]);
  };

  const handleVaultTransfer = (goalId: string, amount: number) => {
    const goal = savingsGoals.find((g) => g.id === goalId);
    transferFromVault(amount, goalId);
    setShowVaultTransfer(false);
    if (goal) {
      showToast(t("savings.transferredTo", { name: goal.name }), "✅");
      checkMilestones(goal, Math.min(amount, vaultAmount));
    }
  };

  const openNewGoal = () =>
    // The id is created here, in the handler, never during render (KB-1).
    setEditor({
      goal: { id: uuid(), name: "", targetAmount: 0, currentAmount: 0, colorHex: "#00BCD4", deadline: undefined },
      isNew: true,
    });

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {ToastView}

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {t("savings.title")}
        </Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
          onPress={openNewGoal}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color={colors.accent} />
          <Text style={[styles.addButtonText, { color: colors.accent }]}>{t("savings.newGoal")}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={savingsGoals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <VaultCard amount={vaultAmount} currency={currency} onTransferPress={() => setShowVaultTransfer(true)} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="flag-outline" size={56} color={colors.separator} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("savings.noGoals")}</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{t("savings.noGoalsSub")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            currency={currency}
            onPress={() => setEditor({ goal: item, isNew: false })}
            onDelete={() => confirmDelete(item)}
            onAddAmount={(amount) => handleAddAmount(item, amount)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
      />

      {editor && (
        <GoalEditorModal
          goal={editor.goal}
          isNew={editor.isNew}
          onClose={() => setEditor(null)}
          onDelete={editor.isNew ? undefined : () => confirmDelete(editor.goal, () => setEditor(null))}
        />
      )}

      <VaultTransferModal
        visible={showVaultTransfer}
        vaultAmount={vaultAmount}
        currency={currency}
        goals={savingsGoals}
        onTransfer={handleVaultTransfer}
        onClose={() => setShowVaultTransfer(false)}
      />
    </View>
  );
}

// ─── Goal Editor Modal ────────────────────────────────────────────────────────
interface GoalEditorProps {
  goal: SavingsGoal;
  isNew: boolean;
  onClose: () => void;
  /** Asks for confirmation itself; closes the editor only after deleting (B-8). */
  onDelete?: () => void;
}

function GoalEditorModal({ goal, isNew, onClose, onDelete }: GoalEditorProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const currency = t("common.currency");

  const addGoal    = useAppStore((s) => s.addGoal);
  const updateGoal = useAppStore((s) => s.updateGoal);

  const [g, setG]                     = useState<SavingsGoal>(goal);
  const [useDeadline, setUseDeadline] = useState(!!goal.deadline);
  const [nameError, setNameError]     = useState(false);
  const target       = useAmountField(goal.targetAmount);
  // "Already saved" is only asked when creating: it is money saved outside the
  // app. Later changes go through "Add money", which uses the balance (D-5).
  const alreadySaved = useAmountField(goal.currentAmount, { allowZero: true });
  const [today]      = useState(() => new Date());
  const deadline     = g.deadline ? new Date(g.deadline) : today;

  const handleSave = () => {
    const targetAmount = target.parse();
    const currentAmount = isNew ? (alreadySaved.text.trim() ? alreadySaved.parse() : 0) : goal.currentAmount;
    const hasName = g.name.trim().length > 0;
    setNameError(!hasName);
    if (targetAmount === null || currentAmount === null || !hasName) return;
    const toSave: SavingsGoal = {
      ...g,
      name: g.name.trim(),
      targetAmount,
      currentAmount,
      deadline: useDeadline ? g.deadline ?? today.toISOString() : undefined,
    };
    if (isNew) addGoal(toSave);
    else updateGoal(toSave);
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding">
        <ModalHeader
          title={isNew ? t("savings.editor.newTitle") : t("savings.editor.editTitle")}
          cancelLabel={t("savings.editor.cancel")}
          saveLabel={t("savings.editor.save")}
          onCancel={onClose}
          onSave={handleSave}
        />

        <ScrollView
          style={styles.modalScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* Details */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("savings.editor.sections.details")}
            </Text>
            <View style={[styles.editorCard, { backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t("savings.editor.name")}
                placeholderTextColor={colors.textTertiary}
                value={g.name}
                onChangeText={(v) => { setG({ ...g, name: v }); setNameError(false); }}
                returnKeyType="next"
                accessibilityLabel={t("savings.editor.nameLabel")}
              />
              {nameError && (
                <Text style={[styles.fieldError, { color: colors.destructive }]}>{t("savings.editor.nameRequired")}</Text>
              )}
              <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
              <View style={styles.editRow}>
                <Text style={[styles.editLabel, { color: colors.text }]}>{t("savings.editor.target")}</Text>
                <TextInput
                  style={[styles.input, { flex: 1, textAlign: "right", color: colors.text }]}
                  value={target.text}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  onChangeText={target.onChangeText}
                  keyboardType="number-pad"
                  accessibilityLabel={t("savings.editor.target")}
                />
                <Text style={[styles.currencySuffix, { color: colors.textSecondary }]}>{currency}</Text>
              </View>
              {target.errorText && (
                <Text style={[styles.fieldError, { color: colors.destructive }]}>{target.errorText}</Text>
              )}
              {isNew && (
                <>
                  <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
                  <View style={styles.editRow}>
                    <Text style={[styles.editLabel, { color: colors.text }]}>{t("savings.editor.alreadySaved")}</Text>
                    <TextInput
                      style={[styles.input, { flex: 1, textAlign: "right", color: colors.text }]}
                      value={alreadySaved.text}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      onChangeText={alreadySaved.onChangeText}
                      keyboardType="number-pad"
                      accessibilityLabel={t("savings.editor.alreadySaved")}
                      accessibilityHint={t("savings.editor.alreadySavedHint")}
                    />
                    <Text style={[styles.currencySuffix, { color: colors.textSecondary }]}>{currency}</Text>
                  </View>
                  <Text style={[styles.fieldHint, { color: alreadySaved.errorText ? colors.destructive : colors.textSecondary }]}>
                    {alreadySaved.errorText ?? t("savings.editor.alreadySavedHint")}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Color */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("savings.editor.sections.color")}
            </Text>
            <View style={[styles.editorCard, styles.colorRow, { backgroundColor: colors.card }]} accessibilityRole="radiogroup">
              {COLOR_PALETTE.map((hex, i) => {
                const selected = g.colorHex === hex;
                return (
                  <TouchableOpacity
                    key={hex}
                    style={[styles.colorDot, { backgroundColor: hex }, selected && { borderColor: colors.text, borderWidth: 3 }]}
                    onPress={() => setG({ ...g, colorHex: hex })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t("a11y.colorOption", { n: i + 1 })}
                  >
                    {selected && <Ionicons name="checkmark" size={18} color="#ffffff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Deadline */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("savings.editor.sections.deadline")}
            </Text>
            <View style={[styles.editorCard, { backgroundColor: colors.card }]}>
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>{t("savings.editor.setDeadline")}</Text>
                <View style={styles.switchSlot}>
                  <Switch
                    value={useDeadline}
                    onValueChange={setUseDeadline}
                    trackColor={{ true: colors.accent }}
                    accessibilityLabel={t("savings.editor.setDeadline")}
                  />
                </View>
              </View>
              {useDeadline && (
                <>
                  <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
                  <DateField
                    label={t("savings.editor.date")}
                    value={deadline}
                    minimumDate={today}
                    onChange={(d) => setG({ ...g, deadline: d.toISOString() })}
                  />
                </>
              )}
            </View>
          </View>

          {/* Delete */}
          {!isNew && onDelete && (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: colors.card }]}
              onPress={onDelete}
              accessibilityRole="button"
            >
              <Ionicons name="trash" size={18} color={colors.destructive} />
              <Text style={[styles.deleteText, { color: colors.destructive }]}>{t("savings.editor.delete")}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Vault Transfer Sheet Styles ──────────────────────────────────────────────
const vtStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12, maxHeight: "85%" },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  amountRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 8, gap: 8 },
  amountLabel: { fontSize: 15 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: "700", paddingVertical: 10 },
  maxBtn: { borderRadius: 8, paddingHorizontal: 12, minHeight: 36, justifyContent: "center" },
  maxBtnText: { fontSize: 13, fontWeight: "600" },
  error: { fontSize: 13, marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginTop: 12, marginBottom: 8 },
  goalList: { maxHeight: 260, marginBottom: 16 },
  noGoals: { alignItems: "center", paddingVertical: 32, gap: 8 },
  noGoalsText: { fontSize: 14, textAlign: "center" },
  goalRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1.5, borderColor: "transparent" },
  goalDotBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 },
  goalDot: { width: 14, height: 14, borderRadius: 7 },
  goalInfo: { flex: 1, marginRight: 8 },
  goalName: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  goalSub: { fontSize: 12, marginBottom: 5 },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  confirmBtn: { borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8, minHeight: MIN_TOUCH },
  confirmText: { fontSize: 16, fontWeight: "600" },
  cancelBtn: { alignItems: "center", justifyContent: "center", minHeight: MIN_TOUCH },
  cancelText: { fontSize: 15 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, gap: 12 },
  headerTitle: { fontSize: 34, fontWeight: "700", letterSpacing: 0.3, flexShrink: 1 },
  addButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, minHeight: MIN_TOUCH, borderRadius: 22, shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  addButtonText: { fontSize: 15, fontWeight: "600" },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  vaultCard: { borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3, borderWidth: 1.5, gap: 12 },
  vaultLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  vaultText: { flex: 1 },
  vaultIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  vaultLabel: { fontSize: 16, fontWeight: "700" },
  vaultSub: { fontSize: 12, marginTop: 2 },
  vaultRight: { alignItems: "flex-end", gap: 6 },
  vaultAmount: { fontSize: 19, fontWeight: "800" },
  transferBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, minHeight: 36, borderRadius: 10 },
  transferBtnText: { fontSize: 14, fontWeight: "600" },
  swipeWrapper: { borderRadius: 16, overflow: "hidden" },
  deleteBackground: { position: "absolute", right: 0, top: 0, bottom: 0, width: 80, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  deleteAction: { alignItems: "center", justifyContent: "center", gap: 4, minWidth: MIN_TOUCH, minHeight: MIN_TOUCH },
  deleteActionText: { fontSize: 12, fontWeight: "500" },
  goalCard: { borderRadius: 16, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  goalRow: { padding: 16, gap: 10 },
  goalTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  goalColorDot: { width: 10, height: 10, borderRadius: 5 },
  goalName: { flex: 1, fontSize: 17, fontWeight: "600" },
  goalPct: { fontSize: 15, fontWeight: "700" },
  achievedBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  achievedText: { fontSize: 12, fontWeight: "600" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  goalBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  goalCurrent: { fontSize: 14, fontWeight: "600" },
  goalRemaining: { fontSize: 12, flexShrink: 1, textAlign: "center" },
  goalTarget: { fontSize: 13 },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: -2 },
  deadline: { fontSize: 12 },
  addSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 10 },
  addMoneyBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 14, minHeight: MIN_TOUCH, alignSelf: "flex-start" },
  addMoneyText: { fontSize: 14, fontWeight: "500" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addInput: { flex: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: MIN_TOUCH, fontSize: 15 },
  iconBtn: { borderRadius: 10, width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  fieldError: { fontSize: 13, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  fieldHint: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 12, marginTop: -4 },
  toast: { position: "absolute", alignSelf: "center", zIndex: 9999, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 30, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8, borderWidth: StyleSheet.hairlineWidth },
  toastIcon: { fontSize: 18 },
  toastText: { fontSize: 15, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "600" },
  emptySub: { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  modalScroll: { flex: 1 },
  section: { margin: 16, marginBottom: 0 },
  sectionHeader: { fontSize: 12, fontWeight: "600", marginBottom: 6, paddingHorizontal: 4, letterSpacing: 0.5 },
  editorCard: { borderRadius: 12, overflow: "hidden" },
  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  inputSep: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  editRow: { flexDirection: "row", alignItems: "center" },
  editLabel: { paddingLeft: 16, fontSize: 16, maxWidth: 140 },
  currencySuffix: { paddingRight: 16, fontSize: 15 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  colorDot: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: "center", justifyContent: "center" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, minHeight: MIN_TOUCH + 8 },
  switchLabel: { fontSize: 16, flex: 1 },
  // iOS 26 draws the switch larger than its reserved frame; centre it in a fixed box.
  switchSlot: { width: 64, height: 40, alignItems: "center", justifyContent: "center" },
  deleteButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 16, padding: 16, borderRadius: 12, minHeight: MIN_TOUCH },
  deleteText: { fontSize: 16, fontWeight: "500" },
});
