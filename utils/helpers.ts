export const formatAmount = (
  amount: number,
  currency: string = "МКД"
) => {
  return `${amount.toFixed(0)} ${currency}`;
};

export const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString("mk-MK");
};

export const formatMonthWide = (date: Date) => {
  return date.toLocaleString("mk-MK", {
    month: "long",
    year: "numeric",
  });
};

export const shiftMonth = (date: Date, delta: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
};
export const generateId = () => {
  return Math.random().toString(36).substring(2, 12);
};

export const parseFiscalQR = (payload: string) => {
  // simple fallback parser
  const lines = payload.split("\n");

  return {
    merchant: lines[0] || "Непознато",
    total: Number(lines[1]) || 0,
  };
};