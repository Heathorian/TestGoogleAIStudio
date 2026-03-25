const FMP_API_KEY =
  (import.meta as { env?: { VITE_FMP_API_KEY?: string } }).env?.VITE_FMP_API_KEY ||
  'kllqYJQpey9ZwAVwrlwR4p3yU1wFrqDF';
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  volume: number;
  avgVolume: number;
  exchange: string;
  open: number;
  previousClose: number;
  eps: number;
  pe: number;
  earningsAnnouncement: string;
  sharesOutstanding: number;
  timestamp: number;
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
      `${BASE_URL}/search?query=${encodeURIComponent(trimmed)}&limit=${limit}&apikey=${FMP_API_KEY}`
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
  
  const symbolString = symbols.join(',');
  try {
    const response = await fetch(`${BASE_URL}/quote/${symbolString}?apikey=${FMP_API_KEY}`);
    if (!response.ok) {
      throw new Error(`FMP API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data as StockQuote[];
  } catch (error) {
    console.error('Error fetching stock quotes from FMP:', error);
    return [];
  }
};

export const fetchStockQuote = async (symbol: string): Promise<StockQuote | null> => {
  const quotes = await fetchStockQuotes([symbol]);
  return quotes.length > 0 ? quotes[0] : null;
};

