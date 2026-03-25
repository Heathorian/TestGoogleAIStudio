const FMP_API_KEY = import.meta.env.VITE_FMP_API_KEY || 'kllqYJQpey9ZwAVwrlwR4p3yU1wFrqDF';
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
