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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppStore } from "../store/useAppStore";
import { useTheme } from "../hooks/useTheme";
import { Category } from "../models";
import { v4 as uuid } from "uuid";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const categories     = useAppStore((s) => s.categories);
  const currency       = useAppStore((s) => s.currency);
  const initialBalance = useAppStore((s) => s.initialBalance);
  const deleteCategory = useAppStore((s) => s.deleteCategory);
  const storedTheme    = useAppStore((s) => s.theme);
  const setTheme       = useAppStore((s) => s.setTheme);
  const currentLang    = useAppStore((s) => s.language);   // ← Zustand
  const setLanguage    = useAppStore((s) => s.setLanguage); // ← Zustand
  const { colors }     = useTheme();
  const insets         = useSafeAreaInsets();

  const [editing, setEditing]           = useState<Category | null>(null);
  const [showNew, setShowNew]           = useState(false);
  const [bankSyncing, setBankSyncing]   = useState(false);
  const [bankMessage, setBankMessage]   = useState<string | null>(null);
  const [currencyText, setCurrencyText] = useState(currency);
  const [balanceText, setBalanceText]   = useState(String(initialBalance));

  const handleDeleteCategory = (id: string) => {
    Alert.alert(t("common.delete"), t("history.confirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => deleteCategory(id) },
    ]);
  };

  const handleSyncBank = async () => {
    setBankSyncing(true);
    setBankMessage(null);
    await new Promise((r) => setTimeout(r, 1500));
    setBankSyncing(false);
    setBankMessage(t("settings.syncOk"));
  };

  const handleChangeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setLanguage(lang); // ← зачувува во Zustand/AsyncStorage
  };

  const newCategory: Category = {
    id: uuid(),
    name: "",
    colorHex: "#9C27B0",
    iconName: "tag",
    subcategories: [],
  };

  const d = {
    container:     { flex: 1, backgroundColor: colors.background },
    card:          { backgroundColor: colors.card, borderColor: colors.cardBorder },
    rowLabel:      { color: colors.text },
    rowInput:      { color: colors.accent },
    rowValue:      { color: colors.textSecondary },
    headerTitle:   { color: colors.text },
    sectionHeader: { color: colors.textSecondary },
    footer:        { color: colors.textTertiary },
    sep:           { backgroundColor: colors.separator },
    catName:       { color: colors.text },
    subCount:      { color: colors.textTertiary },
    bankMessage:   { color: colors.success },
  };

  return (
    <View style={[styles.container, d.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, d.headerTitle]}>{t("settings.title")}</Text>
        </View>

        {/* General */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, d.sectionHeader]}>{t("settings.general")}</Text>
          <View style={[styles.card, d.card]}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, d.rowLabel]}>{t("settings.currency")}</Text>
              <TextInput
                style={[styles.rowInput, d.rowInput]}
                value={currencyText}
                onChangeText={setCurrencyText}
                autoCapitalize="characters"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={[styles.sep, d.sep]} />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, d.rowLabel]}>{t("settings.startBalance")}</Text>
              <TextInput
                style={[styles.rowInput, d.rowInput]}
                value={balanceText}
                onChangeText={setBalanceText}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, d.sectionHeader]}>{t("settings.appearance")}</Text>
          <View style={[styles.card, d.card]}>
            {(
              [
                { value: "light",  label: t("settings.light"),  icon: "sunny-outline"          },
                { value: "dark",   label: t("settings.dark"),   icon: "moon-outline"           },
                { value: "system", label: t("settings.system"), icon: "phone-portrait-outline" },
              ] as const
            ).map((opt, i, arr) => {
              const isSelected = storedTheme === opt.value;
              return (
                <React.Fragment key={opt.value}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => setTheme(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.themeIcon, isSelected && { backgroundColor: `${colors.accent}18` }]}>
                      <Ionicons
                        name={opt.icon}
                        size={18}
                        color={isSelected ? colors.accent : colors.textTertiary}
                      />
                    </View>
                    <Text style={[styles.rowLabel, d.rowLabel, isSelected && { color: colors.accent, fontWeight: "600" }]}>
                      {opt.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={colors.accent} style={{ marginLeft: "auto" }} />
                    )}
                  </TouchableOpacity>
                  {i < arr.length - 1 && <View style={[styles.sep, d.sep]} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, d.sectionHeader]}>{t("settings.language")}</Text>
          <View style={[styles.card, d.card]}>
            {(
              [
                { value: "mk", label: t("settings.macedonian"), short: "mk" },
                { value: "en", label: t("settings.english"),    short: "en" },
              ]
            ).map((lang, i, arr) => {
              const isSelected = currentLang === lang.value;
              return (
                <React.Fragment key={lang.value}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => handleChangeLanguage(lang.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.themeIcon, isSelected && { backgroundColor: `${colors.accent}18` }]}>
                      <Text style={{ color: colors.text }}>{lang.short}</Text>
                    </View>
                    <Text style={[
                      styles.rowLabel,
                      d.rowLabel,
                      isSelected && { color: colors.accent, fontWeight: "600" },
                    ]}>
                      {lang.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={colors.accent} style={{ marginLeft: "auto" }} />
                    )}
                  </TouchableOpacity>
                  {i < arr.length - 1 && <View style={[styles.sep, d.sep]} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, d.sectionHeader]}>{t("settings.categories")}</Text>
          <View style={[styles.card, d.card]}>
            {categories.map((c, i) => (
              <View key={c.id}>
                <TouchableOpacity
                  style={styles.catRow}
                  onPress={() => setEditing(c)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.colorDot, { backgroundColor: c.colorHex }]} />
                  <Text style={[styles.catName, d.catName]}>{c.name}</Text>
                  <Text style={[styles.subCount, d.subCount]}>
                    {c.subcategories.length} {t("settings.subcats")}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
                {i < categories.length - 1 && <View style={[styles.sep, d.sep]} />}
              </View>
            ))}
            <View style={[styles.sep, d.sep]} />
            <TouchableOpacity style={styles.addCatRow} onPress={() => setShowNew(true)}>
              <Ionicons name="add-circle" size={20} color={colors.accent} />
              <Text style={[styles.addCatText, { color: colors.accent }]}>
                {t("settings.addCategory")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bank */}
        {/* <View style={styles.section}>
          <Text style={[styles.sectionHeader, d.sectionHeader]}>{t("settings.bank")}</Text>
          <View style={[styles.card, d.card]}>
            <TouchableOpacity
              style={styles.row}
              onPress={handleSyncBank}
              disabled={bankSyncing}
            >
              <View style={[styles.bankIcon, { backgroundColor: `${colors.accent}18` }]}>
                <Ionicons name="card" size={18} color={colors.accent} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.accent }]}>
                {t("settings.connectBank")}
              </Text>
              {bankSyncing ? (
                <ActivityIndicator size="small" style={{ marginLeft: "auto" }} />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textTertiary}
                  style={{ marginLeft: "auto" }}
                />
              )}
            </TouchableOpacity>
            {bankMessage && (
              <Text style={[styles.bankMessage, d.bankMessage]}>{bankMessage}</Text>
            )}
          </View>
          <Text style={[styles.footer, d.footer]}>{t("settings.bankFooter")}</Text>
        </View> */}

        {/* About */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, d.sectionHeader]}>{t("settings.about")}</Text>
          <View style={[styles.card, d.card]}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, d.rowLabel]}>{t("settings.version")}</Text>
              <Text style={[styles.rowValue, d.rowValue]}>1.0</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {editing && (
        <CategoryEditorModal
          category={editing}
          isNew={false}
          onClose={() => setEditing(null)}
          onDelete={() => { handleDeleteCategory(editing.id); setEditing(null); }}
        />
      )}
      {showNew && (
        <CategoryEditorModal
          category={newCategory}
          isNew
          onClose={() => setShowNew(false)}
        />
      )}
    </View>
  );
}

// ─── Category Editor Modal ─────────────────────────────────────────────────────

interface CatEditorProps {
  category: Category;
  isNew: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

const COLOR_PALETTE = [
  "#4CAF50", "#FF9800", "#2196F3", "#F44336",
  "#9C27B0", "#00BCD4", "#FFC107", "#795548", "#E91E63",
];
const ICONS = [
  "cart", "heart", "trending-up", "warning", "home", "car",
  "airplane", "restaurant", "bag", "book", "game-controller", "gift",
];

function CategoryEditorModal({ category, isNew, onClose, onDelete }: CatEditorProps) {
  const { t }          = useTranslation();
  const addCategory    = useAppStore((s) => s.addCategory);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const { colors }     = useTheme();

  const [cat, setCat]               = useState<Category>(category);
  const [newSubName, setNewSubName] = useState("");

  const canSave = cat.name.trim().length > 0;

  const handleSave = () => {
    if (isNew) addCategory(cat);
    else updateCategory(cat);
    onClose();
  };

  const addSub = () => {
    const n = newSubName.trim();
    if (!n) return;
    setCat({ ...cat, subcategories: [...cat.subcategories, { id: uuid(), name: n, keywords: [] }] });
    setNewSubName("");
  };

  const removeSub = (id: string) =>
    setCat({ ...cat, subcategories: cat.subcategories.filter((s) => s.id !== id) });

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.modalHeader, { backgroundColor: colors.background, borderBottomColor: colors.separator }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancelBtn, { color: colors.destructive }]}>
              {t("settings.editor.cancel")}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {isNew ? t("settings.editor.newTitle") : t("settings.editor.editTitle")}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={!canSave}>
            <Text style={[styles.saveBtn, { color: colors.accent }, !canSave && { opacity: 0.4 }]}>
              {t("settings.editor.save")}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ backgroundColor: colors.background }} keyboardShouldPersistTaps="handled">

          {/* Basic */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("settings.editor.sections.basic")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t("settings.editor.name")}
                placeholderTextColor={colors.textTertiary}
                value={cat.name}
                onChangeText={(v) => setCat({ ...cat, name: v })}
              />
            </View>
          </View>

          {/* Color */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("settings.editor.sections.color")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }, styles.colorGrid]}>
              {COLOR_PALETTE.map((hex) => (
                <TouchableOpacity
                  key={hex}
                  style={[styles.colorCircle, { backgroundColor: hex }, cat.colorHex === hex && styles.colorSelected]}
                  onPress={() => setCat({ ...cat, colorHex: hex })}
                />
              ))}
            </View>
          </View>

          {/* Icon */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("settings.editor.sections.icon")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }, styles.iconGrid]}>
              {ICONS.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconBox, cat.iconName === ic && { backgroundColor: `${cat.colorHex}22` }]}
                  onPress={() => setCat({ ...cat, iconName: ic })}
                >
                  <Ionicons
                    name={ic as any}
                    size={22}
                    color={cat.iconName === ic ? cat.colorHex : colors.textTertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Subcategories */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t("settings.editor.sections.subs")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              {cat.subcategories.map((s, i) => (
                <View key={s.id}>
                  <View style={styles.subRow}>
                    <Text style={[styles.subName, { color: colors.text }]}>{s.name}</Text>
                    <TouchableOpacity onPress={() => removeSub(s.id)}>
                      <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                  {i < cat.subcategories.length - 1 && (
                    <View style={[styles.sep, { backgroundColor: colors.separator }]} />
                  )}
                </View>
              ))}
              {cat.subcategories.length > 0 && (
                <View style={[styles.sep, { backgroundColor: colors.separator }]} />
              )}
              <View style={styles.addSubRow}>
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.text }]}
                  placeholder={t("settings.editor.newSub")}
                  placeholderTextColor={colors.textTertiary}
                  value={newSubName}
                  onChangeText={setNewSubName}
                />
                <TouchableOpacity style={styles.addSubBtn} onPress={addSub}>
                  <Text style={[styles.addSubBtnText, { color: colors.accent }]}>
                    {t("settings.editor.add")}
                  </Text>
                </TouchableOpacity>
              </View>
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
                {t("settings.editor.delete")}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { paddingBottom: 140 },
  header:    { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 34, fontWeight: "700", letterSpacing: 0.3 },
  section:   { margin: 16, marginBottom: 0 },
  sectionHeader: {
    fontSize: 12, fontWeight: "600", marginBottom: 6,
    paddingHorizontal: 4, letterSpacing: 0.5,
  },
  footer: { fontSize: 12, marginTop: 6, paddingHorizontal: 4, lineHeight: 17 },
  card: {
    borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rowLabel:  { fontSize: 16, flex: 1 },
  rowInput:  { fontSize: 16, textAlign: "right", minWidth: 80 },
  rowValue:  { fontSize: 16 },
  sep:       { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  catRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 10,
  },
  colorDot:  { width: 14, height: 14, borderRadius: 7 },
  catName:   { flex: 1, fontSize: 16 },
  subCount:  { fontSize: 13, marginRight: 4 },
  addCatRow: {
    flexDirection: "row", alignItems: "center",
    gap: 8, paddingHorizontal: 16, paddingVertical: 14,
  },
  addCatText:  { fontSize: 16 },
  bankIcon: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  bankMessage: { fontSize: 13, paddingHorizontal: 16, paddingBottom: 12 },
  themeIcon: {
    width: 32, height: 32, borderRadius: 8, color: "#fff",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle:  { fontSize: 17, fontWeight: "600" },
  cancelBtn:   { fontSize: 17 },
  saveBtn:     { fontSize: 17, fontWeight: "600" },
  input:       { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  colorGrid:   { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  colorCircle: { width: 34, height: 34, borderRadius: 17 },
  colorSelected: {
    borderWidth: 3, borderColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 3, elevation: 3,
  },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", padding: 8 },
  iconBox: {
    width: "16.66%", aspectRatio: 1,
    alignItems: "center", justifyContent: "center", borderRadius: 8,
  },
  subRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  subName:    { flex: 1, fontSize: 16 },
  addSubRow:  { flexDirection: "row", alignItems: "center" },
  addSubBtn:  { paddingHorizontal: 16, paddingVertical: 14 },
  addSubBtnText: { fontSize: 16, fontWeight: "600" },
  deleteButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, margin: 16, padding: 16, borderRadius: 12,
  },
  deleteText: { fontSize: 16, fontWeight: "500" },
});