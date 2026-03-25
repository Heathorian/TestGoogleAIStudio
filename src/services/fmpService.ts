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

export type AnalystConsensus =
  | 'Strong Buy'
  | 'Buy'
  | 'Hold'
  | 'Sell'
  | 'Strong Sell';

export interface AnalystRecommendation {
  ticker: string;
  name: string;
  consensus: AnalystConsensus;
  why: string;
}

const normalizeConsensus = (value: string): AnalystConsensus | null => {
  const normalized = value.trim().toLowerCase().replace(/[-_]/g, ' ');
  if (!normalized) return null;
  if (normalized.includes('strong buy')) return 'Strong Buy';
  if (normalized.includes('buy')) return 'Buy';
  if (normalized.includes('hold')) return 'Hold';
  if (normalized.includes('strong sell')) return 'Strong Sell';
  if (normalized.includes('sell')) return 'Sell';
  return null;
};

const mapAlphaSentimentToConsensus = (label: string): AnalystConsensus | null => {
  const normalized = label.trim().toLowerCase().replace(/[-_]/g, ' ');
  if (normalized.includes('very bullish') || normalized.includes('extremely bullish')) return 'Strong Buy';
  if (normalized.includes('bullish')) return 'Buy';
  if (normalized.includes('neutral')) return 'Hold';
  if (normalized.includes('very bearish') || normalized.includes('extremely bearish')) return 'Strong Sell';
  if (normalized.includes('bearish')) return 'Sell';
  return null;
};

export const fetchTopAnalystRecommendations = async (
  symbols: string[],
  limit = 5
): Promise<AnalystRecommendation[]> => {
  if (!ALPHA_VANTAGE_API_KEY || symbols.length === 0) return [];

  const uniqueSymbols = Array.from(
    new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))
  );

  const recommendations: AnalystRecommendation[] = [];

  for (const symbol of uniqueSymbols) {
    try {
      const response = await fetch(
        `${BASE_URL}?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(symbol)}&limit=50&apikey=${ALPHA_VANTAGE_API_KEY}`
      );
      if (!response.ok) continue;

      const payload: unknown = await response.json();
      const json = payload as { feed?: Array<Record<string, unknown>> };
      const feed = Array.isArray(json.feed) ? json.feed : [];

      const counts: Record<AnalystConsensus, number> = {
        'Strong Buy': 0,
        Buy: 0,
        Hold: 0,
        Sell: 0,
        'Strong Sell': 0,
      };

      for (const item of feed) {
        const tickerSentiment = Array.isArray(item.ticker_sentiment)
          ? (item.ticker_sentiment as Array<Record<string, unknown>>)
          : [];

        for (const ts of tickerSentiment) {
          const tsTicker = String(ts.ticker ?? '').toUpperCase().trim();
          if (tsTicker !== symbol) continue;
          const label = String(ts.ticker_sentiment_label ?? '');
          const mapped = mapAlphaSentimentToConsensus(label);
          if (mapped) counts[mapped] += 1;
        }
      }

      const ranked = (Object.entries(counts) as Array<[AnalystConsensus, number]>).sort(
        (a, b) => b[1] - a[1]
      );
      const [consensus, total] = ranked[0];
      if (!consensus || !total) continue;

      const summary = ranked
        .filter(([, count]) => count > 0)
        .map(([label, count]) => `${count} ${label.toLowerCase()}`)
        .join(', ');

      recommendations.push({
        ticker: symbol,
        name: symbol,
        consensus,
        why: `Alpha Vantage sentiment distribution: ${summary}.`,
      });

      if (recommendations.length >= limit) break;
      await delay(1000);
    } catch (error) {
      console.error(`Error fetching analyst recommendations for ${symbol}:`, error);
    }
  }

  return recommendations;
};

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
