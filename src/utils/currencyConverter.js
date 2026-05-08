// currencyConverter.js - Real-time USD to LKR converter utility

const CACHE_KEY = 'usd_lkr_rate_cache'
const CACHE_DURATION_MS = 30 * 60 * 1000 // 30 minutes

// Fallback rate if API is unreachable (updated periodically)
const FALLBACK_RATE = 298.50

/**
 * Get cached exchange rate if still valid
 */
function getCachedRate() {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const { rate, timestamp, source } = JSON.parse(cached)
    const age = Date.now() - timestamp

    if (age < CACHE_DURATION_MS) {
      return { rate, source, cached: true, timestamp }
    }
  } catch (e) {
    console.warn('Failed to read cached rate:', e)
  }
  return null
}

/**
 * Cache the exchange rate
 */
function setCachedRate(rate, source) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      rate,
      source,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.warn('Failed to cache rate:', e)
  }
}

/**
 * Fetch real-time USD to LKR exchange rate
 * Uses multiple free API sources with fallback chain
 */
export async function fetchUSDtoLKRRate() {
  // Check cache first
  const cached = getCachedRate()
  if (cached) {
    return {
      rate: cached.rate,
      source: cached.source,
      cached: true,
      lastUpdated: new Date(cached.timestamp).toLocaleString()
    }
  }

  // Try primary API: exchangerate-api.com (free tier)
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(8000)
    })
    if (response.ok) {
      const data = await response.json()
      if (data.result === 'success' && data.rates?.LKR) {
        const rate = data.rates.LKR
        setCachedRate(rate, 'ExchangeRate-API')
        return {
          rate,
          source: 'ExchangeRate-API',
          cached: false,
          lastUpdated: new Date().toLocaleString()
        }
      }
    }
  } catch (e) {
    console.warn('Primary API failed:', e.message)
  }

  // Try secondary API: cdn.jsdelivr.net (fawazahmed0 currency API)
  try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', {
      signal: AbortSignal.timeout(8000)
    })
    if (response.ok) {
      const data = await response.json()
      if (data.usd?.lkr) {
        const rate = data.usd.lkr
        setCachedRate(rate, 'Currency-API')
        return {
          rate,
          source: 'Currency-API',
          cached: false,
          lastUpdated: new Date().toLocaleString()
        }
      }
    }
  } catch (e) {
    console.warn('Secondary API failed:', e.message)
  }

  // Fallback to stored rate
  return {
    rate: FALLBACK_RATE,
    source: 'Fallback (offline)',
    cached: false,
    lastUpdated: 'Using fallback rate',
    isFallback: true
  }
}

/**
 * Convert USD to LKR
 */
export function convertUSDtoLKR(usdAmount, rate) {
  const amount = parseFloat(usdAmount) || 0
  const exchangeRate = parseFloat(rate) || FALLBACK_RATE
  return Math.round(amount * exchangeRate * 100) / 100
}

/**
 * Convert LKR to USD (reverse)
 */
export function convertLKRtoUSD(lkrAmount, rate) {
  const amount = parseFloat(lkrAmount) || 0
  const exchangeRate = parseFloat(rate) || FALLBACK_RATE
  if (exchangeRate === 0) return 0
  return Math.round((amount / exchangeRate) * 100) / 100
}

/**
 * Format USD currency
 */
export function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

/**
 * Format LKR currency
 */
export function formatLKR(amount) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2
  }).format(amount)
}

/**
 * Clear cached rate (force refresh)
 */
export function clearCachedRate() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch (e) {
    console.warn('Failed to clear cached rate:', e)
  }
}
