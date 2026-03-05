const { SUPPORTED_CURRENCIES } = require("../config/currencies");

let _ratesCache = null;
let _ratesCachedAt = null;
const RATES_TTL = 60 * 60 * 1000; // 1 hour

async function getExchangeRates() {
  if (_ratesCache && _ratesCachedAt && Date.now() - _ratesCachedAt < RATES_TTL) {
    return { rates: _ratesCache, cachedAt: _ratesCachedAt, cached: true };
  }

  const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
  if (!response.ok) {
    throw new Error(`Exchange rate API returned ${response.status}`);
  }
  const json = await response.json();
  if (!json.rates || typeof json.rates !== "object") {
    throw new Error("Exchange rate API returned unexpected format");
  }

  const filtered = {};
  SUPPORTED_CURRENCIES.forEach((code) => {
    if (json.rates[code] !== undefined) filtered[code] = json.rates[code];
  });
  filtered.USD = 1;

  _ratesCache = filtered;
  _ratesCachedAt = Date.now();

  return { rates: _ratesCache, cachedAt: _ratesCachedAt, cached: false };
}

/**
 * Convert an amount from one currency to another using the given rates object.
 * @param {number} amount
 * @param {string} from  - source currency code
 * @param {string} to    - target currency code
 * @param {object} rates - { USD: 1, INR: 83.5, ... }
 * @returns {number}
 */
function convertCurrency(amount, from, to, rates) {
  if (from === to) return Number(amount);
  const fromRate = rates[from] || 1;
  const toRate = rates[to] || 1;
  return (Number(amount) / fromRate) * toRate;
}

module.exports = { getExchangeRates, convertCurrency };
