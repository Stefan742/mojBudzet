import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useAppStore } from "../store/useAppStore";

export default function OnboardingScreen() {
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [balanceText, setBalanceText] = useState("");
  const router = useRouter();

  const handleContinue = () => {
    const value = parseFloat(balanceText.replace(",", ".")) || 0;
    completeOnboarding(value);
    // Програматска навигација — не чека на re-render од _layout
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <View style={styles.top}>
          <Ionicons name="cash" size={80} color="#4CAF50" />
          <Text style={styles.title}>Добредојде!</Text>
          <Text style={styles.subtitle}>
            Внеси ја твојата почетна сума за да започнеме.
          </Text>
        </View>

        <View style={styles.inputCard}>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor="#999"
            value={balanceText}
            onChangeText={setBalanceText}
            keyboardType="decimal-pad"
            textAlign="right"
            autoFocus
          />
          <Text style={styles.currency}>МКД</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, !balanceText && styles.buttonDisabled]}
          onPress={handleContinue}
        >
          <Text style={styles.buttonText}>Продолжи</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingTop: 80,
    paddingBottom: 40,
  },
  top: {
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  inputCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f7",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: "700",
    color: "#000",
  },
  currency: {
    fontSize: 22,
    color: "#666",
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});