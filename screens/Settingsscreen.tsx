import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Share,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { v4 as uuid } from "uuid";
import { useAppStore, persistedSnapshot } from "../store/useAppStore";
import { buildExport } from "../store/backup";
import { ModelStore } from "../services/categorizer/storage";
import { useTheme } from "../hooks/useTheme";
import { Category, categoryLabel, incomeForMonth, monthKey } from "../models";
import { MAX_AMOUNT_MKD, formatWholeDenars, validateAmount } from "../utils/money";
import { dateLocale, monthStart } from "../utils/dates";
import { ModalHeader } from "@/components/ModalHeader";
import { CATEGORY_ICONS, CategoryIcon, DEFAULT_CATEGORY_ICON, categoryIconName } from "@/components/CategoryIcon";
import { MIN_TOUCH, useTabBarSpace } from "@/constants/layout";
import { APP_VERSION } from "@/constants/app";

const COLOR_PALETTE = [
  "#4CAF50", "#FF9800", "#2196F3", "#F44336",
  "#9C27B0", "#00BCD4", "#FFC107", "#795548", "#E91E63",
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const bottomSpace = useTabBarSpace();
  const router      = useRouter();

  const categories        = useAppStore((s) => s.categories);
  const initialBalance    = useAppStore((s) => s.initialBalance);
  const setInitialBalance = useAppStore((s) => s.setInitialBalance);
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

  const monthLabel = monthStart(thisMonth).toLocaleString(dateLocale(i18n.language), {
    month: "long",
    year: "numeric",
  });

  // The id must be created here, not during render: React Compiler caches
  // render-time values, which gave every new category the same id (KB-1).
  const handleAddCategory = () =>
    setEditor({
      category: { id: uuid(), name: "", colorHex: "#9C27B0", iconName: DEFAULT_CATEGORY_ICON, subcategories: [] },
      isNew: true,
    });

  const handleExport = async () => {
    try {
      await Share.share({ title: t("settings.exportTitle"), message: buildExport(persistedSnapshot()) });
    } catch {
      Alert.alert(t("settings.exportFailed"));
    }
  };

  const handleDeleteAll = () =>
    Alert.alert(t("settings.deleteAllTitle"), t("settings.deleteAllBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.deleteAllConfirm"),
        style: "destructive",
        onPress: async () => {
          // Also forget what the categorizer learned from this user.
          await new ModelStore().clearAll().catch(() => undefined);
          resetAll();
        },
      },
    ]);

  const card = [styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }];
  const sep  = <View style={[styles.sep, { backgroundColor: colors.separator }]} />;
  const sectionHeader = (label: string) => (
    <Text style={[styles.sectionHeader, { color: colors.textSecondary }]} accessibilityRole="header">
      {label}
    </Text>
  );

  const choiceRow = (opts: {
    key: string;
    label: string;
    selected: boolean;
    onPress: () => void;
    icon?: React.ComponentProps<typeof Ionicons>["name"];
    badge?: string;
  }) => (
    <TouchableOpacity
      key={opts.key}
      style={styles.row}
      onPress={opts.onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected: opts.selected }}
    >
      <View style={[styles.themeIcon, opts.selected && { backgroundColor: `${colors.accent}18` }]}>
        {opts.icon ? (
          <Ionicons name={opts.icon} size={18} color={opts.selected ? colors.accent : colors.textSecondary} />
        ) : (
          <Text style={{ color: opts.selected ? colors.accent : colors.text }}>{opts.badge}</Text>
        )}
      </View>
      <Text style={[styles.rowLabel, { color: opts.selected ? colors.accent : colors.text }, opts.selected && styles.bold]}>
        {opts.label}
      </Text>
      {opts.selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}
    </TouchableOpacity>
  );

  const themes = [
    { value: "light",  label: t("settings.light"),  icon: "sunny-outline"          },
    { value: "dark",   label: t("settings.dark"),   icon: "moon-outline"           },
    { value: "system", label: t("settings.system"), icon: "phone-portrait-outline" },
  ] as const;

  const languages: { value: string | null; label: string; badge?: string; icon?: "phone-portrait-outline" }[] = [
    { value: null, label: t("settings.deviceLanguage"), icon: "phone-portrait-outline" },
    { value: "mk", label: t("settings.macedonian"), badge: "mk" },
    { value: "en", label: t("settings.english"), badge: "en" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
            {t("settings.title")}
          </Text>
        </View>

        {/* General */}
        <View style={styles.section}>
          {sectionHeader(t("settings.general"))}
          <View style={card}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t("settings.currency")}</Text>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{t("common.currency")}</Text>
            </View>
            {sep}
            <AmountRow
              label={t("settings.startBalance")}
              value={initialBalance}
              allowZero
              hint={t("settings.startBalanceHint")}
              onSave={setInitialBalance}
            />
            {sep}
            <AmountRow
              label={t("settings.monthlyIncome")}
              value={monthlyIncome}
              placeholder={t("settings.notSet")}
              hint={t("settings.monthlyIncomeHint", { month: monthLabel })}
              onSave={setMonthlyIncome}
            />
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          {sectionHeader(t("settings.appearance"))}
          <View style={card} accessibilityRole="radiogroup">
            {themes.map((opt, i) => (
              <React.Fragment key={opt.value}>
                {choiceRow({
                  key: opt.value,
                  label: opt.label,
                  icon: opt.icon,
                  selected: storedTheme === opt.value,
                  onPress: () => setTheme(opt.value),
                })}
                {i < themes.length - 1 && sep}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Language: "device" follows the phone's language (B-3) */}
        <View style={styles.section}>
          {sectionHeader(t("settings.language"))}
          <View style={card} accessibilityRole="radiogroup">
            {languages.map((lang, i) => (
              <React.Fragment key={lang.value ?? "device"}>
                {choiceRow({
                  key: lang.value ?? "device",
                  label: lang.label,
                  icon: lang.icon,
                  badge: lang.badge,
                  selected: storedLanguage === lang.value,
                  onPress: () => setLanguage(lang.value),
                })}
                {i < languages.length - 1 && sep}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          {sectionHeader(t("settings.categories"))}
          <View style={card}>
            {categories.map((c) => (
              <View key={c.id}>
                <TouchableOpacity
                  style={styles.catRow}
                  onPress={() => setEditor({ category: c, isNew: false })}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${categoryLabel(c, t)}, ${t("settings.subcatCount", { count: c.subcategories.length })}`}
                  accessibilityHint={t("a11y.editHint")}
                >
                  <View style={[styles.catIcon, { backgroundColor: `${c.colorHex}22` }]}>
                    <CategoryIcon iconName={c.iconName} size={16} color={c.colorHex} />
                  </View>
                  <Text style={[styles.catName, { color: colors.text }]} numberOfLines={1}>{categoryLabel(c, t)}</Text>
                  <Text style={[styles.subCount, { color: colors.textSecondary }]}>
                    {t("settings.subcatCount", { count: c.subcategories.length })}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {sep}
              </View>
            ))}
            <TouchableOpacity style={styles.addCatRow} onPress={handleAddCategory} accessibilityRole="button">
              <Ionicons name="add-circle" size={20} color={colors.accent} />
              <Text style={[styles.addCatText, { color: colors.accent }]}>{t("settings.addCategory")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Your data (R-11, S-8) */}
        <View style={styles.section}>
          {sectionHeader(t("settings.data"))}
          <View style={card}>
            <TouchableOpacity style={styles.row} onPress={handleExport} accessibilityRole="button">
              <Ionicons name="share-outline" size={20} color={colors.accent} style={styles.rowIcon} />
              <Text style={[styles.rowLabel, { color: colors.accent }]}>{t("settings.export")}</Text>
            </TouchableOpacity>
            {sep}
            <TouchableOpacity style={styles.row} onPress={handleDeleteAll} accessibilityRole="button">
              <Ionicons name="trash-outline" size={20} color={colors.destructive} style={styles.rowIcon} />
              <Text style={[styles.rowLabel, { color: colors.destructive }]}>{t("settings.deleteAll")}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.footer, { color: colors.textSecondary }]}>{t("settings.dataFooter")}</Text>
        </View>

        {/* About */}
        <View style={styles.section}>
          {sectionHeader(t("settings.about"))}
          <View style={card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push("/privacy")}
              accessibilityRole="link"
            >
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t("privacy.title")}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            {sep}
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t("settings.version")}</Text>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{APP_VERSION}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {editor && (
        <CategoryEditorModal
          category={editor.category}
          isNew={editor.isNew}
          onClose={() => setEditor(null)}
        />
      )}
    </View>
  );
}

// ─── Amount Row ────────────────────────────────────────────────────────────────

/** Editable whole-denar amount; validates and saves when editing ends. */
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
  const [text, setText]   = useState(value > 0 || allowZero ? formatWholeDenars(value) : "");
  const [error, setError] = useState<string | null>(null);

  const handleEndEditing = () => {
    // Leaving an unset field empty is fine; it just stays unset.
    if (!allowZero && value === 0 && text.trim() === "") return;
    const result = validateAmount(text, { allowZero });
    if ("error" in result) {
      setError(t(`settings.amountErrors.${result.error}`, { max: formatWholeDenars(MAX_AMOUNT_MKD) }));
      return;
    }
    setText(formatWholeDenars(result.amount));
    if (result.amount !== value) onSave(result.amount);
  };

  const footer = error ?? hint;

  return (
    <View>
      <View style={styles.row}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <TextInput
          style={[styles.rowInput, { color: colors.accent }]}
          value={text}
          onChangeText={(v) => { setText(v); setError(null); }}
          onEndEditing={handleEndEditing}
          keyboardType="number-pad"
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={label}
          accessibilityHint={footer}
        />
      </View>
      {footer ? (
        <Text style={[styles.rowFooter, { color: error ? colors.destructive : colors.textSecondary }]}>
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
  const { colors }     = useTheme();
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
    onClose();
  };

  // Confirm while the sheet is open, then close (B-8).
  const handleDelete = () =>
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

  const addSub = () => {
    const n = newSubName.trim();
    if (!n) return;
    setCat({ ...cat, subcategories: [...cat.subcategories, { id: uuid(), name: n, keywords: [] }] });
    setNewSubName("");
  };

  const removeSub = (id: string) =>
    setCat({ ...cat, subcategories: cat.subcategories.filter((s) => s.id !== id) });

  const selectedIcon = categoryIconName(cat.iconName);

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
          style={styles.modalScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          <View style={styles.section}>
            {sectionTitle(t("settings.editor.sections.basic"), colors.textSecondary)}
            <View style={[styles.editorCard, { backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t("settings.editor.name")}
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                returnKeyType="done"
                accessibilityLabel={t("settings.editor.name")}
              />
            </View>
          </View>

          <View style={styles.section}>
            {sectionTitle(t("settings.editor.sections.color"), colors.textSecondary)}
            <View style={[styles.editorCard, styles.colorRow, { backgroundColor: colors.card }]} accessibilityRole="radiogroup">
              {COLOR_PALETTE.map((hex, i) => {
                const selected = cat.colorHex === hex;
                return (
                  <TouchableOpacity
                    key={hex}
                    style={[styles.colorDot, { backgroundColor: hex }, selected && { borderColor: colors.text, borderWidth: 3 }]}
                    onPress={() => setCat({ ...cat, colorHex: hex })}
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

          {/* The chosen icon is shown on the category's rows (U-15). */}
          <View style={styles.section}>
            {sectionTitle(t("settings.editor.sections.icon"), colors.textSecondary)}
            <View style={[styles.editorCard, styles.colorRow, { backgroundColor: colors.card }]} accessibilityRole="radiogroup">
              {CATEGORY_ICONS.map((ic, i) => {
                const selected = selectedIcon === ic;
                return (
                  <TouchableOpacity
                    key={ic}
                    style={[styles.iconBtn, { backgroundColor: selected ? cat.colorHex : colors.inputBg }]}
                    onPress={() => setCat({ ...cat, iconName: ic })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t("a11y.iconOption", { n: i + 1 })}
                  >
                    <Ionicons name={ic} size={20} color={selected ? "#ffffff" : colors.text} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            {sectionTitle(t("settings.editor.sections.subs"), colors.textSecondary)}
            <View style={[styles.editorCard, { backgroundColor: colors.card }]}>
              {cat.subcategories.map((s) => (
                <View key={s.id}>
                  <View style={styles.subRow}>
                    <Text style={[styles.subName, { color: colors.text }]}>{categoryLabel(s, t)}</Text>
                    <TouchableOpacity
                      onPress={() => removeSub(s.id)}
                      style={styles.subDelete}
                      accessibilityRole="button"
                      accessibilityLabel={t("settings.editor.removeSub", { name: categoryLabel(s, t) })}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.sep, { backgroundColor: colors.separator }]} />
                </View>
              ))}
              <View style={styles.subAddRow}>
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.text }]}
                  placeholder={t("settings.editor.newSub")}
                  placeholderTextColor={colors.textTertiary}
                  value={newSubName}
                  onChangeText={setNewSubName}
                  returnKeyType="done"
                  onSubmitEditing={addSub}
                  accessibilityLabel={t("settings.editor.newSub")}
                />
                <TouchableOpacity
                  onPress={addSub}
                  style={styles.subAddBtn}
                  disabled={!newSubName.trim()}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !newSubName.trim() }}
                >
                  <Text style={[styles.subAddText, { color: colors.accent }, !newSubName.trim() && styles.disabled]}>
                    {t("settings.editor.add")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {!isNew && (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: colors.card }]}
              onPress={handleDelete}
              accessibilityRole="button"
            >
              <Ionicons name="trash" size={18} color={colors.destructive} />
              <Text style={[styles.deleteText, { color: colors.destructive }]}>{t("settings.editor.delete")}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sectionTitle = (label: string, color: string) => (
  <Text style={[styles.sectionHeader, { color }]} accessibilityRole="header">
    {label}
  </Text>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { paddingTop: 8 },
  header:    { paddingHorizontal: 20, paddingBottom: 8 },
  headerTitle: { fontSize: 34, fontWeight: "700", letterSpacing: 0.3 },
  section:   { marginHorizontal: 16, marginTop: 20 },
  sectionHeader: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 6, paddingHorizontal: 4 },
  footer:    { fontSize: 12, marginTop: 6, paddingHorizontal: 4, lineHeight: 17 },
  card: {
    borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, minHeight: MIN_TOUCH + 8,
  },
  rowIcon:   { marginRight: 12 },
  rowLabel:  { fontSize: 16, flex: 1 },
  bold:      { fontWeight: "600" },
  rowInput:  { fontSize: 16, textAlign: "right", minWidth: 100, paddingVertical: 12 },
  rowValue:  { fontSize: 16 },
  rowFooter: { fontSize: 12, lineHeight: 16, paddingHorizontal: 16, marginTop: -6, paddingBottom: 12 },
  sep:       { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  catRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, minHeight: MIN_TOUCH + 8, gap: 10,
  },
  catIcon:   { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  catName:   { flex: 1, fontSize: 16 },
  subCount:  { fontSize: 13, marginRight: 4 },
  addCatRow: {
    flexDirection: "row", alignItems: "center",
    gap: 8, paddingHorizontal: 16, minHeight: MIN_TOUCH + 8,
  },
  addCatText:  { fontSize: 16 },
  themeIcon: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  modalScroll: { flex: 1 },
  editorCard:  { borderRadius: 12, overflow: "hidden" },
  input:       { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  colorRow:    { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  colorDot:    { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: "center", justifyContent: "center" },
  iconBtn:     { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  subRow:      { flexDirection: "row", alignItems: "center", paddingLeft: 16, minHeight: MIN_TOUCH + 4 },
  subName:     { flex: 1, fontSize: 16 },
  subDelete:   { width: MIN_TOUCH + 4, height: MIN_TOUCH + 4, alignItems: "center", justifyContent: "center" },
  subAddRow:   { flexDirection: "row", alignItems: "center" },
  subAddBtn:   { minHeight: MIN_TOUCH, paddingHorizontal: 16, justifyContent: "center" },
  subAddText:  { fontSize: 16, fontWeight: "600" },
  disabled:    { opacity: 0.4 },
  deleteButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, margin: 16, padding: 16, borderRadius: 12, minHeight: MIN_TOUCH,
  },
  deleteText: { fontSize: 16, fontWeight: "500" },
});
