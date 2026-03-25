const FMP_API_KEY =
  (import.meta as { env?: { VITE_FMP_API_KEY?: string } }).env?.VITE_FMP_API_KEY ||
  'kllqYJQpey9ZwAVwrlwR4p3yU1wFrqDF';
const BASE_URL = 'https://financialmodelingprep.com/stable';

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
    const response = await fetch(
      `${BASE_URL}/search-symbol?query=${encodeURIComponent(trimmed)}&limit=${limit}&apikey=${FMP_API_KEY}`
    );
    if (!response.ok) {
      throw new Error(`FMP search error: ${response.statusText}`);
    }

    const data = await response.json();
    // FMP returns an array of results with fields like: symbol, name (and more).
    return (data as Array<{ symbol?: string; name?: string }>)
      .filter((r) => r.symbol && r.name)
      .slice(0, limit)
      .map((r) => ({ symbol: r.symbol as string, name: r.name as string }));
  } catch (error) {
    console.error('Error searching stock symbols from FMP:', error);
    return [];
  }
};

export const fetchStockQuotes = async (symbols: string[]): Promise<StockQuote[]> => {
  if (symbols.length === 0) return [];

  // `stable/quote?symbol=` expects ONE symbol.
  // Passing multiple symbols (e.g. comma-separated) may hit premium/special endpoints.
  // So we query each symbol individually and merge results.
  const unique = Array.from(new Set(symbols.map((s) => s.trim()).filter(Boolean)));
  const results: StockQuote[] = [];

  for (const symbol of unique) {
    try {
      const response = await fetch(
        `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_API_KEY}`
      );
      if (!response.ok) continue;

      const data: unknown = await response.json();
      const arr = Array.isArray(data) ? data : [data];

      const quote = (arr as Array<unknown>)
        .map((q) => q as Record<string, unknown>)
        .map((obj) => {
          const normalizedSymbol = String(obj.symbol ?? obj.ticker ?? '').trim();
          const nameFromApi = String(obj.name ?? obj.companyName ?? '').trim();
          const name = nameFromApi || normalizedSymbol;
          const priceRaw = obj.price ?? obj.lastPrice ?? obj.close ?? obj.adjClose;
          const price = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw);
          return { symbol: normalizedSymbol, name, price };
        })
        .find((q) => q.symbol && Number.isFinite(q.price));

      if (quote) results.push(quote);
    } catch (error) {
      console.error(`Error fetching FMP quote for ${symbol}:`, error);
    }
  }

  return results;
};

export const fetchStockQuote = async (symbol: string): Promise<StockQuote | null> => {
  const quotes = await fetchStockQuotes([symbol]);
  return quotes.length > 0 ? quotes[0] : null;
};
