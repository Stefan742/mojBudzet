import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { AmountError, MoneyFormat, formatAmount, moneyFormat } from "../utils/money";

/** The app currency, formatted for the app language. Pass it to formatMoney. */
export function useCurrency(): MoneyFormat {
  const { t, i18n } = useTranslation();
  const code = useAppStore((s) => s.currency);
  return moneyFormat(code, i18n.language, t(`currency.label.${code}`));
}

/** Message for an invalid amount, with an example and the limit in this currency. */
export const amountErrorText = (t: TFunction, error: AmountError, f: MoneyFormat): string =>
  t(`settings.amountErrors.${error}`, {
    example: formatAmount(f.decimals === 0 ? 25000 : 2500050, f),
    max: formatAmount(f.max, f, { trimZeroCents: true }),
  });

/** Keyboard for typing amounts: with a decimal key only when the currency has cents. */
export const amountKeyboard = (f: MoneyFormat): "decimal-pad" | "number-pad" =>
  f.decimals > 0 ? "decimal-pad" : "number-pad";
