const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const DEV_USER_ID = 'user-123'

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'X-User-Id': DEV_USER_ID,
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export function getAssetSummary() {
  return apiFetch('/api/assets/summary')
}

export function getStockSeed(market) {
  return apiFetch(`/api/assets/stocks?market=${encodeURIComponent(market)}`)
}

export function getStockSummary(market) {
  return apiFetch(`/api/stocks/markets/${encodeURIComponent(market)}/summary`)
}

export function getStockHoldings(market, sortByDay = false) {
  const query = sortByDay ? '?sort=dayChangePct' : ''
  return apiFetch(`/api/stocks/markets/${encodeURIComponent(market)}/holdings${query}`)
}

export function searchStocks(query, market) {
  return apiFetch(`/api/stocks/search?query=${encodeURIComponent(query)}&market=${encodeURIComponent(market)}`)
}

export function addHolding(market, payload) {
  return apiFetch(`/api/stocks/markets/${encodeURIComponent(market)}/holdings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}
