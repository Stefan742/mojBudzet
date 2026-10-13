import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AmountError, formatAmount, validateAmount } from "../utils/money";
import { amountErrorText, amountKeyboard, useCurrency } from "./useCurrency";

/**
 * Text state for an amount input in the app currency. The text is kept as
 * typed (so it can be cleared and edited freely) and only parsed when saving (B-6).
 */
export function useAmountField(initial = 0, { allowZero = false }: { allowZero?: boolean } = {}) {
  const { t } = useTranslation();
  const currency = useCurrency();
  const [text, setText] = useState(initial > 0 ? formatAmount(initial, currency, { trimZeroCents: true }) : "");
  const [error, setError] = useState<AmountError | null>(null);

  return {
    text,
    /** For the TextInput: a decimal key only when the currency has cents. */
    keyboardType: amountKeyboard(currency),
    onChangeText: (value: string) => {
      setText(value);
      setError(null);
    },
    /** Error message to show under the field, or null. */
    errorText: error ? amountErrorText(t, error, currency) : null,
    /** Validates; returns the amount, or null after setting the error. */
    parse: (): number | null => {
      const result = validateAmount(text, currency, { allowZero });
      if ("error" in result) {
        setError(result.error);
        return null;
      }
      return result.amount;
    },
    /** The amount typed so far, without showing an error (for live previews). */
    peek: (): number | null => {
      const result = validateAmount(text, currency, { allowZero });
      return "amount" in result ? result.amount : null;
    },
    reset: () => {
      setText("");
      setError(null);
    },
    setAmount: (amount: number) => {
      setText(formatAmount(amount, currency, { trimZeroCents: true }));
      setError(null);
    },
  };
}
