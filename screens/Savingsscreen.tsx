// screens/SavingsScreen.tsx
import React, { useState, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Modal, ScrollView, Switch, Alert,
  KeyboardAvoidingView, Platform, Animated, PanResponder,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppStore } from "../store/useAppStore";
import { formatAmount } from "../utils/helpers";
import { SavingsGoal } from "../models";
import { v4 as uuid } from "uuid";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";

// ─── Milestone Toast ──────────────────────────────────────────────────────────
function useMilestoneToast() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ msg: string; icon: string; visible: boolean }>({
    msg: "", icon: "", visible: false,
  });
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (msg: string, icon: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, icon, visible: true });
    Animated.sequence([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
      Animated.delay(2400),
      Animated.timing(translateY, { toValue: -120, duration: 280, useNativeDriver: true }),
    ]).start(() => setToast({ msg: "", icon: "", visible: false }));
  };

  const ToastView = toast.visible ? (
    <Animated.View style={[styles.toast, { top: insets.top + 12, transform: [{ translateY }] }]}>
      <Text style={styles.toastIcon}>{toast.icon}</Text>
      <Text style={styles.toastText}>{toast.msg}</Text>
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
  const [amountText, setAmountText] = useState("");

  const selectedGoal = goals.find((g) => g.id === selectedGoalId);
  const amount = parseFloat(amountText.replace(",", ".")) || 0;
  const canConfirm = !!selectedGoalId && amount > 0 && amount <= vaultAmount;

  const handleConfirm = () => {
    if (!selectedGoalId || amount <= 0) return;
    onTransfer(selectedGoalId, amount);
    setSelectedGoalId(null);
    setAmountText("");
  };

  const handleClose = () => {
    setSelectedGoalId(null);
    setAmountText("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={vtStyles.overlay}>
          <View style={[vtStyles.sheet, { backgroundColor: colors.card, paddingBottom: 24 + insets.bottom }]}>
            <View style={[vtStyles.handle, { backgroundColor: colors.separator }]} />

            <Text style={[vtStyles.title, { color: colors.text }]}>
              {t("savings.vaultTransfer.title")}
            </Text>
            <Text style={[vtStyles.subtitle, { color: colors.textSecondary }]}>
              {t("savings.vaultTransfer.available")}{" "}
              <Text style={{ fontWeight: "700", color: "#F97316" }}>
                {formatAmount(vaultAmount, currency)}
              </Text>
            </Text>

            <View style={[vtStyles.amountRow, { backgroundColor: colors.inputBg }]}>
              <Text style={[vtStyles.amountLabel, { color: colors.textSecondary }]}>
                {t("savings.vaultTransfer.amount")}
              </Text>
              <TextInput
                style={[vtStyles.amountInput, { color: colors.text }]}
                value={amountText}
                onChangeText={setAmountText}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity style={vtStyles.maxBtn} onPress={() => setAmountText(String(vaultAmount))}>
                <Text style={vtStyles.maxBtnText}>{t("savings.vaultTransfer.all")}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[vtStyles.sectionLabel, { color: colors.textSecondary }]}>
              {t("savings.vaultTransfer.pickGoal")}
            </Text>

            <ScrollView style={vtStyles.goalList} showsVerticalScrollIndicator={false}>
              {goals.length === 0 ? (
                <View style={vtStyles.noGoals}>
                  <Ionicons name="flag-outline" size={32} color={colors.separator} />
                  <Text style={[vtStyles.noGoalsText, { color: colors.textTertiary }]}>
                    {t("savings.vaultTransfer.noGoals")}
                  </Text>
                </View>
              ) : (
                goals.map((g) => {
                  const isSelected = selectedGoalId === g.id;
                  const pct = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
                  const remaining = Math.max(0, g.targetAmount - g.currentAmount);
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[
                        vtStyles.goalRow,
                        { backgroundColor: colors.inputBg, borderColor: "transparent" },
                        isSelected && { backgroundColor: colors.accent + "18", borderColor: colors.accent },
                      ]}
                      onPress={() => setSelectedGoalId(isSelected ? null : g.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[vtStyles.goalDotBox, { backgroundColor: g.colorHex + "22" }]}>
                        <View style={[vtStyles.goalDot, { backgroundColor: g.colorHex }]} />
                      </View>
                      <View style={vtStyles.goalInfo}>
                        <Text style={[vtStyles.goalName, { color: colors.text }]}>{g.name}</Text>
                        <Text style={[vtStyles.goalSub, { color: colors.textTertiary }]}>
                          {t("savings.more")} {formatAmount(remaining, currency)}
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
                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={[vtStyles.confirmBtn, !canConfirm && { opacity: 0.4 }]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-forward-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={vtStyles.confirmText}>
                {t("savings.vaultTransfer.confirm")}
                {selectedGoal && amount > 0 ? ` ${t("savings.vaultTransfer.to")} ${selectedGoal.name}` : ""}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleClose} style={vtStyles.cancelBtn}>
              <Text style={[vtStyles.cancelText, { color: colors.textTertiary }]}>
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
interface VaultCardProps {
  amount: number;
  currency: string;
  onTransferPress: () => void;
}

function VaultCard({ amount, currency, onTransferPress }: VaultCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.vaultCard, { backgroundColor: colors.card, borderColor: colors.background }]}>
      <View style={styles.vaultLeft}>
        <View style={[styles.vaultIconBox, { backgroundColor: colors.background }]}>
          <Ionicons name="lock-closed" size={22} color="#F97316" />
        </View>
        <View>
          <Text style={[styles.vaultLabel, { color: colors.text }]}>{t("savings.vault")}</Text>
          <Text style={styles.vaultSub}>{t("savings.vaultSub")}</Text>
        </View>
      </View>
      <View style={styles.vaultRight}>
        <Text style={styles.vaultAmount}>{formatAmount(amount, currency)}</Text>
        {amount > 0 && (
          <TouchableOpacity
            style={[styles.transferBtn, { backgroundColor: colors.background }]}
            onPress={onTransferPress}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-forward-circle-outline" size={14} color="#007AFF" />
            <Text style={[styles.transferBtnText, { color: colors.text }]}>
              {t("savings.transfer")}
            </Text>
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

function GoalCard({ goal, currency, onPress, onDelete, onAddAmount }: GoalCardProps) {
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState("");
  const translateX = useRef(new Animated.Value(0)).current;
  const DELETE_THRESHOLD = -80;
  const { colors } = useTheme();
  const { t } = useTranslation();

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, DELETE_THRESHOLD));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < DELETE_THRESHOLD / 2) {
          Animated.spring(translateX, { toValue: DELETE_THRESHOLD, useNativeDriver: true }).start();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const progress = goal.targetAmount > 0
    ? Math.min(1, goal.currentAmount / goal.targetAmount)
    : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const isAchieved = goal.currentAmount >= goal.targetAmount;

  const handleAdd = () => {
    const val = parseFloat(inputText.replace(",", ".")) || 0;
    if (val <= 0) return;
    onAddAmount(val);
    setInputText("");
    setShowInput(false);
  };

  return (
    <View style={styles.swipeWrapper}>
      <View style={styles.deleteBackground}>
        <TouchableOpacity style={styles.deleteAction} onPress={onDelete}>
          <Ionicons name="trash" size={22} color="#fff" />
          <Text style={styles.deleteActionText}>{t("savings.delete")}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.goalCard,
          isAchieved && styles.goalCardAchieved,
          { transform: [{ translateX }], backgroundColor: colors.card },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
            onPress();
          }}
        >
          <View style={styles.goalRow}>
            <View style={styles.goalTop}>
              <View style={[styles.goalColorDot, { backgroundColor: goal.colorHex }]} />
              <Text style={[styles.goalName, { color: colors.text }]}>{goal.name}</Text>
              {isAchieved && (
                <View style={styles.achievedBadge}>
                  <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                  <Text style={styles.achievedText}>{t("savings.achieved")}</Text>
                </View>
              )}
              <Text style={[styles.goalPct, { color: goal.colorHex }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: colors.background }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: goal.colorHex }]} />
            </View>

            <View style={styles.goalBottom}>
              <Text style={[styles.goalCurrent, { color: colors.text }]}>
                {formatAmount(goal.currentAmount, currency)}
              </Text>
              <Text style={styles.goalRemaining}>
                {remaining > 0
                  ? `${t("savings.more")} ${formatAmount(remaining, currency)}`
                  : t("savings.goalAchieved")}
              </Text>
              <Text style={styles.goalTarget}>{formatAmount(goal.targetAmount, currency)}</Text>
            </View>

            {goal.deadline && (
              <View style={styles.deadlineRow}>
                <Ionicons name="calendar-outline" size={12} color="#aaa" />
                <Text style={styles.deadline}>
                  {t("savings.deadline")} {new Date(goal.deadline).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {!isAchieved && (
          <View style={styles.addSection}>
            {showInput ? (
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.addInput, { backgroundColor: colors.background, color: colors.text }]}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={t("savings.enterAmount")}
                  placeholderTextColor="#bbb"
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <TouchableOpacity style={styles.confirmBtn} onPress={handleAdd}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelBtnSmall, { backgroundColor: colors.background }]}
                  onPress={() => { setShowInput(false); setInputText(""); }}
                >
                  <Ionicons name="close" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addMoneyBtn, { backgroundColor: colors.background }]}
                onPress={() => setShowInput(true)}
              >
                <Ionicons name="add-circle-outline" size={16} color="#007AFF" />
                <Text style={[styles.addMoneyText, { color: colors.text }]}>
                  {t("savings.addMoney")}
                </Text>
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

  const savingsGoals      = useAppStore((s) => s.savingsGoals);
  const vaultAmount       = useAppStore((s) => s.vaultAmount);
  const currency          = t("common.currency");
  const deleteGoal        = useAppStore((s) => s.deleteGoal);
  const saveFromBalance   = useAppStore((s) => s.saveFromBalance);
  const transferFromVault = useAppStore((s) => s.transferFromVault);

  const insets = useSafeAreaInsets();
  const { show: showToast, ToastView } = useMilestoneToast();

  const [showAdd, setShowAdd]                 = useState(false);
  const [editing, setEditing]                 = useState<SavingsGoal | null>(null);
  const [showVaultTransfer, setShowVaultTransfer] = useState(false);

  const notified50 = useRef<Set<string>>(
    new Set(savingsGoals.filter(g => g.currentAmount / g.targetAmount >= 0.5).map(g => g.id))
  );
  const notified100 = useRef<Set<string>>(
    new Set(savingsGoals.filter(g => g.currentAmount >= g.targetAmount).map(g => g.id))
  );

  const handleAddAmount = (goal: SavingsGoal, amount: number) => {
    const prevRatio = goal.currentAmount / goal.targetAmount;
    // Taken from the balance; not capped at the target, so nothing is dropped (D-5).
    const newCurrent = goal.currentAmount + amount;
    const newRatio = newCurrent / goal.targetAmount;

    saveFromBalance(amount, goal.id, "");

    if (!notified50.current.has(goal.id) && newRatio >= 0.5 && prevRatio < 0.5) {
      notified50.current.add(goal.id);
      setTimeout(() => showToast(t("savings.milestone50"), "💪"), 300);
    }
    if (!notified100.current.has(goal.id) && newCurrent >= goal.targetAmount) {
      notified100.current.add(goal.id);
      setTimeout(() => showToast(t("savings.milestone100"), "🎉"), 300);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(t("savings.delete"), t("savings.confirmDelete"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => deleteGoal(id) },
    ]);
  };

  const handleVaultTransfer = (goalId: string, amount: number) => {
    transferFromVault(amount, goalId);
    const goal = savingsGoals.find((g) => g.id === goalId);
    setShowVaultTransfer(false);
    showToast(`${t("savings.vaultTransfer.confirm")} → ${goal?.name ?? ""}!`, "✅");
  };

  const emptyGoal: SavingsGoal = {
    id: uuid(),
    name: "",
    targetAmount: 0,
    currentAmount: 0,
    colorHex: "#00BCD4",
    deadline: undefined,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {ToastView}

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("savings.title")}</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.card }]}
          onPress={() => { setEditing(null); setShowAdd(true); }}
        >
          <Ionicons name="add" size={20} color={colors.accent} />
          <Text style={[styles.addButtonText, { color: colors.accent }]}>{t("savings.newGoal")}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={savingsGoals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: 72 + 34 + 16 }]}
        ListHeaderComponent={
          <VaultCard
            amount={vaultAmount}
            currency={currency}
            onTransferPress={() => setShowVaultTransfer(true)}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="flag-outline" size={56} color={colors.separator} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("savings.noGoals")}</Text>
            <Text style={[styles.emptySub, { color: colors.textTertiary }]}>{t("savings.noGoalsSub")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            currency={currency}
            onPress={() => { setEditing(item); setShowAdd(true); }}
            onDelete={() => handleDelete(item.id)}
            onAddAmount={(amount) => handleAddAmount(item, amount)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
      />

      {showAdd && (
        <GoalEditorModal
          goal={editing ?? { ...emptyGoal, id: uuid() }}
          isNew={!editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onDelete={editing ? () => { handleDelete(editing.id); setShowAdd(false); setEditing(null); } : undefined}
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
  onDelete?: () => void;
}

const COLOR_PALETTE = [
  "#4CAF50", "#FF9800", "#2196F3", "#F44336",
  "#9C27B0", "#00BCD4", "#FFC107", "#E91E63",
];

function GoalEditorModal({ goal, isNew, onClose, onDelete }: GoalEditorProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const addGoal    = useAppStore((s) => s.addGoal);
  const updateGoal = useAppStore((s) => s.updateGoal);

  const [g, setG]                           = useState<SavingsGoal>(goal);
  const [useDeadline, setUseDeadline]       = useState(!!goal.deadline);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const canSave = g.name.trim().length > 0 && g.targetAmount > 0;
  const selectedDate = g.deadline ? new Date(g.deadline) : new Date();

  // presentationStyle="pageSheet" is honored on iOS (which already applies its
  // own top safe-area padding), but Android ignores it and renders the modal
  // full-screen with no inset — without this the Cancel/Save row sits right
  // under the status bar. Add the inset manually only on Android.
  const modalHeaderTopPad = 16 + (Platform.OS === "android" ? insets.top : 0);

  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowAndroidPicker(false);
    if (event.type === "dismissed") return;
    if (date) setG({ ...g, deadline: date.toISOString() });
  };

  const handleSave = () => {
    const toSave = { ...g, deadline: useDeadline ? g.deadline : undefined };
    if (isNew) addGoal(toSave);
    else updateGoal(toSave);
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.modalHeader,
            { backgroundColor: colors.background, borderBottomColor: colors.separator, paddingTop: modalHeaderTopPad },
          ]}
        >
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.modalCancelBtn, { color: colors.destructive }]}>
              {t("savings.editor.cancel")}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {isNew ? t("savings.editor.newTitle") : t("savings.editor.editTitle")}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={!canSave}>
            <Text style={[styles.modalSaveBtn, { color: colors.accent }, !canSave && { opacity: 0.4 }]}>
              {t("savings.editor.save")}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={[styles.modalScroll, { backgroundColor: colors.background }]}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom }}
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
                onChangeText={(v) => setG({ ...g, name: v })}
              />
              <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
              <View style={styles.editRow}>
                <Text style={[styles.editLabel, { color: colors.text }]}>
                  {t("savings.editor.target")}
                </Text>
                <TextInput
                  style={[styles.input, { flex: 1, textAlign: "right", color: colors.text }]}
                  value={g.targetAmount > 0 ? String(g.targetAmount) : ""}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  onChangeText={(v) => setG({ ...g, targetAmount: parseFloat(v) || 0 })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
              <View style={styles.editRow}>
                <Text style={[styles.editLabel, { color: colors.text }]}>
                  {t("savings.editor.current")}
                </Text>
                <TextInput
                  style={[styles.input, { flex: 1, textAlign: "right", color: colors.text }]}
                  value={g.currentAmount > 0 ? String(g.currentAmount) : ""}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  onChangeText={(v) => setG({ ...g, currentAmount: parseFloat(v) || 0 })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          {/* Color */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("savings.editor.sections.color")}
            </Text>
            <View style={[styles.editorCard, styles.colorRow, { backgroundColor: colors.card }]}>
              {COLOR_PALETTE.map((hex) => (
                <TouchableOpacity
                  key={hex}
                  style={[styles.colorDot, { backgroundColor: hex }, g.colorHex === hex && styles.colorDotSelected]}
                  onPress={() => setG({ ...g, colorHex: hex })}
                />
              ))}
            </View>
          </View>

          {/* Deadline */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("savings.editor.sections.deadline")}
            </Text>
            <View style={[styles.editorCard, { backgroundColor: colors.card }]}>
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>
                  {t("savings.editor.setDeadline")}
                </Text>
                <Switch
                  value={useDeadline}
                  onValueChange={(val) => {
                    setUseDeadline(val);
                    if (val && !g.deadline) setG({ ...g, deadline: new Date().toISOString() });
                  }}
                  trackColor={{ true: colors.accent }}
                />
              </View>
              {useDeadline && (
                <>
                  <View style={[styles.inputSep, { backgroundColor: colors.separator }]} />
                  {Platform.OS === "ios" ? (
                    <View style={styles.datePickerRow}>
                      <Text style={[styles.datePickerLabel, { color: colors.text }]}>
                        {t("savings.editor.date")}
                      </Text>
                      <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display="compact"
                        minimumDate={new Date()}
                        onChange={onDateChange}
                        locale="mk"
                        style={styles.iosDatePicker}
                      />
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.datePickerRow}
                        onPress={() => setShowAndroidPicker(true)}
                      >
                        <Text style={[styles.datePickerLabel, { color: colors.text }]}>
                          {t("savings.editor.date")}
                        </Text>
                        <View style={[styles.androidDateDisplay, { backgroundColor: colors.accent + "18" }]}>
                          <Ionicons name="calendar-outline" size={16} color={colors.accent} />
                          <Text style={[styles.androidDateText, { color: colors.accent }]}>
                            {selectedDate.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {showAndroidPicker && (
                        <DateTimePicker
                          value={selectedDate}
                          mode="date"
                          display="calendar"
                          minimumDate={new Date()}
                          onChange={onDateChange}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </View>
          </View>

          {/* Delete */}
          {!isNew && onDelete && (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: colors.card }]}
              onPress={onDelete}
            >
              <Ionicons name="trash" size={18} color={colors.destructive} />
              <Text style={[styles.deleteText, { color: colors.destructive }]}>
                {t("savings.editor.delete")}
              </Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 40 }} />
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
  amountRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 20, gap: 8 },
  amountLabel: { fontSize: 15, width: 56 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: "700", paddingVertical: 10 },
  maxBtn: { backgroundColor: "#FFF7ED", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  maxBtnText: { fontSize: 13, fontWeight: "600", color: "#F97316" },
  sectionLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 8 },
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
  confirmBtn: { backgroundColor: "#007AFF", borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  confirmText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 15 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 34, fontWeight: "700", letterSpacing: 0.3 },
  addButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  addButtonText: { fontSize: 15, fontWeight: "600" },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  vaultCard: { borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3, borderWidth: 1.5 },
  vaultLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  vaultIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  vaultLabel: { fontSize: 16, fontWeight: "700" },
  vaultSub: { fontSize: 12, color: "#aaa", marginTop: 2, width: 110 },
  vaultRight: { alignItems: "flex-end", gap: 6 },
  vaultAmount: { fontSize: 19, fontWeight: "800", color: "#F97316" },
  transferBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  transferBtnText: { fontSize: 14, fontWeight: "600" },
  swipeWrapper: { borderRadius: 16, overflow: "hidden" },
  deleteBackground: { position: "absolute", right: 0, top: 0, bottom: 0, width: 80, backgroundColor: "#FF3B30", borderRadius: 16, justifyContent: "center", alignItems: "center" },
  deleteAction: { alignItems: "center", gap: 4 },
  deleteActionText: { fontSize: 11, color: "#fff", fontWeight: "500" },
  goalCard: { borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  goalCardAchieved: { backgroundColor: "#f0fdf4" },
  goalRow: { padding: 16, gap: 10 },
  goalTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  goalColorDot: { width: 10, height: 10, borderRadius: 5 },
  goalName: { flex: 1, fontSize: 17, fontWeight: "600" },
  goalPct: { fontSize: 15, fontWeight: "700" },
  achievedBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#dcfce7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  achievedText: { fontSize: 11, fontWeight: "600", color: "#16A34A" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  goalBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalCurrent: { fontSize: 14, fontWeight: "600" },
  goalRemaining: { fontSize: 12, color: "#aaa" },
  goalTarget: { fontSize: 13, color: "#888" },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: -2 },
  deadline: { fontSize: 11, color: "#aaa" },
  addSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#f0f0f0", paddingHorizontal: 16, paddingVertical: 10 },
  addMoneyBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, alignSelf: "flex-start" },
  addMoneyText: { fontSize: 14, fontWeight: "500" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addInput: { flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  confirmBtn: { backgroundColor: "#007AFF", borderRadius: 10, padding: 9, alignItems: "center", justifyContent: "center" },
  cancelBtnSmall: { borderRadius: 10, padding: 9, alignItems: "center", justifyContent: "center" },
  toast: { position: "absolute", alignSelf: "center", zIndex: 9999, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 13, borderRadius: 30, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.06)" },
  toastIcon: { fontSize: 18 },
  toastText: { fontSize: 15, fontWeight: "600", color: "#000" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "600" },
  emptySub: { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  modalCancelBtn: { fontSize: 17 },
  modalSaveBtn: { fontSize: 17, fontWeight: "600" },
  modalScroll: { flex: 1 },
  section: { margin: 16, marginBottom: 0 },
  sectionHeader: { fontSize: 12, fontWeight: "600", marginBottom: 6, paddingHorizontal: 4, letterSpacing: 0.5 },
  editorCard: { borderRadius: 12, overflow: "hidden" },
  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  inputSep: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  editRow: { flexDirection: "row", alignItems: "center" },
  editLabel: { paddingLeft: 16, fontSize: 16, width: 90 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  colorDotSelected: { borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 3, elevation: 3 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  switchLabel: { fontSize: 16 },
  deleteButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 16, padding: 16, borderRadius: 12 },
  deleteText: { fontSize: 16, fontWeight: "500" },
  datePickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  datePickerLabel: { fontSize: 16 },
  iosDatePicker: { marginRight: -4 },
  androidDateDisplay: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  androidDateText: { fontSize: 14, fontWeight: "500" },
});