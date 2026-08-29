import React, { useState, useRef, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Vibration,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SvgXml } from "react-native-svg";
// import { CameraView, useCameraPermissions } from "expo-camera";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { TransactionKind } from "../models";
import { useMLCategorizer } from "../services/categorizer/useMLCategorizer";
import { v4 as uuid } from "uuid";
import { useTheme } from "@/hooks/useTheme";
import { analyzeReceiptImage } from "../services/receiptScanner";
import { MARKET_DATASET_CSV } from "../assets/datasets/market_dataset";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── QR Payload Parser ────────────────────────────────────────────────────────
function parseQRPayload(payload: string): {
  merchant?: string;
  amount?: number;
  receiptId?: string;
} {
  try {
    const url = new URL(payload);
    const merchant =
      url.searchParams.get("merchant") ||
      url.searchParams.get("seller") ||
      url.searchParams.get("m") ||
      url.hostname;
    const rawAmount =
      url.searchParams.get("total") ||
      url.searchParams.get("amount") ||
      url.searchParams.get("iznos") ||
      url.searchParams.get("suma") ||
      url.searchParams.get("s");
    const amount = rawAmount ? parseFloat(rawAmount.replace(",", ".")) : undefined;
    return {
      merchant: merchant || undefined,
      amount: isNaN(amount ?? NaN) ? undefined : amount,
    };
  } catch {}

  try {
    const obj = JSON.parse(payload);
    const merchant = obj.merchant || obj.seller || obj.name || obj.m;
    const rawAmount = obj.total ?? obj.amount ?? obj.iznos ?? obj.suma;
    const amount =
      typeof rawAmount === "string"
        ? parseFloat(rawAmount.replace(",", "."))
        : typeof rawAmount === "number"
        ? rawAmount
        : undefined;
    return {
      merchant: typeof merchant === "string" ? merchant : undefined,
      amount: amount !== undefined && !isNaN(amount) ? amount : undefined,
    };
  } catch {}

  const sepMatch = payload.match(/[|;\n]/);
  if (sepMatch) {
    const parts = payload.split(/[|;\n]/);
    let merchant: string | undefined;
    let amount: number | undefined;
    for (const part of parts) {
      const [k, v] = part.split("=").map((s) => s.trim());
      if (!k || !v) continue;
      const key = k.toLowerCase();
      if (["merchant", "m", "prodavac", "seller"].includes(key)) merchant = v;
      if (["total", "t", "suma", "iznos", "amount"].includes(key)) {
        const n = parseFloat(v.replace(",", "."));
        if (!isNaN(n)) amount = n;
      }
    }
    if (merchant || amount) return { merchant, amount };
  }

  const faMatch = payload.match(/[A-Za-z]{2}\d{9}/);
  if (faMatch) return { receiptId: faMatch[0] };

  return {};
}

// ─── Receipt Loading Overlay ──────────────────────────────────────────────────

const _walletBodySvg = `<svg viewBox="0 0 694.81 837.83" xmlns="http://www.w3.org/2000/svg">
  <path fill="#ffffff"
    d="M61.82,837.83c-12.05,0-27.38-2.61-39.38-13.34-15.55-13.91-21.06-37.15-16.39-69.07L1.23,331.03c-1.58-7.63-1.64-16.22-.15-25.71,2.31-14.8,9.51-26.6,21.39-35.06,30.44-21.68,81.69-12.77,83.85-12.38l-3.54,19.68,1.77-9.84-1.76,9.84c-.45-.08-45.21-7.8-68.75,9-7.21,5.14-11.49,12.04-13.07,21.06l.24,21.08c1.06,3.93,2.8,7.3,5.23,10.14,12.54,14.65,43.38,15.87,71.31,15.87,45.44,0,468.83,1.68,473.1,1.7,26.96,0,78.02,13.83,78.02,66.15l5.1,331.29c.42,4.92,2.69,41.51-20.89,64.66-15.06,14.79-36.78,20.62-64.57,17.34H80.2c-2.88,.65-9.8,1.97-18.38,1.97ZM21.56,360.86l4.5,395.92-.12,.8c-3.8,25.2-.52,42.68,9.77,51.94,14.7,13.24,40.5,6.73,40.75,6.66l1.24-.32h1.31s490.69,0,490.69,0l.61,.07c21.7,2.66,38.07-1.25,48.68-11.61,17.91-17.5,15.07-48.61,15.03-48.92l-.05-.86-5.1-331.82c0-45.54-55.72-46.3-58.09-46.31-4.29-.02-427.64-1.7-473.04-1.7-28.22,0-56.93-1.23-76.17-13.85Z"/>
  <path fill="#ffffff"
    d="M649.07,684.41h-103.8c-51.49,0-93.38-41.89-93.38-93.38s41.89-93.38,93.38-93.38h103.8c25.22,0,45.73,20.52,45.73,45.73v95.29c0,25.22-20.52,45.73-45.73,45.73Zm-103.8-166.76c-40.46,0-73.38,32.92-73.38,73.38s32.92,73.38,73.38,73.38h103.8c14.19,0,25.74-11.55,25.74-25.74v-95.29c0-14.19-11.55-25.74-25.74-25.74h-103.8Z"/>
  <circle fill="#ffffff" cx="545.27" cy="596.14" r="28.93"/>
</svg>`;

const _bill1Svg = `<svg viewBox="0 0 694.81 837.83" xmlns="http://www.w3.org/2000/svg">
  <polygon fill="#ffffff"
    points="219.11 332.38 200.02 332.38 424.46 0 648.4 154.87 525.61 332.19 506.13 332.38 620.59 159.94 429.53 27.82 219.11 332.38"/>
  <path fill="#ffffff"
    d="M463.98,318.68c0,4.62-.38,9.18-1.11,13.6h-163.42c-.73-4.42-1.11-8.98-1.11-13.6,0-45.74,37.08-82.82,82.82-82.82s82.82,37.08,82.82,82.82Z"/>
</svg>`;

const _bill2Svg = `<svg viewBox="0 0 694.81 837.83" xmlns="http://www.w3.org/2000/svg">
  <polygon fill="#aaaaaa"
    points="327.31 75.34 323.52 92.51 277.74 83.62 217.41 71.92 205.75 131.95 163.24 332.38 146.42 332.38 203.49 51.31 327.31 75.34"/>
  <path fill="#aaaaaa"
    d="M280.21,75.14c-4.91,21.81-19.76,41.09-41.81,50.76-13.52,5.93-27.87,7.42-41.4,5.12l13.47-69.4,69.75,13.53Z"/>
</svg>`;

function ReceiptLoadingOverlay() {
  const { t } = useTranslation();
  const LOGO_W = 112;
  const LOGO_H = 150;
  const billsProgress = useRef(new Animated.Value(0)).current;
  const logoScale     = useRef(new Animated.Value(1)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const DUR    = 2400;
    const smooth = Easing.bezier(0.37, 0, 0.63, 1);

    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.045, duration: DUR / 2, easing: smooth, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1,     duration: DUR / 2, easing: smooth, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(billsProgress, { toValue: 1, duration: DUR * 0.46, easing: smooth, useNativeDriver: true }),
        Animated.timing(billsProgress, { toValue: 0, duration: DUR * 0.54, easing: smooth, useNativeDriver: true }),
      ])
    ).start();

    const makeDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 380, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
          Animated.delay(840 - delay),
        ])
      );

    makeDot(dot1, 0).start();
    makeDot(dot2, 180).start();
    makeDot(dot3, 360).start();
  }, []);

  const bill1Rotate  = billsProgress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-6deg"] });
  const bill1Y       = billsProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -(LOGO_H * 0.03)] });
  const bill1Opacity = billsProgress.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 1, 1] });
  const bill2Rotate  = billsProgress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "4deg"] });
  const bill2Y       = billsProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -(LOGO_H * 0.03)] });
  const bill2Opacity = billsProgress.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 0.9, 0.9] });

  const dotStyle = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
    opacity:   anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] }),
  });

  return (
    <View style={overlayStyles.root}>
      <Animated.View style={{ width: LOGO_W, height: LOGO_H, transform: [{ scale: logoScale }] }}>
        <Animated.View style={[overlayStyles.layer, { width: LOGO_W, height: LOGO_H, opacity: bill1Opacity, transform: [{ translateX: -3 }, { translateY: bill1Y }, { rotate: bill1Rotate }] }]}>
          <SvgXml xml={_bill1Svg} width={LOGO_W} height={LOGO_H} />
        </Animated.View>
        <Animated.View style={[overlayStyles.layer, { width: LOGO_W, height: LOGO_H, opacity: bill2Opacity, transform: [{ translateX: 3 }, { translateY: bill2Y }, { rotate: bill2Rotate }] }]}>
          <SvgXml xml={_bill2Svg} width={LOGO_W} height={LOGO_H} />
        </Animated.View>
        <View style={[overlayStyles.layer, { width: LOGO_W, height: LOGO_H, zIndex: 10 }]}>
          <SvgXml xml={_walletBodySvg} width={LOGO_W} height={LOGO_H} />
        </View>
      </Animated.View>

      <View style={overlayStyles.dotsRow}>
        <Animated.View style={[overlayStyles.dot, dotStyle(dot1)]} />
        <Animated.View style={[overlayStyles.dot, dotStyle(dot2)]} />
        <Animated.View style={[overlayStyles.dot, dotStyle(dot3)]} />
      </View>

      <Text style={overlayStyles.label}>{t("add.analyzing")}</Text>
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center" },
  layer:   { position: "absolute", top: 0, left: 0 },
  dotsRow: { flexDirection: "row", gap: 7, marginTop: 48 },
  dot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ffffff" },
  label:   { marginTop: 18, fontSize: 11, fontWeight: "600", letterSpacing: 0.18, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" },
});

// ─── QR Scanner Modal ─────────────────────────────────────────────────────────
// Целосно исклучен додека camera пакетите не се вратат во проектот.
// interface QRScannerModalProps {
//   visible: boolean;
//   onClose: () => void;
//   onScanned: (payload: string, photoBase64?: string) => void;
// }
//
// function QRScannerModal({ visible, onClose, onScanned }: QRScannerModalProps) {
//   const { t } = useTranslation();
//   const cameraRef = useRef<CameraView>(null);
//   const [permission, requestPermission] = useCameraPermissions();
//   const hasScanned = useRef(false);
//   const [scanned, setScanned] = useState(false);
//   const insets = useSafeAreaInsets();
//
//   React.useEffect(() => {
//     if (!visible) {
//       hasScanned.current = false;
//       setScanned(false);
//     }
//   }, [visible]);
//
//   const handleBarCodeScanned = useCallback(
//     async ({ data }: { data: string }) => {
//       if (hasScanned.current) return;
//       hasScanned.current = true;
//       setScanned(true);
//       Vibration.vibrate(80);
//
//       let photoBase64: string | undefined;
//       try {
//         const photo = await cameraRef.current?.takePictureAsync({
//           base64: true,
//           quality: 0.92,
//           skipProcessing: false,
//         });
//         photoBase64 = photo?.base64 ?? undefined;
//       } catch {}
//
//       setTimeout(() => {
//         onScanned(data, photoBase64);
//         onClose();
//       }, 350);
//     },
//     [onScanned, onClose]
//   );
//
//   if (!permission) {
//     return (
//       <Modal visible={visible} animationType="fade">
//         <View style={scanStyles.permContainer}>
//           <ActivityIndicator color="#fff" size="large" />
//         </View>
//       </Modal>
//     );
//   }
//
//   if (!permission.granted) {
//     return (
//       <Modal visible={visible} animationType="slide">
//         <View style={scanStyles.permContainer}>
//           <Ionicons name="camera-outline" size={60} color="rgba(255,255,255,0.5)" />
//           <Text style={scanStyles.permTitle}>{t("add.scanner.needCamera")}</Text>
//           <Text style={scanStyles.permSub}>{t("add.scanner.cameraSub")}</Text>
//           <TouchableOpacity style={scanStyles.permBtn} onPress={requestPermission}>
//             <Text style={scanStyles.permBtnText}>{t("add.scanner.giveAccess")}</Text>
//           </TouchableOpacity>
//           <TouchableOpacity style={scanStyles.closeTextBtn} onPress={onClose}>
//             <Text style={scanStyles.closeTextBtnText}>{t("add.scanner.cancel")}</Text>
//           </TouchableOpacity>
//         </View>
//       </Modal>
//     );
//   }
//
//   return (
//     <Modal visible={visible} animationType="slide" statusBarTranslucent>
//       <View style={scanStyles.root}>
//         <CameraView
//           ref={cameraRef}
//           key={visible ? "active" : "inactive"}
//           style={StyleSheet.absoluteFill}
//           facing="back"
//           onBarcodeScanned={handleBarCodeScanned}
//         />
//
//         <View style={[scanStyles.topBar, { paddingTop: insets.top + 12 }]}>
//           <Text style={scanStyles.topTitle}>{t("add.scanner.title")}</Text>
//           <Text style={scanStyles.topSub}>
//             {scanned ? t("add.scanner.scanned") : t("add.scanner.hint")}
//           </Text>
//         </View>
//
//         {scanned && (
//           <View style={scanStyles.successBanner}>
//             <Ionicons name="checkmark-circle" size={22} color="#fff" />
//             <Text style={scanStyles.successText}>{t("add.scanner.success")}</Text>
//           </View>
//         )}
//
//         <View style={[scanStyles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
//           <TouchableOpacity style={scanStyles.closeBtn} onPress={onClose}>
//             <Ionicons name="close" size={20} color="#fff" />
//             <Text style={scanStyles.closeBtnText}>{t("add.scanner.close")}</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AddTransactionScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const addTransaction = useAppStore((s) => s.addTransaction);
  const categories     = useAppStore((s) => s.categories);
  const currency       = useAppStore((s) => s.currency);
  const category       = useAppStore((s) => s.category);
  const insets         = useSafeAreaInsets();

  const { categorize, correct, isReady } = useMLCategorizer({ datasetCSV: MARKET_DATASET_CSV });

  const [merchant, setMerchant]             = useState("");
  const [amountText, setAmountText]         = useState("");
  const [kind, setKind]                     = useState<TransactionKind>(TransactionKind.EXPENSE);
  const [note, setNote]                     = useState("");
  const [categoryId, setCategoryId]         = useState<string | undefined>();
  const [subcategoryId, setSubcategoryId]   = useState<string | undefined>();
  const [useAI, setUseAI]                   = useState(true);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isAnalyzingReceipt, setIsAnalyzingReceipt] = useState(false);
  const [showToast, setShowToast]           = useState(false);
  // const [scannerVisible, setScannerVisible] = useState(false);

  const toastAnim   = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const KINDS = [
    { label: t("add.expense"), value: TransactionKind.EXPENSE },
    { label: t("add.income"),  value: TransactionKind.INCOME  },
  ];

  const canSave =
    merchant.trim().length > 0 &&
    (parseFloat(amountText.replace(",", ".")) || 0) > 0;

  // ── AI categorization ─────────────────────────────────────────────────────
  const scheduleAI = useCallback(
    (newMerchant: string, newNote: string) => {
      if (!useAI || !isReady) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (!newMerchant.trim()) return;
        setIsCategorizing(true);
        const res = await categorize(newMerchant, newNote, categories);
        if (res.confidence > 0.05) {
          setCategoryId(res.categoryId);
          setSubcategoryId(res.subcategoryId);
        }
        setIsCategorizing(false);
      }, 400);
    },
    [useAI, isReady, categories, categorize]
  );

  const handleMerchantChange = (text: string) => {
    setMerchant(text);
    scheduleAI(text, note);
  };

  const handleNoteChange = (text: string) => {
    setNote(text);
    scheduleAI(merchant, text);
  };

  const handleSwitchMode = (val: boolean) => {
    setUseAI(val);
    if (val) scheduleAI(merchant, note);
    else { setCategoryId(undefined); setSubcategoryId(undefined); }
  };

  // ── Called when user manually picks a different subcategory ───────────────
  const handleManualSubcategoryPick = (subId: string) => {
    setSubcategoryId(subId);
    // teach the model only if there's a merchant to learn from
    if (merchant.trim()) {
      correct(merchant, note, subId);
    }
  };

  const save = () => {
    const amount = parseFloat(amountText.replace(",", ".")) || 0;
    addTransaction({
      id: uuid(),
      date: new Date().toISOString(),
      merchant,
      amount,
      kind,
      categoryId,
      subcategoryId,
      note,
      source: "Рачно",
    });
    setMerchant("");
    setAmountText("");
    setNote("");
    setCategoryId(undefined);
    setSubcategoryId(undefined);
    setShowToast(true);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setShowToast(false));
  };

  // ── QR scanned handler ────────────────────────────────────────────────────
  const handleQRScanned = async (payload: string, photoBase64?: string) => {
    const applyOfflineFallback = (opts: { skipAmount?: boolean } = {}) => {
      const parsed = parseQRPayload(payload);
      if (parsed.merchant) { setMerchant(parsed.merchant); scheduleAI(parsed.merchant, ""); }
      if (!opts.skipAmount && parsed.amount) setAmountText(String(parsed.amount));
    };

    if (photoBase64) {
      setIsAnalyzingReceipt(true);
      try {
        const result = await analyzeReceiptImage(photoBase64, payload);
        if (result.amount && result.amount > 0) setAmountText(String(result.amount));
        if (result.merchant) { setMerchant(result.merchant); scheduleAI(result.merchant, ""); }
        else applyOfflineFallback({ skipAmount: !!result.amount });
      } catch (err) {
        applyOfflineFallback();
      } finally {
        setIsAnalyzingReceipt(false);
      }
      return;
    }

    applyOfflineFallback();
  };

  const selectedCat = category(categoryId);
  const selectedSub = selectedCat?.subcategories.find((s) => s.id === subcategoryId);

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t("add.title")}</Text>
          </View>

          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 72 + 34 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {showToast && (
              <Animated.View style={[styles.toast, { opacity: toastAnim }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                <Text style={styles.toastText}>{t("add.saved")}</Text>
              </Animated.View>
            )}

            {/* Scan button AKtiviraj koga ke sakas */}
            {/*<TouchableOpacity
              style={[styles.scanBtn, { borderColor: colors.separator, backgroundColor: colors.card }]}
              onPress={() => setScannerVisible(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.scanBtnIcon, { backgroundColor: `${colors.accent}15` }]}>
                <Ionicons name="qr-code-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.scanBtnTextWrap}>
                <Text style={[styles.scanBtnTitle, { color: colors.text }]}>{t("add.scanReceipt")}</Text>
                <Text style={[styles.scanBtnSub, { color: colors.textTertiary }]}>{t("add.scanReceiptSub")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>*/}

            {/* Transaction card */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t("add.sections.transaction")}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder={t("add.merchant")}
                  placeholderTextColor={colors.textTertiary}
                  value={merchant}
                  onChangeText={handleMerchantChange}
                />
                <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1, color: colors.text }]}
                    placeholder={t("add.amount")}
                    placeholderTextColor={colors.textTertiary}
                    value={amountText}
                    onChangeText={setAmountText}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[styles.currency, { color: colors.textSecondary }]}>{currency}</Text>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                <View style={[styles.segmentContainer, { backgroundColor: colors.inputBg }]}>
                  {KINDS.map((k) => (
                    <TouchableOpacity
                      key={k.value}
                      style={[styles.segment, kind === k.value && { backgroundColor: colors.accent }]}
                      onPress={() => setKind(k.value)}
                    >
                      <Text style={[styles.segmentText, { color: kind === k.value ? "#fff" : colors.textSecondary }]}>
                        {k.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                !canSave && styles.saveButtonDisabled,
                { backgroundColor: canSave ? colors.accent : colors.card },
              ]}
              onPress={save}
              disabled={!canSave}
            >
              <Ionicons name="checkmark" size={20} style={{color: colors.text}} />
              <Text style={{color: colors.text}}>{t("add.saveTransaction")}</Text>
            </TouchableOpacity>

            {/* Categorization */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t("add.sections.categorization")}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={[styles.segmentContainer, { backgroundColor: colors.inputBg }]}>
                  <TouchableOpacity
                    style={[styles.segment, useAI && { backgroundColor: colors.accent }]}
                    onPress={() => handleSwitchMode(true)}
                  >
                    <Ionicons name="sparkles" size={14} color={useAI ? "#fff" : colors.textSecondary} />
                    <Text style={[styles.segmentText, { color: useAI ? "#fff" : colors.textSecondary }]}>
                      {" "}{t("add.ai")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segment, !useAI && { backgroundColor: colors.accent }]}
                    onPress={() => handleSwitchMode(false)}
                  >
                    <Text style={[styles.segmentText, { color: !useAI ? "#fff" : colors.textSecondary }]}>
                      {t("add.manual")}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                {useAI ? (
                  <View style={styles.aiRow}>
                    {isCategorizing ? (
                      <>
                        <ActivityIndicator size="small" color={colors.accent} />
                        <Text style={[styles.aiLabel, { color: colors.textSecondary }]}>
                          {" "}{t("add.aiCategorizing")}
                        </Text>
                      </>
                    ) : selectedCat ? (
                      <>
                        <Ionicons name="sparkles" size={16} color={colors.accent} />
                        <Text style={[styles.aiLabel, { color: colors.accent }]}>
                          {" "}{selectedCat.name}
                        </Text>
                        {selectedSub && (
                          <Text style={[styles.aiSub, { color: colors.textTertiary }]}>
                            {" "}· {selectedSub.name}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={[styles.aiPlaceholder, { color: colors.textTertiary }]}>
                        {t("add.aiHint")}
                      </Text>
                    )}
                  </View>
                ) : (
                  <>
                    <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
                      {t("add.sections.category")}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                      <TouchableOpacity
                        style={[styles.chip, { backgroundColor: !categoryId ? colors.accent : colors.inputBg }]}
                        onPress={() => { setCategoryId(undefined); setSubcategoryId(undefined); }}
                      >
                        <Text style={[styles.chipText, { color: !categoryId ? "#fff" : colors.text }]}>
                          {t("add.chooseCategory")}
                        </Text>
                      </TouchableOpacity>
                      {categories.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.chip, { backgroundColor: categoryId === c.id ? c.colorHex : colors.inputBg }]}
                          onPress={() => { setCategoryId(c.id); setSubcategoryId(undefined); }}
                        >
                          <Text style={[styles.chipText, { color: categoryId === c.id ? "#fff" : colors.text }]}>
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {selectedCat && selectedCat.subcategories.length > 0 && (
                      <>
                        <View style={[styles.separator, { backgroundColor: colors.separator }]} />
                        <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
                          {t("add.sections.subcategory")}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                          <TouchableOpacity
                            style={[styles.chip, { backgroundColor: !subcategoryId ? colors.accent : colors.inputBg }]}
                            onPress={() => setSubcategoryId(undefined)}
                          >
                            <Text style={[styles.chipText, { color: !subcategoryId ? "#fff" : colors.text }]}>
                              {t("add.withoutSub")}
                            </Text>
                          </TouchableOpacity>
                          {selectedCat.subcategories.map((s) => (
                            <TouchableOpacity
                              key={s.id}
                              style={[styles.chip, { backgroundColor: subcategoryId === s.id ? colors.accent : colors.inputBg }]}
                              onPress={() => handleManualSubcategoryPick(s.id)}
                            >
                              <Text style={[styles.chipText, { color: subcategoryId === s.id ? "#fff" : colors.text }]}>
                                {s.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </>
                    )}
                  </>
                )}
              </View>
            </View>

            {/* Note */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {t("add.sections.note")}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <TextInput
                  style={[styles.input, { minHeight: 60, color: colors.text }]}
                  placeholder={t("history.optional")}
                  placeholderTextColor={colors.textTertiary}
                  value={note}
                  onChangeText={handleNoteChange}
                  multiline
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {isAnalyzingReceipt && (
        <Modal visible transparent animationType="fade">
          <ReceiptLoadingOverlay />
        </Modal>
      )}

      {/* <QRScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleQRScanned}
      /> */}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 34, fontWeight: "700", letterSpacing: 0.3 },
  content:     { paddingHorizontal: 20, paddingTop: 16 },
  section:     { marginBottom: 16 },
  sectionHeader: {
    fontSize: 12, fontWeight: "600", marginBottom: 6,
    paddingHorizontal: 4, letterSpacing: 0.5,
  },
  scanBtn: {
    flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16,
    padding: 14, marginBottom: 16, borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  scanBtnIcon:     { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scanBtnTextWrap: { flex: 1 },
  scanBtnTitle:    { fontSize: 15, fontWeight: "600" },
  scanBtnSub:      { fontSize: 12, marginTop: 1 },
  card: {
    borderRadius: 16, overflow: "hidden", shadowColor: "#000",
    shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  input:    { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  row:      { flexDirection: "row", alignItems: "center" },
  currency: { paddingRight: 16, fontSize: 15 },
  segmentContainer: { flexDirection: "row", margin: 10, borderRadius: 8, padding: 3 },
  segment: {
    flex: 1, paddingVertical: 8, borderRadius: 6,
    alignItems: "center", flexDirection: "row", justifyContent: "center",
  },
  segmentText: { fontSize: 14, fontWeight: "500" },
  saveButton: {
    borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 16,
    flexDirection: "row", justifyContent: "center", gap: 8,
    shadowColor: "#007AFF", shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  saveButtonDisabled: { backgroundColor: "#3a3a3c", shadowOpacity: 0 },
  saveButtonText: { color: "#fff", fontSize: 17, fontWeight: "400" },
  aiRow:        { flexDirection: "row", alignItems: "center", padding: 14 },
  aiLabel:      { fontSize: 15 },
  aiSub:        { fontSize: 14 },
  aiPlaceholder:{ fontSize: 14, padding: 14 },
  pickerLabel:  { fontSize: 13, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, color: "#8e8e93" },
  chipScroll:   { paddingHorizontal: 12, paddingBottom: 12 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginTop: 4 },
  chipText:     { fontSize: 14 },
  toast: {
    position: "absolute", top: 10, alignSelf: "center", zIndex: 100,
    backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 20,
    paddingVertical: 10, borderRadius: 30, flexDirection: "row", alignItems: "center", gap: 6,
  },
  toastText: { color: "#fff", fontSize: 15, fontWeight: "500" },
});

const scanStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    alignItems: "center", paddingBottom: 20, paddingHorizontal: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  topTitle: { color: "#fff", fontSize: 18, fontWeight: "700", letterSpacing: 0.2 },
  topSub:   { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4, textAlign: "center" },
  successBanner: {
    position: "absolute", top: "45%", alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(52,199,89,0.9)", paddingHorizontal: 28,
    paddingVertical: 14, borderRadius: 30,
  },
  successText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)", paddingTop: 20,
  },
  closeBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 32,
    paddingVertical: 14, borderRadius: 30, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  closeBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  permContainer: {
    flex: 1, backgroundColor: "#000", alignItems: "center",
    justifyContent: "center", gap: 16, paddingHorizontal: 32,
  },
  permTitle:    { color: "#fff", fontSize: 22, fontWeight: "700" },
  permSub:      { color: "rgba(255,255,255,0.55)", fontSize: 15, textAlign: "center", lineHeight: 22 },
  permBtn:      { backgroundColor: "#007AFF", borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  permBtnText:  { color: "#fff", fontSize: 16, fontWeight: "600" },
  closeTextBtn: { marginTop: 4 },
  closeTextBtnText: { color: "rgba(255,255,255,0.45)", fontSize: 15 },
});