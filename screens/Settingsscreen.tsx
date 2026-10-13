import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { v4 as uuid } from "uuid";
import { useAppStore, persistedSnapshot } from "../store/useAppStore";
import { buildExport } from "../store/backup";
import { useTheme } from "../hooks/useTheme";
import { Category, categoryLabel, incomeForMonth, monthKey } from "../models";
import { formatAmount, validateAmount } from "../utils/money";
import { amountErrorText, amountKeyboard, useCurrency } from "../hooks/useCurrency";
import { dateLocale, monthStart } from "../utils/dates";
import { haptics } from "../utils/haptics";
import { ModalHeader } from "@/components/ModalHeader";
import { CurrencyPicker } from "@/components/CurrencyPicker";
import { Icon, type IconName } from "@/components/Icon";
import { CATEGORY_ICONS, CategoryIcon, DEFAULT_CATEGORY_ICON, categoryIconName } from "@/components/CategoryIcon";
import { PressableRow } from "@/components/ui/Pressables";
import { Section, Separator } from "@/components/ui/Section";
import { COLOR_PALETTE, dataColor } from "@/constants/palette";
import { APP_VERSION } from "@/constants/app";
import { GUTTER, ROW_MIN, SECTION_GAP, corners, inputType, money, radius, space, tint, type } from "@/constants/design";

/** Icon tile in front of a settings row, like iOS Settings. */
function RowTile({ icon, color }: { icon: IconName; color: string }) {
  return (
    <View style={[styles.tile, { backgroundColor: color }]}>
      <Icon name={icon} size={16} color="#FFFFFF" />
    </View>
  );
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const categories        = useAppStore((s) => s.categories);
  const initialBalance    = useAppStore((s) => s.initialBalance);
  const setInitialBalance = useAppStore((s) => s.setInitialBalance);
  const currency          = useCurrency();
  const setCurrency       = useAppStore((s) => s.setCurrency);
  // Once there are transactions the currency is fixed: they would change meaning.
  const currencyLocked    = useAppStore((s) => s.transactions.length > 0);
  const setMonthlyIncome  = useAppStore((s) => s.setMonthlyIncome);
  // Read through a selector so it is re-evaluated on every render;
  // React Compiler would cache a plain `new Date()` in render.
  const thisMonth         = useAppStore(() => monthKey(new Date()));
  const monthlyIncome     = useAppStore((s) => incomeForMonth(s.incomeSchedule, thisMonth));
  const storedTheme       = useAppStore((s) => s.theme);
  const setTheme          = useAppStore((s) => s.setTheme);
  const storedLanguage    = useAppStore((s) => s.language);
  const setLanguage       = useAppStore((s) => s.setLanguage);
  const resetAll          = useAppStore((s) => s.resetAll);

  const [editor, setEditor] = useState<{ category: Category; isNew: boolean } | null>(null);
  const [pickingCurrency, setPickingCurrency] = useState(false);

  const handleCurrencyPress = () => {
    if (!currencyLocked) {
      setPickingCurrency(true);
      return;
    }
    haptics.warning();
    Alert.alert(t("settings.currencyLockedTitle"), t("settings.currencyLockedBody", { code: currency.code }));
  };

  const monthLabel = monthStart(thisMonth).toLocaleString(dateLocale(i18n.language), {
    month: "long",
    year: "numeric",
  });

  // The id must be created here, not during render: React Compiler caches
  // render-time values, which gave every new category the same id (KB-1).
  const handleAddCategory = () =>
    setEditor({
      category: { id: uuid(), name: "", colorHex: "#AF52DE", iconName: DEFAULT_CATEGORY_ICON, subcategories: [] },
      isNew: true,
    });

  const handleExport = async () => {
    try {
      await Share.share({ title: t("settings.exportTitle"), message: buildExport(persistedSnapshot()) });
    } catch {
      Alert.alert(t("settings.exportFailed"));
    }
  };

  const handleDeleteAll = () => {
    haptics.warning();
    Alert.alert(t("settings.deleteAllTitle"), t("settings.deleteAllBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.deleteAllConfirm"),
        style: "destructive",
        // Suggestions learn from the transactions, so this forgets them too.
        onPress: () => resetAll(),
      },
    ]);
  };

  const choiceRow = (opts: { key: string; label: string; selected: boolean; onPress: () => void; icon: IconName; tileColor: string }) => (
    <PressableRow
      key={opts.key}
      style={styles.row}
      onPress={() => {
        if (!opts.selected) haptics.selection();
        opts.onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: opts.selected }}
    >
      <RowTile icon={opts.icon} color={opts.tileColor} />
      <Text style={[type.body, styles.rowLabel, { color: colors.text }]}>{opts.label}</Text>
      {opts.selected && <Icon name="check" size={18} color={colors.accent} />}
    </PressableRow>
  );

  const themes: { value: "light" | "dark" | "system"; label: string; icon: IconName; tile: string }[] = [
    { value: "light",  label: t("settings.light"),  icon: "sun",   tile: "#FF9500" },
    { value: "dark",   label: t("settings.dark"),   icon: "moon",  tile: "#5856D6" },
    { value: "system", label: t("settings.system"), icon: "phone", tile: "#8E8E93" },
  ];

  const languages: { value: string | null; label: string }[] = [
    { value: null, label: t("settings.deviceLanguage") },
    { value: "mk", label: t("settings.macedonian") },
    { value: "en", label: t("settings.english") },
  ];

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Section title={t("settings.general")}>
          <PressableRow
            style={styles.row}
            onPress={handleCurrencyPress}
            accessibilityRole="button"
            accessibilityLabel={`${t("settings.currency")}, ${t(`currency.name.${currency.code}`)}`}
            accessibilityHint={currencyLocked ? t("settings.currencyLockedTitle") : t("settings.currencyHint")}
          >
            <Text style={[type.body, styles.rowLabel, { color: colors.text }]}>{t("settings.currency")}</Text>
            <Text style={[type.body, { color: colors.textSecondary }]}>{currency.code}</Text>
            <Icon name="chevronForward" size={14} color={colors.textTertiary} />
          </PressableRow>
          {!currencyLocked && (
            <Text style={[type.footnote, styles.rowFooter, { color: colors.textSecondary }]}>{t("settings.currencyHint")}</Text>
          )}
          <Separator />
          {/* Keyed by currency: changing it rescales the amounts, so the rows start over. */}
          <AmountRow
            key={`balance-${currency.code}`}
            label={t("settings.startBalance")}
            value={initialBalance}
            allowZero
            hint={t("settings.startBalanceHint")}
            onSave={setInitialBalance}
          />
          <Separator />
          <AmountRow
            key={`income-${currency.code}`}
            label={t("settings.monthlyIncome")}
            value={monthlyIncome}
            placeholder={t("settings.notSet")}
            hint={t("settings.monthlyIncomeHint", { month: monthLabel })}
            onSave={setMonthlyIncome}
          />
        </Section>

        <Section title={t("settings.appearance")}>
          <View accessibilityRole="radiogroup">
            {themes.map((opt, i) => (
              <React.Fragment key={opt.value}>
                {choiceRow({
                  key: opt.value,
                  label: opt.label,
                  icon: opt.icon,
                  tileColor: opt.tile,
                  selected: storedTheme === opt.value,
                  onPress: () => setTheme(opt.value),
                })}
                {i < themes.length - 1 && <Separator inset={space[4] + 29 + space[3]} />}
              </React.Fragment>
            ))}
          </View>
        </Section>

        {/* "Device language" follows the phone's language (B-3). */}
        <Section title={t("settings.language")}>
          <View accessibilityRole="radiogroup">
            {languages.map((lang, i) => (
              <React.Fragment key={lang.value ?? "device"}>
                {choiceRow({
                  key: lang.value ?? "device",
                  label: lang.label,
                  icon: "globe",
                  tileColor: "#007AFF",
                  selected: storedLanguage === lang.value,
                  onPress: () => setLanguage(lang.value),
                })}
                {i < languages.length - 1 && <Separator inset={space[4] + 29 + space[3]} />}
              </React.Fragment>
            ))}
          </View>
        </Section>

        <Section title={t("settings.categories")}>
          {categories.map((c) => {
            const color = dataColor(c.colorHex, isDark);
            return (
              <View key={c.id}>
                <PressableRow
                  style={styles.row}
                  onPress={() => setEditor({ category: c, isNew: false })}
                  accessibilityRole="button"
                  accessibilityLabel={`${categoryLabel(c, t)}, ${t("settings.subcatCount", { count: c.subcategories.length })}`}
                  accessibilityHint={t("a11y.editHint")}
                >
                  <View style={[styles.tile, { backgroundColor: tint(color, "soft") }]}>
                    <CategoryIcon iconName={c.iconName} size={16} color={color} />
                  </View>
                  <Text style={[type.body, styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                    {categoryLabel(c, t)}
                  </Text>
                  <Text style={[type.subheadline, { color: colors.textSecondary }]}>
                    {t("settings.subcatCount", { count: c.subcategories.length })}
                  </Text>
                  <Icon name="chevronForward" size={14} color={colors.textTertiary} />
                </PressableRow>
                <Separator inset={space[4] + 29 + space[3]} />
              </View>
            );
          })}
          <PressableRow style={styles.row} onPress={handleAddCategory} accessibilityRole="button">
            <Icon name="plusCircle" size={22} color={colors.accent} />
            <Text style={[type.body, { color: colors.accent }]}>{t("settings.addCategory")}</Text>
          </PressableRow>
        </Section>

        {/* Your data (R-11, S-8) */}
        <Section title={t("settings.data")} footer={t("settings.dataFooter")}>
          <PressableRow style={styles.row} onPress={handleExport} accessibilityRole="button">
            <RowTile icon="share" color="#34C759" />
            <Text style={[type.body, styles.rowLabel, { color: colors.text }]}>{t("settings.export")}</Text>
          </PressableRow>
          <Separator inset={space[4] + 29 + space[3]} />
          <PressableRow style={styles.row} onPress={handleDeleteAll} accessibilityRole="button">
            <RowTile icon="trash" color="#FF3B30" />
            <Text style={[type.body, styles.rowLabel, { color: colors.destructive }]}>{t("settings.deleteAll")}</Text>
          </PressableRow>
        </Section>

        <Section title={t("settings.about")}>
          <PressableRow style={styles.row} onPress={() => router.push("/privacy")} accessibilityRole="link">
            <RowTile icon="doc" color="#8E8E93" />
            <Text style={[type.body, styles.rowLabel, { color: colors.text }]}>{t("privacy.title")}</Text>
            <Icon name="chevronForward" size={14} color={colors.textTertiary} />
          </PressableRow>
          <Separator inset={space[4] + 29 + space[3]} />
          <View style={styles.row}>
            <RowTile icon="info" color="#8E8E93" />
            <Text style={[type.body, styles.rowLabel, { color: colors.text }]}>{t("settings.version")}</Text>
            <Text style={[type.body, { color: colors.textSecondary }]}>{APP_VERSION}</Text>
          </View>
        </Section>
      </ScrollView>

      {pickingCurrency && (
        <CurrencyPicker
          selected={currency.code}
          onSelect={(code) => {
            if (code !== currency.code) {
              setCurrency(code);
              haptics.success();
            }
            setPickingCurrency(false);
          }}
          onClose={() => setPickingCurrency(false)}
        />
      )}

      {editor && (
        <CategoryEditorModal category={editor.category} isNew={editor.isNew} onClose={() => setEditor(null)} />
      )}
    </>
  );
}

// ─── Amount Row ────────────────────────────────────────────────────────────────

/** Editable amount in the app currency; validates and saves when editing ends. */
function AmountRow({
  label,
  value,
  placeholder,
  hint,
  allowZero = false,
  onSave,
}: {
  label: string;
  value: number;
  placeholder?: string;
  hint?: string;
  allowZero?: boolean;
  onSave: (amount: number) => void;
}) {
  const { t }      = useTranslation();
  const { colors } = useTheme();
  const currency   = useCurrency();
  const [text, setText]   = useState(
    value > 0 || allowZero ? formatAmount(value, currency, { trimZeroCents: true }) : ""
  );
  const [error, setError] = useState<string | null>(null);

  const handleEndEditing = () => {
    // Leaving an unset field empty is fine; it just stays unset.
    if (!allowZero && value === 0 && text.trim() === "") return;
    const result = validateAmount(text, currency, { allowZero });
    if ("error" in result) {
      haptics.error();
      setError(amountErrorText(t, result.error, currency));
      return;
    }
    setText(formatAmount(result.amount, currency, { trimZeroCents: true }));
    if (result.amount !== value) {
      haptics.success();
      onSave(result.amount);
    }
  };

  const footer = error ?? hint;

  return (
    <View>
      <View style={styles.row}>
        <Text style={[type.body, styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <TextInput
          style={[inputType(type.body), money, styles.rowInput, { color: colors.accent }]}
          value={text}
          onChangeText={(v) => { setText(v); setError(null); }}
          onEndEditing={handleEndEditing}
          keyboardType={amountKeyboard(currency)}
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={label}
          accessibilityHint={footer}
        />
      </View>
      {footer ? (
        <Text style={[type.footnote, styles.rowFooter, { color: error ? colors.destructive : colors.textSecondary }]}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Category Editor Modal ─────────────────────────────────────────────────────

function CategoryEditorModal({
  category,
  isNew,
  onClose,
}: {
  category: Category;
  isNew: boolean;
  onClose: () => void;
}) {
  const { t }          = useTranslation();
  const { colors, isDark } = useTheme();
  const insets         = useSafeAreaInsets();
  const addCategory    = useAppStore((s) => s.addCategory);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const deleteCategory = useAppStore((s) => s.deleteCategory);

  // Built-in names are shown translated; editing the field stores the typed name.
  const [name, setName]             = useState(categoryLabel(category, t));
  const [cat, setCat]               = useState<Category>(category);
  const [newSubName, setNewSubName] = useState("");

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    const renamed = name.trim() !== categoryLabel(category, t);
    const toSave: Category = renamed ? { ...cat, name: name.trim(), nameKey: undefined } : cat;
    if (isNew) addCategory(toSave);
    else updateCategory(toSave);
    haptics.success();
    onClose();
  };

  // Confirm while the sheet is open, then close (B-8).
  const handleDelete = () => {
    haptics.warning();
    Alert.alert(t("settings.editor.delete"), t("settings.editor.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          deleteCategory(cat.id);
          onClose();
        },
      },
    ]);
  };

  const addSub = () => {
    const n = newSubName.trim();
    if (!n) return;
    setCat({ ...cat, subcategories: [...cat.subcategories, { id: uuid(), name: n, keywords: [] }] });
    setNewSubName("");
  };

  const removeSub = (id: string) =>
    setCat({ ...cat, subcategories: cat.subcategories.filter((s) => s.id !== id) });

  const selectedIcon = categoryIconName(cat.iconName);
  const catColor = dataColor(cat.colorHex, isDark);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding">
        <ModalHeader
          title={isNew ? t("settings.editor.newTitle") : t("settings.editor.editTitle")}
          cancelLabel={t("settings.editor.cancel")}
          saveLabel={t("settings.editor.save")}
          onCancel={onClose}
          onSave={handleSave}
          saveDisabled={!canSave}
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[10] }]}
        >
          <Section title={t("settings.editor.sections.basic")}>
            <TextInput
              style={[inputType(type.body), styles.input, { color: colors.text }]}
              placeholder={t("settings.editor.name")}
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              accessibilityLabel={t("settings.editor.name")}
            />
          </Section>

          <Section title={t("settings.editor.sections.color")}>
            <View style={styles.grid} accessibilityRole="radiogroup">
              {COLOR_PALETTE.map((hex, i) => {
                const selected = cat.colorHex.toUpperCase() === hex.toUpperCase();
                return (
                  <Pressable
                    key={hex}
                    style={[styles.swatch, { backgroundColor: dataColor(hex, isDark) }, selected && { borderColor: colors.text, borderWidth: 3 }]}
                    onPress={() => { haptics.selection(); setCat({ ...cat, colorHex: hex }); }}
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

          {/* The chosen icon is shown on the category's rows (U-15). */}
          <Section title={t("settings.editor.sections.icon")}>
            <View style={styles.grid} accessibilityRole="radiogroup">
              {CATEGORY_ICONS.map((ic, i) => {
                const selected = selectedIcon === ic;
                return (
                  <Pressable
                    key={ic}
                    style={[styles.iconChoice, { backgroundColor: selected ? catColor : colors.fill }]}
                    onPress={() => { haptics.selection(); setCat({ ...cat, iconName: ic }); }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t("a11y.iconOption", { n: i + 1 })}
                  >
                    <CategoryIcon iconName={ic} size={20} color={selected ? "#FFFFFF" : colors.text} />
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section title={t("settings.editor.sections.subs")}>
            {cat.subcategories.map((s) => (
              <View key={s.id}>
                <View style={[styles.row, styles.subRow]}>
                  <Text style={[type.body, styles.rowLabel, { color: colors.text }]}>{categoryLabel(s, t)}</Text>
                  <Pressable
                    onPress={() => removeSub(s.id)}
                    style={styles.subDelete}
                    accessibilityRole="button"
                    accessibilityLabel={t("settings.editor.removeSub", { name: categoryLabel(s, t) })}
                  >
                    <Icon name="trash" size={18} color={colors.destructive} />
                  </Pressable>
                </View>
                <Separator />
              </View>
            ))}
            <View style={styles.subAddRow}>
              <TextInput
                style={[inputType(type.body), styles.input, styles.flex, { color: colors.text }]}
                placeholder={t("settings.editor.newSub")}
                placeholderTextColor={colors.placeholder}
                value={newSubName}
                onChangeText={setNewSubName}
                returnKeyType="done"
                onSubmitEditing={addSub}
                accessibilityLabel={t("settings.editor.newSub")}
              />
              <Pressable
                onPress={addSub}
                style={styles.subAddBtn}
                disabled={!newSubName.trim()}
                accessibilityRole="button"
                accessibilityState={{ disabled: !newSubName.trim() }}
              >
                <Text style={[type.headline, { color: newSubName.trim() ? colors.accent : colors.placeholder }]}>
                  {t("settings.editor.add")}
                </Text>
              </Pressable>
            </View>
          </Section>

          {!isNew && (
            <Section>
              <PressableRow style={[styles.row, styles.centerRow]} onPress={handleDelete} accessibilityRole="button">
                <Text style={[type.body, { color: colors.destructive }]}>{t("settings.editor.delete")}</Text>
              </PressableRow>
            </Section>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content:    { paddingHorizontal: GUTTER, paddingTop: space[4], paddingBottom: space[8], gap: SECTION_GAP },
  flex:       { flex: 1 },
  row:        { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], minHeight: ROW_MIN + 4 },
  centerRow:  { justifyContent: "center" },
  rowLabel:   { flex: 1 },
  rowInput:   { textAlign: "right", minWidth: 100, paddingVertical: space[3] },
  rowFooter:  { paddingHorizontal: space[4], marginTop: -space[1], paddingBottom: space[3] },
  tile:       { width: 29, height: 29, alignItems: "center", justifyContent: "center", ...corners(7) },
  input:      { paddingHorizontal: space[4], paddingVertical: space[3], minHeight: ROW_MIN },
  grid:       { flexDirection: "row", flexWrap: "wrap", padding: space[3], gap: space[3] },
  swatch:     { width: ROW_MIN, height: ROW_MIN, borderRadius: ROW_MIN / 2, alignItems: "center", justifyContent: "center" },
  iconChoice: { width: ROW_MIN, height: ROW_MIN, alignItems: "center", justifyContent: "center", ...corners(radius.sm) },
  subRow:     { paddingRight: 0 },
  subDelete:  { width: ROW_MIN + 4, height: ROW_MIN + 4, alignItems: "center", justifyContent: "center" },
  subAddRow:  { flexDirection: "row", alignItems: "center" },
  subAddBtn:  { minHeight: ROW_MIN, paddingHorizontal: space[4], justifyContent: "center" },
});

