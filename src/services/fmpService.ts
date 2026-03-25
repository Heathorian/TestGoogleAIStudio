const ALPHA_VANTAGE_API_KEY = (import.meta as {
  env?: { VITE_ALPHA_VANTAGE_API_KEY?: string };
}).env?.VITE_ALPHA_VANTAGE_API_KEY;

const BASE_URL = 'https://www.alphavantage.co/query';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
}

export const fetchStockSearch = async (query: string, limit = 10): Promise<StockSearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    if (!ALPHA_VANTAGE_API_KEY) return [];

    const response = await fetch(
      `${BASE_URL}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(trimmed)}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    if (!response.ok) {
      throw new Error(`Alpha Vantage search error: ${response.statusText}`);
    }

    const data: unknown = await response.json();
    const json = data as { bestMatches?: Array<Record<string, unknown>> };
    const matches = Array.isArray(json.bestMatches) ? json.bestMatches : [];

    return matches
      .slice(0, limit)
      .map((m) => {
        const symbol = String(m['1. symbol'] ?? '').trim().toUpperCase();
        const name = String(m['2. name'] ?? '').trim();
        return { symbol, name };
      })
      .filter((r) => r.symbol && r.name);
  } catch (error) {
    console.error('Error searching stock symbols from Alpha Vantage:', error);
    return [];
  }
};

const fetchAlphaGlobalQuote = async (
  symbol: string,
  attempt = 0
): Promise<StockQuote | null> => {
  if (!ALPHA_VANTAGE_API_KEY) return null;

  const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_VANTAGE_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data: unknown = await response.json();
  const json = data as Record<string, unknown>;

  // Rate limit message example:
  // { "Note": "Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute..." }
  if (typeof json.Note === 'string' && attempt === 0) {
    await delay(12000);
    return fetchAlphaGlobalQuote(symbol, attempt + 1);
  }

  const globalQuote = json['Global Quote'] as Record<string, unknown> | undefined;
  if (!globalQuote) return null;

  const priceRaw = globalQuote['05. price'];
  const price = typeof priceRaw === 'string' ? Number(priceRaw) : Number(priceRaw);

  if (!Number.isFinite(price)) return null;

  // Alpha's GLOBAL_QUOTE doesn't return the company name; keep it empty so callers can fallback.
  return { symbol: symbol.toUpperCase(), name: '', price };
};

export const fetchStockQuotes = async (symbols: string[]): Promise<StockQuote[]> => {
  if (symbols.length === 0) return [];

  const unique = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)));
  const results: StockQuote[] = [];

  // Sequential to avoid triggering Alpha Vantage rate limits.
  for (const symbol of unique) {
    try {
      const quote = await fetchAlphaGlobalQuote(symbol);
      if (quote) results.push(quote);
      // Small pause between calls to reduce risk of hitting "frequency" notes.
      await delay(1000);
    } catch (error) {
      console.error(`Error fetching Alpha Vantage quote for ${symbol}:`, error);
    }
  }

  return results;
};

export const fetchStockQuote = async (symbol: string): Promise<StockQuote | null> => {
  const quotes = await fetchStockQuotes([symbol]);
  return quotes.length > 0 ? quotes[0] : null;
};
