export const CURRENCIES = [
  { code: "USD", symbol: "$",    name: "US Dollar",       decimals: 2 },
  { code: "INR", symbol: "₹",   name: "Indian Rupee",     decimals: 2 },
  { code: "EUR", symbol: "€",    name: "Euro",             decimals: 2 },
  { code: "GBP", symbol: "£",    name: "British Pound",    decimals: 2 },
  { code: "JPY", symbol: "¥",    name: "Japanese Yen",     decimals: 0 },
  { code: "CHF", symbol: "CHF ", name: "Swiss Franc",      decimals: 2 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", decimals: 2 },
  { code: "SGD", symbol: "S$",  name: "Singapore Dollar", decimals: 2 },
  { code: "AED", symbol: "AED ",name: "UAE Dirham",        decimals: 2 },
  { code: "KWD", symbol: "KD ", name: "Kuwaiti Dinar",    decimals: 3 },
];

export const getSymbol = (code) =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? code;

export const getDecimals = (code) =>
  CURRENCIES.find((c) => c.code === code)?.decimals ?? 2;

export const formatAmount = (amount, code) => {
  const sym = getSymbol(code);
  const decimals = getDecimals(code);
  return `${sym}${Math.abs(Number(amount)).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};
