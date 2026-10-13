// screens/SavingsScreen.tsx
import React, { useRef, useState } from "react";
import {
  View, Text, FlatList, TextInput, Pressable,
  StyleSheet, Modal, ScrollView, Switch, Alert,
  KeyboardAvoidingView, Animated, PanResponder,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { v4 as uuid } from "uuid";
import { useAppStore } from "../store/useAppStore";
import { showToast } from "../store/session";
import { SavingsGoal, calculateGoalProgress } from "../models";
import { formatMoney, type MoneyFormat } from "../utils/money";
import { formatDate } from "../utils/dates";
import { haptics } from "../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { amountKeyboard, useCurrency } from "@/hooks/useCurrency";
import { useMotion } from "@/hooks/useMotion";
import { useAmountField } from "@/hooks/useAmountField";
import { ModalHeader } from "@/components/ModalHeader";
import { DateField } from "@/components/DateField";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { PressableRow } from "@/components/ui/Pressables";
import { Section, Separator } from "@/components/ui/Section";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { COLOR_PALETTE, dataColor } from "@/constants/palette";
import {
  GUTTER, ROW_MIN, SECTION_GAP, corners, elevation, inputType, money, radius, space, tint, type,
} from "@/constants/design";

const isAchieved = (g: SavingsGoal) => g.targetAmount > 0 && g.currentAmount >= g.targetAmount;

// ─── Vault Card ───────────────────────────────────────────────────────────────
function VaultCard({ amount, currency, onTransferPress }: { amount: number; currency: MoneyFormat; onTransferPress: () => void }) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.card, styles.vaultCard, { backgroundColor: colors.card }, elevation.raised(isDark)]}>
      <View style={[styles.vaultTile, { backgroundColor: colors.vaultBg }]}>
        <Icon name="vault" size={20} color={colors.vault} />
      </View>
      <View style={styles.flex}>
        <Text style={[type.headline, { color: colors.text }]}>{t("savings.vault")}</Text>
        <Text style={[type.footnote, { color: colors.textSecondary }]}>{t("savings.vaultSub")}</Text>
      </View>
      <View style={styles.vaultRight}>
        <Text style={[type.title3, money, { color: colors.vault }]}>{formatMoney(amount, currency)}</Text>
        {amount > 0 && (
          <Pressable
            style={[styles.smallButton, { backgroundColor: tint(colors.accent, "subtle") }]}
            onPress={onTransferPress}
            accessibilityRole="button"
          >
            <Text style={[type.subheadline, { color: colors.accent, fontWeight: "600" }]}>{t("savings.transfer")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Swipeable Goal Card ──────────────────────────────────────────────────────
interface GoalCardProps {
  goal: SavingsGoal;
  currency: MoneyFormat;
  onPress: () => void;
  onDelete: () => void;
  onAddAmount: (amount: number) => void;
}

const DELETE_THRESHOLD = -88;

function GoalCard({ goal, currency, onPress, onDelete, onAddAmount }: GoalCardProps) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const { spring } = useMotion();
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
        Animated.spring(translateX, { toValue: open ? DELETE_THRESHOLD : 0, damping: 20, stiffness: 200, useNativeDriver: true }).start();
      },
    })
  );

  const color     = dataColor(goal.colorHex, isDark);
  const progress  = calculateGoalProgress(goal.currentAmount, goal.targetAmount);
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const achieved  = isAchieved(goal);

  const handleAdd = () => {
    const value = amountField.parse();
    if (value === null) {
      haptics.error();
      return;
    }
    onAddAmount(value);
    amountField.reset();
    setShowInput(false);
  };

  return (
    <View style={styles.swipeWrapper}>
      {/* Hidden until the card moves: at rest its edge would show through the
          card's anti-aliased rounded corners as a thin red line. */}
      <Animated.View
        style={[
          styles.deleteBackground,
          {
            backgroundColor: colors.destructive,
            opacity: translateX.interpolate({ inputRange: [-24, 0], outputRange: [1, 0], extrapolate: "clamp" }),
          },
        ]}
      >
        <Pressable style={styles.deleteAction} onPress={onDelete} accessibilityRole="button">
          <Icon name="trash" size={20} color={colors.onAccent} />
          <Text style={[type.caption, { color: colors.onAccent, fontWeight: "600" }]}>{t("savings.delete")}</Text>
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[styles.card, { backgroundColor: colors.card, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={() => {
            spring(translateX, 0, "standard").start();
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${goal.name}, ${formatMoney(goal.currentAmount, currency)} / ${formatMoney(goal.targetAmount, currency)}, ${Math.round(progress * 100)}%`}
          accessibilityHint={t("a11y.editHint")}
          // Swipe-to-delete is not reachable with a screen reader; offer it as an action.
          accessibilityActions={[{ name: "delete", label: t("savings.delete") }]}
          onAccessibilityAction={(e) => e.nativeEvent.actionName === "delete" && onDelete()}
          style={styles.goalBody}
        >
          <View style={styles.goalTop}>
            <View style={[styles.goalDot, { backgroundColor: color }]} />
            <Text style={[type.headline, styles.flex, { color: colors.text }]} numberOfLines={1}>{goal.name}</Text>
            {achieved ? (
              <View style={[styles.badge, { backgroundColor: colors.successBg }]}>
                <Icon name="sealCheck" size={13} color={colors.successText} />
                <Text style={[type.caption, { color: colors.successText, fontWeight: "600" }]}>{t("savings.achieved")}</Text>
              </View>
            ) : (
              <Text style={[type.subheadline, money, { color: colors.textSecondary }]}>{Math.round(progress * 100)}%</Text>
            )}
          </View>

          <ProgressBar progress={progress} color={color} />

          <View style={styles.goalBottom}>
            <Text style={[type.subheadline, money, { color: colors.text, fontWeight: "600" }]}>{formatMoney(goal.currentAmount, currency)}</Text>
            <Text style={[type.footnote, money, { color: colors.textSecondary }]}>
              {remaining > 0 ? t("savings.remaining", { amount: formatMoney(remaining, currency) }) : t("savings.goalAchieved")}
            </Text>
          </View>

          {goal.deadline && (
            <View style={styles.deadlineRow}>
              <Icon name="calendar" size={12} color={colors.textSecondary} />
              <Text style={[type.caption, { color: colors.textSecondary }]}>
                {t("savings.deadlineOn", { date: formatDate(goal.deadline, i18n.language) })}
              </Text>
            </View>
          )}
        </Pressable>

        {!achieved && (
          <View>
            <Separator inset={0} />
            {showInput ? (
              <View style={styles.addRow}>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[inputType(type.body), money, styles.addInput, { backgroundColor: colors.fill, color: colors.text }]}
                    value={amountField.text}
                    onChangeText={amountField.onChangeText}
                    placeholder={t("savings.enterAmount")}
                    placeholderTextColor={colors.placeholder}
                    keyboardType={amountKeyboard(currency)}
                    autoFocus
                    accessibilityLabel={t("savings.enterAmount")}
                  />
                  <Pressable
                    style={[styles.iconButton, { backgroundColor: colors.accent }]}
                    onPress={handleAdd}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.confirm")}
                  >
                    <Icon name="check" size={18} color={colors.onAccent} />
                  </Pressable>
                  <Pressable
                    style={[styles.iconButton, { backgroundColor: colors.fill }]}
                    onPress={() => { setShowInput(false); amountField.reset(); }}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.cancel")}
                  >
                    <Icon name="close" size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
                {amountField.errorText && (
                  <Text style={[type.footnote, { color: colors.destructive }]}>{amountField.errorText}</Text>
                )}
              </View>
            ) : (
              <PressableRow style={styles.addMoneyRow} onPress={() => setShowInput(true)} accessibilityRole="button">
                <Icon name="plusCircle" size={18} color={colors.accent} />
                <Text style={[type.body, { color: colors.accent }]}>{t("savings.addMoney")}</Text>
              </PressableRow>
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
  const router = useRouter();
  const currency = useCurrency();

  const savingsGoals    = useAppStore((s) => s.savingsGoals);
  const vaultAmount     = useAppStore((s) => s.vaultAmount);
  const deleteGoal      = useAppStore((s) => s.deleteGoal);
  const saveFromBalance = useAppStore((s) => s.saveFromBalance);

  const [editor, setEditor] = useState<{ goal: SavingsGoal; isNew: boolean } | null>(null);

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
      showToast(t("savings.milestone100"), "sealCheck");
    } else if (ratio >= 0.5 && !notified.current.half.has(goal.id)) {
      notified.current.half.add(goal.id);
      showToast(t("savings.milestone50"), "star", colors.warning);
    }
  };

  const handleAddAmount = (goal: SavingsGoal, amount: number) => {
    // Taken from the balance; not capped at the target, so nothing is dropped (D-5).
    saveFromBalance(amount, goal.id, "");
    haptics.success();
    checkMilestones(goal, amount);
  };

  const confirmDelete = (goal: SavingsGoal, afterDelete?: () => void) => {
    haptics.warning();
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

  const openNewGoal = () =>
    // The id is created here, in the handler, never during render (KB-1).
    setEditor({
      goal: { id: uuid(), name: "", targetAmount: 0, currentAmount: 0, colorHex: "#30B0C7", deadline: undefined },
      isNew: true,
    });

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={openNewGoal}
              hitSlop={8}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel={t("savings.newGoal")}
            >
              <Icon name="plus" size={22} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={savingsGoals}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <VaultCard amount={vaultAmount} currency={currency} onTransferPress={() => router.push("/savings/transfer")} />
            {savingsGoals.length > 0 && (
              <Text style={[type.sectionHeader, styles.sectionHeader, { color: colors.textSecondary }]} accessibilityRole="header">
                {t("savings.goals")}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="flag" size={48} color={colors.placeholder} />
            <Text style={[type.title3, { color: colors.text }]}>{t("savings.noGoals")}</Text>
            <Text style={[type.footnote, styles.emptySub, { color: colors.textSecondary }]}>{t("savings.noGoalsSub")}</Text>
            <Button title={t("savings.newGoal")} variant="tinted" icon="plus" onPress={openNewGoal} style={styles.emptyButton} />
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
        ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
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
    </>
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
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const currency = useCurrency();

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
    if (targetAmount === null || currentAmount === null || !hasName) {
      haptics.error();
      return;
    }
    const toSave: SavingsGoal = {
      ...g,
      name: g.name.trim(),
      targetAmount,
      currentAmount,
      deadline: useDeadline ? g.deadline ?? today.toISOString() : undefined,
    };
    if (isNew) addGoal(toSave);
    else updateGoal(toSave);
    haptics.success();
    onClose();
  };

  const detailsError = nameError ? t("savings.editor.nameRequired") : target.errorText ?? alreadySaved.errorText;

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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.editorContent, { paddingBottom: insets.bottom + space[10] }]}
        >
          <Section
            title={t("savings.editor.sections.details")}
            footer={detailsError ?? (isNew ? t("savings.editor.alreadySavedHint") : null)}
            footerColor={detailsError ? colors.destructive : undefined}
          >
            <TextInput
              style={[inputType(type.body), styles.input, { color: colors.text }]}
              placeholder={t("savings.editor.name")}
              placeholderTextColor={colors.placeholder}
              value={g.name}
              onChangeText={(v) => { setG({ ...g, name: v }); setNameError(false); }}
              returnKeyType="next"
              accessibilityLabel={t("savings.editor.nameLabel")}
            />
            <Separator />
            <View style={styles.editRow}>
              <Text style={[type.body, { color: colors.text }]}>{t("savings.editor.target")}</Text>
              <TextInput
                style={[inputType(type.body), money, styles.amountInput, { color: colors.text }]}
                value={target.text}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                onChangeText={target.onChangeText}
                keyboardType={amountKeyboard(currency)}
                accessibilityLabel={t("savings.editor.target")}
              />
              <Text style={[type.body, { color: colors.textSecondary }]}>{currency.label}</Text>
            </View>
            {isNew && (
              <>
                <Separator />
                <View style={styles.editRow}>
                  <Text style={[type.body, { color: colors.text }]}>{t("savings.editor.alreadySaved")}</Text>
                  <TextInput
                    style={[inputType(type.body), money, styles.amountInput, { color: colors.text }]}
                    value={alreadySaved.text}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    onChangeText={alreadySaved.onChangeText}
                    keyboardType={amountKeyboard(currency)}
                    accessibilityLabel={t("savings.editor.alreadySaved")}
                    accessibilityHint={t("savings.editor.alreadySavedHint")}
                  />
                  <Text style={[type.body, { color: colors.textSecondary }]}>{currency.label}</Text>
                </View>
              </>
            )}
          </Section>

          <Section title={t("savings.editor.sections.color")}>
            <View style={styles.grid} accessibilityRole="radiogroup">
              {COLOR_PALETTE.map((hex, i) => {
                const selected = g.colorHex.toUpperCase() === hex.toUpperCase();
                return (
                  <Pressable
                    key={hex}
                    style={[styles.swatch, { backgroundColor: dataColor(hex, isDark) }, selected && { borderColor: colors.text, borderWidth: 3 }]}
                    onPress={() => { haptics.selection(); setG({ ...g, colorHex: hex }); }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t("a11y.colorOption", { n: i + 1 })}
                  >
                    {selected && <Icon name="check" size={18} color="#FFFFFF" />}
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section title={t("savings.editor.sections.deadline")}>
            <View style={styles.switchRow}>
              <Text style={[type.body, styles.flex, { color: colors.text }]}>{t("savings.editor.setDeadline")}</Text>
              {/* iOS 26 draws the switch larger than its reserved frame; centre it in a fixed box. */}
              <View style={styles.switchSlot}>
                <Switch
                  value={useDeadline}
                  onValueChange={setUseDeadline}
                  trackColor={{ true: colors.success }}
                  accessibilityLabel={t("savings.editor.setDeadline")}
                />
              </View>
            </View>
            {useDeadline && (
              <>
                <Separator />
                <DateField
                  label={t("savings.editor.date")}
                  value={deadline}
                  minimumDate={today}
                  onChange={(d) => setG({ ...g, deadline: d.toISOString() })}
                />
              </>
            )}
          </Section>

          {!isNew && onDelete && (
            <Section>
              <PressableRow style={styles.centerRow} onPress={onDelete} accessibilityRole="button">
                <Text style={[type.body, { color: colors.destructive }]}>{t("savings.editor.delete")}</Text>
              </PressableRow>
            </Section>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:             { flex: 1 },
  content:          { paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: space[8], flexGrow: 1 },
  headerButton:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  listHeader:       { marginBottom: space[2] },
  sectionHeader:    { paddingHorizontal: space[4], marginTop: SECTION_GAP },
  card:             { ...corners(radius.lg) },
  vaultCard:        { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4] },
  vaultTile:        { width: 40, height: 40, alignItems: "center", justifyContent: "center", ...corners(radius.md) },
  vaultRight:       { alignItems: "flex-end", gap: space[2] },
  smallButton:      { paddingHorizontal: space[3], minHeight: 32, justifyContent: "center", ...corners(radius.pill) },
  swipeWrapper:     { ...corners(radius.lg), overflow: "hidden" },
  deleteBackground: { position: "absolute", right: 0, top: 0, bottom: 0, width: 88, alignItems: "center", justifyContent: "center", ...corners(radius.lg) },
  deleteAction:     { alignItems: "center", justifyContent: "center", gap: space[1], minWidth: ROW_MIN, minHeight: ROW_MIN },
  goalBody:         { padding: space[4], gap: space[3] },
  goalTop:          { flexDirection: "row", alignItems: "center", gap: space[2] },
  goalDot:          { width: 10, height: 10, borderRadius: 5 },
  badge:            { flexDirection: "row", alignItems: "center", gap: space[1], paddingHorizontal: space[2], paddingVertical: 3, ...corners(radius.pill) },
  goalBottom:       { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space[2] },
  deadlineRow:      { flexDirection: "row", alignItems: "center", gap: space[1], marginTop: -space[1] },
  addMoneyRow:      { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: ROW_MIN + 4 },
  addRow:           { padding: space[3], gap: space[2] },
  inputRow:         { flexDirection: "row", alignItems: "center", gap: space[2] },
  addInput:         { flex: 1, minWidth: 0, paddingHorizontal: space[3], minHeight: ROW_MIN, borderRadius: radius.sm },
  iconButton:       { width: ROW_MIN, height: ROW_MIN, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  empty:            { alignItems: "center", paddingVertical: space[10], gap: space[3] },
  emptySub:         { textAlign: "center", paddingHorizontal: space[8] },
  emptyButton:      { marginTop: space[2], alignSelf: "center" },
  editorContent:    { paddingHorizontal: GUTTER, paddingTop: space[4], gap: SECTION_GAP },
  input:            { paddingHorizontal: space[4], paddingVertical: space[3], minHeight: ROW_MIN },
  editRow:          { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: ROW_MIN + 4 },
  amountInput:      { flex: 1, minWidth: 0, textAlign: "right", paddingVertical: space[3] },
  grid:             { flexDirection: "row", flexWrap: "wrap", padding: space[3], gap: space[3] },
  swatch:           { width: ROW_MIN, height: ROW_MIN, borderRadius: ROW_MIN / 2, alignItems: "center", justifyContent: "center" },
  switchRow:        { flexDirection: "row", alignItems: "center", gap: space[3], paddingLeft: space[4], paddingRight: space[3], paddingVertical: space[1] + 2, minHeight: ROW_MIN + 8 },
  switchSlot:       { width: 64, height: 40, alignItems: "center", justifyContent: "center" },
  centerRow:        { alignItems: "center", justifyContent: "center", minHeight: ROW_MIN + 4 },
});
