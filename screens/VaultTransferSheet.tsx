import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { showToast } from "../store/session";
import { calculateGoalProgress } from "../models";
import { formatMoney, validateAmount } from "../utils/money";
import { haptics } from "../utils/haptics";
import { useTheme } from "@/hooks/useTheme";
import { useAmountField } from "@/hooks/useAmountField";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { PressableRow } from "@/components/ui/Pressables";
import { Section, Separator } from "@/components/ui/Section";
import { dataColor } from "@/constants/palette";
import { GUTTER, ROW_MIN, corners, inputType, money, radius, space, tint, type } from "@/constants/design";
import { ProgressBar } from "@/components/ui/ProgressBar";

/** Move money from the vault to a goal, as a native form sheet (DESIGN.md §3.9). */
export default function VaultTransferSheet() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const currency = t("common.currency");

  const vaultAmount       = useAppStore((s) => s.vaultAmount);
  const goals             = useAppStore((s) => s.savingsGoals);
  const transferFromVault = useAppStore((s) => s.transferFromVault);

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const amountField = useAmountField();

  const selectedGoal = goals.find((g) => g.id === selectedGoalId);
  const parsed = validateAmount(amountField.text);
  const amount = "amount" in parsed ? parsed.amount : 0;
  const exceeds = amount > vaultAmount;
  const canConfirm = !!selectedGoal && amount > 0 && !exceeds;

  const close = () => (router.canGoBack() ? router.back() : router.replace("/savings"));

  const handleConfirm = () => {
    if (!selectedGoal || !canConfirm) {
      haptics.error();
      return;
    }
    transferFromVault(amount, selectedGoal.id);
    haptics.success();
    showToast(t("savings.transferredTo", { name: selectedGoal.name }));
    close();
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.surfaceRaised }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={[type.title2, { color: colors.text }]} accessibilityRole="header">
        {t("savings.vaultTransfer.title")}
      </Text>
      <Text style={[type.subheadline, { color: colors.textSecondary }]}>
        {t("savings.vaultTransfer.availableAmount", { amount: formatMoney(vaultAmount, currency) })}
      </Text>

      <View style={[styles.amountBox, { backgroundColor: colors.fill }]}>
        <TextInput
          style={[inputType(type.title1), money, styles.amountInput, { color: colors.text }]}
          value={amountField.text}
          onChangeText={amountField.onChangeText}
          placeholder="0"
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
          accessibilityLabel={t("savings.vaultTransfer.amount")}
        />
        <Pressable
          style={[styles.allButton, { backgroundColor: colors.vaultBg }]}
          onPress={() => { haptics.selection(); amountField.setAmount(vaultAmount); }}
          accessibilityRole="button"
        >
          <Text style={[type.subheadline, { color: colors.vault, fontWeight: "600" }]}>{t("savings.vaultTransfer.all")}</Text>
        </Pressable>
      </View>
      {exceeds && (
        <Text style={[type.footnote, { color: colors.destructive }]}>
          {t("savings.vaultTransfer.exceeds", { amount: formatMoney(vaultAmount, currency) })}
        </Text>
      )}

      <Section title={t("savings.vaultTransfer.pickGoal")} cardStyle={{ backgroundColor: colors.background }}>
        {goals.length === 0 ? (
          <View style={styles.noGoals}>
            <Icon name="flag" size={28} color={colors.placeholder} />
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{t("savings.vaultTransfer.noGoals")}</Text>
          </View>
        ) : (
          goals.map((g, i) => {
            const selected = selectedGoalId === g.id;
            const color = dataColor(g.colorHex, isDark);
            const remaining = Math.max(0, g.targetAmount - g.currentAmount);
            return (
              <View key={g.id}>
                {i > 0 && <Separator inset={space[4] + 32 + space[3]} />}
                <PressableRow
                  style={styles.goalRow}
                  onPress={() => { haptics.selection(); setSelectedGoalId(g.id); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.tile, { backgroundColor: tint(color, "soft") }]}>
                    <Icon name="flag" size={16} color={color} />
                  </View>
                  <View style={styles.goalText}>
                    <Text style={[type.body, { color: colors.text }]} numberOfLines={1}>{g.name}</Text>
                    <Text style={[type.footnote, money, { color: colors.textSecondary }]}>
                      {t("savings.remaining", { amount: formatMoney(remaining, currency) })}
                    </Text>
                    <ProgressBar progress={calculateGoalProgress(g.currentAmount, g.targetAmount)} color={color} />
                  </View>
                  <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.separator, backgroundColor: selected ? colors.accent : "transparent" }]}>
                    {selected && <Icon name="check" size={13} color={colors.onAccent} />}
                  </View>
                </PressableRow>
              </View>
            );
          })
        )}
      </Section>

      <View style={styles.actions}>
        <Button
          title={selectedGoal && amount > 0
            ? t("savings.vaultTransfer.confirmTo", { name: selectedGoal.name })
            : t("savings.vaultTransfer.confirm")}
          icon="transfer"
          onPress={handleConfirm}
          disabled={!canConfirm}
        />
        <Button title={t("savings.vaultTransfer.cancel")} variant="plain" onPress={close} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content:     { padding: GUTTER, paddingTop: space[8], gap: space[3] },
  amountBox:   { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], minHeight: ROW_MIN + 20, ...corners(radius.md) },
  amountInput: { flex: 1, minWidth: 0, paddingVertical: space[2] },
  allButton:   { paddingHorizontal: space[3], minHeight: 32, justifyContent: "center", ...corners(radius.pill) },
  noGoals:     { alignItems: "center", paddingVertical: space[6], gap: space[2] },
  goalRow:     { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  goalText:    { flex: 1, gap: space[1] },
  tile:        { width: 32, height: 32, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  radio:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  actions:     { gap: space[2], marginTop: space[3] },
});
