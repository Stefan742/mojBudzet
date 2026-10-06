import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AmountError, MAX_AMOUNT_MKD, formatWholeDenars, validateAmount } from "../utils/money";

/**
 * Text state for an amount input. The text is kept as typed (so it can be
 * cleared and edited freely) and only parsed when saving (B-6).
 */
export function useAmountField(initial = 0, { allowZero = false }: { allowZero?: boolean } = {}) {
  const { t } = useTranslation();
  const [text, setText] = useState(initial > 0 ? formatWholeDenars(initial) : "");
  const [error, setError] = useState<AmountError | null>(null);

  return {
    text,
    onChangeText: (value: string) => {
      setText(value);
      setError(null);
    },
    /** Error message to show under the field, or null. */
    errorText: error
      ? t(`settings.amountErrors.${error}`, { max: formatWholeDenars(MAX_AMOUNT_MKD) })
      : null,
    /** Validates; returns the amount, or null after setting the error. */
    parse: (): number | null => {
      const result = validateAmount(text, { allowZero });
      if ("error" in result) {
        setError(result.error);
        return null;
      }
      return result.amount;
    },
    reset: () => {
      setText("");
      setError(null);
    },
    setAmount: (amount: number) => {
      setText(formatWholeDenars(amount));
      setError(null);
    },
  };
}
