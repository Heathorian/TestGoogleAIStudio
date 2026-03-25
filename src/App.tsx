/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  GraduationCap, 
  TrendingUp, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Search,
  LogIn,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  BookOpen,
  Play,
  CheckCircle2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { fetchStockQuotes, fetchStockQuote, fetchStockSearch, StockSearchResult } from './services/fmpService';

// --- Types ---

interface Stock {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
}

interface Recommendation {
  ticker: string;
  name: string;
  consensus: 'Strong Buy' | 'Buy' | 'Hold';
  why: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  progress: number;
  xp: number;
  completed: boolean;
}

// --- Mock Data ---

const INITIAL_STOCKS: Stock[] = [
  { id: '1', ticker: 'AAPL', name: 'Apple Inc.', shares: 10, avgCost: 150, currentPrice: 175.50 },
  { id: '2', ticker: 'TSLA', name: 'Tesla, Inc.', shares: 5, avgCost: 200, currentPrice: 185.20 },
  { id: '3', ticker: 'MSFT', name: 'Microsoft Corp.', shares: 8, avgCost: 300, currentPrice: 410.10 },
];

const RECOMMENDATIONS: Recommendation[] = [
  { 
    ticker: 'NVDA', 
    name: 'NVIDIA Corp.', 
    consensus: 'Strong Buy', 
    why: 'Dominance in AI chip market continues to drive record earnings. Massive growth potential in data center segment.' 
  },
  { 
    ticker: 'AMZN', 
    name: 'Amazon.com, Inc.', 
    consensus: 'Buy', 
    why: 'AWS cloud growth is accelerating again. Retail margins are improving through logistics optimization.' 
  },
  { 
    ticker: 'GOOGL', 
    name: 'Alphabet Inc.', 
    consensus: 'Buy', 
    why: 'Strong search advertising resilience. Gemini integration across products is showing early positive signals.' 
  },
  { 
    ticker: 'META', 
    name: 'Meta Platforms', 
    consensus: 'Strong Buy', 
    why: 'Efficient ad targeting and high user engagement on Reels. Strong balance sheet with aggressive buybacks.' 
  },
  { 
    ticker: 'V', 
    name: 'Visa Inc.', 
    consensus: 'Hold', 
    why: 'Steady payment volume growth globally. Valuation is currently at historical averages, suggesting fair pricing.' 
  },
];

const LESSONS: Lesson[] = [
  { id: 'l1', title: 'Your First Share', description: 'Learn what a stock actually is and how ownership works.', progress: 100, xp: 500, completed: true },
  { id: 'l2', title: 'Understanding Dividends', description: 'How companies pay you just for holding their stock.', progress: 40, xp: 750, completed: false },
  { id: 'l3', title: 'The Power of Compound Interest', description: 'Why starting early is your biggest competitive advantage.', progress: 0, xp: 1000, completed: false },
  { id: 'l4', title: 'Reading a Balance Sheet', description: 'Master the basics of fundamental analysis.', progress: 0, xp: 1500, completed: false },
];

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 group ${
      active 
        ? 'bg-chess-gray text-white border-l-4 border-chess-green' 
        : 'text-chess-light-gray hover:bg-chess-gray hover:text-white'
    }`}
  >
    <Icon size={24} className={active ? 'text-chess-green' : 'group-hover:text-chess-green'} />
    <span className="font-bold text-lg hidden md:block">{label}</span>
  </button>
);

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-chess-dark rounded-xl p-6 shadow-xl border border-chess-gray/30 ${className}`}>
    {children}
  </div>
);

const ProgressBar = ({ progress }: { progress: number }) => (
  <div className="w-full bg-chess-gray rounded-full h-3 overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      className="bg-chess-green h-full"
    />
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'portfolio' | 'academy' | 'insights' | 'login'>('dashboard');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStock, setNewStock] = useState({ ticker: '', name: '', shares: '', avgCost: '' });
  const [stockSearchResults, setStockSearchResults] = useState<StockSearchResult[]>([]);
  const [stockSearchLoading, setStockSearchLoading] = useState(false);
  const [showStockSearchResults, setShowStockSearchResults] = useState(false);
  const [stockSearchLoaded, setStockSearchLoaded] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // --- Supabase Sync ---

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const tickers = data.map(s => s.ticker);
        const quotes = await fetchStockQuotes(tickers);
        
        const mappedStocks: Stock[] = data.map((s) => {
          const quote = quotes.find((q) => q.symbol === s.ticker);
          // Always prefer FMP real-time price (fallback to 0 if FMP didn't return a price).
          // This avoids displaying potentially stale Supabase-stored values.
          const currentPrice = quote && Number.isFinite(quote.price) ? quote.price : 0;

          return {
            id: s.id,
            ticker: s.ticker,
            name: s.name,
            shares: s.shares,
            avgCost: s.avg_cost,
            currentPrice,
          };
        });
        setStocks(mappedStocks);
      } else if (data && data.length === 0) {
        setStocks([]);
      }
    } catch (error) {
      console.error('Error fetching stocks:', error);
      if (stocks.length === 0) {
        setStocks(INITIAL_STOCKS);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStockSearch = (result: StockSearchResult) => {
    setNewStock((prev) => ({ ...prev, ticker: result.symbol, name: result.name }));
    setStockSearchResults([]);
    setShowStockSearchResults(false);
    setStockSearchLoaded(false);
  };

  useEffect(() => {
    if (!showAddModal) return;

    const q = newStock.ticker.trim();
    if (q.length < 2) {
      setStockSearchResults([]);
      setShowStockSearchResults(false);
      setStockSearchLoaded(false);
      return;
    }

    let cancelled = false;
    setStockSearchLoading(true);
    setStockSearchLoaded(false);

    const timeoutId = window.setTimeout(async () => {
      const results = await fetchStockSearch(q, 8);
      if (cancelled) return;
      setStockSearchResults(results);
      setShowStockSearchResults(results.length > 0);
      setStockSearchLoaded(true);
      setStockSearchLoading(false);
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [showAddModal, newStock.ticker]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) throw error;
      setActiveTab('dashboard');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  // --- Calculations ---

  const totalValue = useMemo(() => stocks.reduce((acc, s) => acc + s.shares * s.currentPrice, 0), [stocks]);
  const totalCost = useMemo(() => stocks.reduce((acc, s) => acc + s.shares * s.avgCost, 0), [stocks]);
  const totalProfit = totalValue - totalCost;
  const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // --- Handlers ---

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const ticker = newStock.ticker.toUpperCase();
    const shares = Number(newStock.shares);
    const avgCost = Number(newStock.avgCost);
    
    setLoading(true);
    try {
      // Fetch real-time price for the new stock
      const quote = await fetchStockQuote(ticker);
      const currentPrice = quote && Number.isFinite(quote.price) ? quote.price : avgCost;
      const stockName = quote?.name || newStock.name || ticker;

      const { data, error } = await supabase
        .from('stocks')
        .insert([{
          ticker,
          name: stockName,
          shares,
          avg_cost: avgCost,
          current_price: currentPrice
        }])
        .select();

      if (error) throw error;

      if (data) {
        const addedStock: Stock = {
          id: data[0].id,
          ticker: data[0].ticker,
          name: data[0].name,
          shares: data[0].shares,
          avgCost: data[0].avg_cost,
          currentPrice: data[0].current_price
        };
        setStocks([addedStock, ...stocks]);
      }
    } catch (error) {
      console.error('Error adding stock:', error);
      // Local fallback
      setStocks([{
        id: Math.random().toString(36).substr(2, 9),
        ticker,
        name: newStock.name,
        shares,
        avgCost,
        currentPrice: avgCost,
      }, ...stocks]);
    } finally {
      setLoading(false);
    }

    setNewStock({ ticker: '', name: '', shares: '', avgCost: '' });
    setShowAddModal(false);
  };

  const handleDeleteStock = async (id: string) => {
    try {
      const { error } = await supabase
        .from('stocks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setStocks(stocks.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting stock:', error);
      // Local fallback
      setStocks(stocks.filter(s => s.id !== id));
    }
  };

  if (loading && stocks.length === 0) {
    return (
      <div className="flex min-h-screen bg-chess-darker text-white items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-chess-green animate-spin mx-auto" />
          <p className="font-black text-xl tracking-widest animate-pulse">LOADING ECOTRACK...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-chess-darker text-white">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 bg-chess-dark border-r border-chess-gray/50 flex flex-col fixed h-full z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-chess-green rounded-lg flex items-center justify-center shadow-lg shadow-chess-green/20">
            <TrendingUp className="text-chess-darker" size={24} strokeWidth={3} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter hidden md:block">ECOTRACK</h1>
        </div>

        <nav className="flex-1 px-3 space-y-2 mt-4">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={Briefcase} 
            label="Portfolio" 
            active={activeTab === 'portfolio'} 
            onClick={() => setActiveTab('portfolio')} 
          />
          <SidebarItem 
            icon={GraduationCap} 
            label="Academy" 
            active={activeTab === 'academy'} 
            onClick={() => setActiveTab('academy')} 
          />
          <SidebarItem 
            icon={Search} 
            label="Insights" 
            active={activeTab === 'insights'} 
            onClick={() => setActiveTab('insights')} 
          />
          <SidebarItem
            icon={LogIn}
            label="Login"
            active={activeTab === 'login'}
            onClick={() => setActiveTab('login')}
          />
        </nav>

        <div className="p-4 border-t border-chess-gray/50 hidden md:block">
          <div className="bg-chess-gray/50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                <Award size={16} className="text-chess-darker" />
              </div>
              <span className="font-bold text-sm">Novice Trader</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-chess-light-gray">Level 2</span>
              <span className="text-chess-green font-bold">1,250 XP</span>
            </div>
            <ProgressBar progress={65} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-20 md:ml-64 p-4 md:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <p className="text-chess-light-gray font-bold uppercase tracking-widest text-xs mb-1">Overview</p>
                  <h2 className="text-4xl font-black">Dashboard</h2>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={fetchStocks}
                    disabled={loading}
                    className="bg-chess-dark p-4 rounded-xl border border-chess-gray/30 hover:border-chess-green transition-colors group disabled:opacity-50"
                  >
                    <RefreshCw size={20} className={`text-chess-light-gray group-hover:text-chess-green ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <div className="bg-chess-dark p-4 rounded-xl border border-chess-gray/30 min-w-[160px]">
                    <p className="text-chess-light-gray text-xs font-bold uppercase mb-1">Total Value</p>
                    <p className="text-2xl font-black">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-chess-dark p-4 rounded-xl border border-chess-gray/30 min-w-[160px]">
                    <p className="text-chess-light-gray text-xs font-bold uppercase mb-1">Total Profit</p>
                    <div className={`flex items-center gap-1 text-2xl font-black ${totalProfit >= 0 ? 'text-chess-green' : 'text-red-500'}`}>
                      {totalProfit >= 0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                      ${Math.abs(totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Stats & Chart Placeholder */}
                <div className="lg:col-span-2 space-y-8">
                  <Card className="h-80 flex flex-col justify-between relative overflow-hidden">
                    <div className="z-10">
                      <h3 className="text-xl font-black mb-2">Performance History</h3>
                      <p className="text-chess-light-gray text-sm">Your portfolio is up <span className="text-chess-green font-bold">{profitPercent.toFixed(2)}%</span> all-time.</p>
                    </div>
                    {/* Mock Chart Visualization */}
                    <div className="absolute bottom-0 left-0 w-full h-48 flex items-end px-4 gap-1 opacity-20">
                      {[40, 45, 38, 52, 60, 55, 70, 65, 80, 75, 90, 85].map((h, i) => (
                        <motion.div 
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${h}%` }}
                          transition={{ delay: i * 0.05 }}
                          className="flex-1 bg-chess-green rounded-t-sm"
                        />
                      ))}
                    </div>
                    <div className="z-10 flex justify-between items-center">
                      <div className="flex gap-2">
                        {['1D', '1W', '1M', '1Y', 'ALL'].map(t => (
                          <button key={t} className={`px-3 py-1 rounded-md text-xs font-bold ${t === 'ALL' ? 'bg-chess-green text-chess-darker' : 'bg-chess-gray text-chess-light-gray'}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                      <button className="text-chess-green font-bold text-sm flex items-center gap-1 hover:underline">
                        View Details <ChevronRight size={16} />
                      </button>
                    </div>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-500">
                          <BookOpen size={20} />
                        </div>
                        <h3 className="font-black">Daily Insight</h3>
                      </div>
                      <p className="text-sm text-chess-light-gray leading-relaxed mb-4">
                        Tech stocks are showing strong momentum today. Consider rebalancing your Apple position if it exceeds 20% of your total portfolio value.
                      </p>
                      <button className="w-full py-2 bg-chess-gray hover:bg-chess-gray/80 rounded-lg font-bold text-sm transition-colors">
                        Learn More
                      </button>
                    </Card>
                    <Card>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-chess-green/20 rounded-lg flex items-center justify-center text-chess-green">
                          <Award size={20} />
                        </div>
                        <h3 className="font-black">Next Milestone</h3>
                      </div>
                      <p className="text-sm text-chess-light-gray leading-relaxed mb-4">
                        Complete the "Understanding Dividends" lesson to earn 750 XP and unlock the "Income Investor" badge.
                      </p>
                      <button 
                        onClick={() => setActiveTab('academy')}
                        className="w-full py-2 bg-chess-green hover:bg-chess-green/90 text-chess-darker rounded-lg font-bold text-sm transition-colors"
                      >
                        Go to Academy
                      </button>
                    </Card>
                  </div>
                </div>

                {/* Top 5 Daily Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black">Top 5 Daily</h3>
                    <span className="text-xs bg-chess-gray px-2 py-1 rounded font-bold text-chess-light-gray">MAR 25</span>
                  </div>
                  <div className="space-y-4">
                    {RECOMMENDATIONS.map((rec, idx) => (
                      <motion.div
                        key={rec.ticker}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        <Card className="p-4 hover:border-chess-green/50 transition-colors cursor-pointer group">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-chess-green font-black text-lg">{rec.ticker}</span>
                              <p className="text-xs text-chess-light-gray font-bold">{rec.name}</p>
                            </div>
                            <span className={`text-[10px] uppercase font-black px-2 py-1 rounded ${
                              rec.consensus === 'Strong Buy' ? 'bg-chess-green text-chess-darker' : 
                              rec.consensus === 'Buy' ? 'bg-chess-green/20 text-chess-green border border-chess-green/30' : 
                              'bg-chess-gray text-chess-light-gray'
                            }`}>
                              {rec.consensus}
                            </span>
                          </div>
                          <div className="bg-chess-darker p-3 rounded-lg border border-chess-gray/20">
                            <p className="text-xs text-chess-light-gray leading-relaxed italic">
                              "{rec.why}"
                            </p>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'portfolio' && (
            <motion.div
              key="portfolio"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-chess-light-gray font-bold uppercase tracking-widest text-xs mb-1">Assets</p>
                  <h2 className="text-4xl font-black">My Portfolio</h2>
                </div>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-chess-green hover:bg-chess-green/90 text-chess-darker px-6 py-3 rounded-xl font-black flex items-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-chess-green/20"
                >
                  <Plus size={20} strokeWidth={3} />
                  ADD STOCK
                </button>
              </header>

              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-chess-gray/30 text-chess-light-gray text-xs uppercase font-black">
                        <th className="px-6 py-4">Stock</th>
                        <th className="px-6 py-4">Shares</th>
                        <th className="px-6 py-4">Avg Cost</th>
                        <th className="px-6 py-4">Current Price</th>
                        <th className="px-6 py-4">Profit</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-chess-gray/30">
                      {stocks.map((stock) => {
                        const profit = (stock.currentPrice - stock.avgCost) * stock.shares;
                        const isProfit = profit >= 0;
                        return (
                          <tr key={stock.id} className="hover:bg-chess-gray/20 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-chess-gray rounded-lg flex items-center justify-center font-black text-chess-green">
                                  {stock.ticker[0]}
                                </div>
                                <div>
                                  <p className="font-black text-lg">{stock.ticker}</p>
                                  <p className="text-xs text-chess-light-gray">{stock.name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-bold">{stock.shares}</td>
                            <td className="px-6 py-4 text-chess-light-gray">${stock.avgCost.toFixed(2)}</td>
                            <td className="px-6 py-4 font-bold">${stock.currentPrice.toFixed(2)}</td>
                            <td className={`px-6 py-4 font-black ${isProfit ? 'text-chess-green' : 'text-red-500'}`}>
                              <div className="flex items-center gap-1">
                                {isProfit ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                                ${Math.abs(profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => handleDeleteStock(stock.id)}
                                className="p-2 text-chess-light-gray hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 size={20} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {stocks.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-chess-light-gray italic">
                            Your portfolio is empty. Add your first stock to get started!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'academy' && (
            <motion.div
              key="academy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <header className="text-center space-y-2">
                <p className="text-chess-green font-black uppercase tracking-[0.2em] text-sm">Learning Academy</p>
                <h2 className="text-5xl font-black tracking-tight">Master the Markets</h2>
                <p className="text-chess-light-gray max-w-lg mx-auto">
                  Level up your financial IQ with our gamified lessons. Earn XP, unlock badges, and become a grandmaster of investing.
                </p>
              </header>

              <div className="space-y-4">
                {LESSONS.map((lesson, idx) => (
                  <motion.div
                    key={lesson.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Card className={`group hover:border-chess-green transition-all cursor-pointer ${lesson.completed ? 'opacity-75' : ''}`}>
                      <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${
                          lesson.completed ? 'bg-chess-green text-chess-darker' : 'bg-chess-gray text-chess-green'
                        }`}>
                          {lesson.completed ? <CheckCircle2 size={32} strokeWidth={3} /> : <Play size={32} fill="currentColor" />}
                        </div>
                        <div className="flex-1 space-y-2 text-center md:text-left">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <h3 className="text-xl font-black">{lesson.title}</h3>
                            <span className="text-xs font-black bg-chess-darker px-3 py-1 rounded-full text-chess-green border border-chess-green/30">
                              +{lesson.xp} XP
                            </span>
                          </div>
                          <p className="text-chess-light-gray text-sm">{lesson.description}</p>
                          <div className="pt-2">
                            <div className="flex justify-between text-[10px] font-black uppercase mb-1 text-chess-light-gray">
                              <span>Progress</span>
                              <span>{lesson.progress}%</span>
                            </div>
                            <ProgressBar progress={lesson.progress} />
                          </div>
                        </div>
                        <button className={`px-6 py-3 rounded-xl font-black transition-all ${
                          lesson.completed 
                            ? 'bg-chess-gray text-white hover:bg-chess-gray/80' 
                            : 'bg-chess-green text-chess-darker hover:scale-105 shadow-lg shadow-chess-green/20'
                        }`}>
                          {lesson.completed ? 'REVIEW' : lesson.progress > 0 ? 'CONTINUE' : 'START'}
                        </button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto space-y-6"
            >
              <header className="text-center space-y-2">
                <p className="text-chess-green font-black uppercase tracking-[0.2em] text-sm">Sign In</p>
                <h2 className="text-4xl font-black tracking-tight">Login</h2>
                <p className="text-chess-light-gray">
                  Access your saved portfolio and settings.
                </p>
              </header>

              <Card className="p-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-chess-light-gray uppercase">Email</label>
                    <input
                      required
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-chess-darker border border-chess-gray/50 rounded-xl px-4 py-3 focus:border-chess-green focus:outline-none transition-colors font-bold"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-chess-light-gray uppercase">Password</label>
                    <input
                      required
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-chess-darker border border-chess-gray/50 rounded-xl px-4 py-3 focus:border-chess-green focus:outline-none transition-colors font-bold"
                      placeholder="••••••••"
                    />
                  </div>

                  {loginError && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl text-sm font-bold">
                      {loginError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-3 rounded-xl font-black bg-chess-green text-chess-darker hover:bg-chess-green/90 transition-colors shadow-lg shadow-chess-green/20 disabled:opacity-50"
                  >
                    {loginLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="text-chess-light-gray hover:underline text-sm font-bold"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto text-center py-20"
            >
              <div className="w-24 h-24 bg-chess-gray rounded-full flex items-center justify-center mx-auto mb-6 text-chess-green">
                <Search size={48} />
              </div>
              <h2 className="text-3xl font-black mb-4">Market Insights</h2>
              <p className="text-chess-light-gray mb-8 max-w-md mx-auto">
                Our AI-driven market analysis engine is currently crunching data for the next trading session. Check back soon for deep dives into your favorite sectors.
              </p>
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="bg-chess-green text-chess-darker px-8 py-3 rounded-xl font-black hover:scale-105 transition-transform"
              >
                BACK TO DASHBOARD
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Add Stock Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-chess-darker/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-chess-dark w-full max-w-md rounded-2xl p-8 shadow-2xl border border-chess-gray/50 relative z-10"
            >
              <h3 className="text-2xl font-black mb-6">Add New Position</h3>
              <form onSubmit={handleAddStock} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-chess-light-gray uppercase">Ticker Symbol</label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      placeholder="e.g. AAPL"
                      value={newStock.ticker}
                      onChange={(e) =>
                        setNewStock({
                          ...newStock,
                          ticker: e.target.value.toUpperCase(),
                        })
                      }
                      onFocus={() => {
                        if (stockSearchResults.length > 0) setShowStockSearchResults(true);
                      }}
                      onBlur={() =>
                        window.setTimeout(() => {
                          setShowStockSearchResults(false);
                        }, 150)
                      }
                      className="w-full bg-chess-darker border border-chess-gray/50 rounded-xl px-4 py-3 focus:border-chess-green focus:outline-none transition-colors font-bold uppercase"
                    />

                    {newStock.ticker.trim().length >= 2 && (stockSearchLoading || stockSearchLoaded) && (
                      <div className="absolute left-0 right-0 mt-2 bg-chess-dark border border-chess-gray/50 rounded-xl shadow-2xl max-h-60 overflow-auto z-20">
                        {stockSearchLoading && (
                          <div className="px-4 py-3 text-xs font-bold text-chess-light-gray">Searching...</div>
                        )}

                        {!stockSearchLoading && stockSearchResults.length === 0 && (
                          <div className="px-4 py-3 text-xs font-bold text-chess-light-gray">No matching stocks</div>
                        )}

                        {!stockSearchLoading &&
                          stockSearchResults.map((r) => (
                            <button
                              key={r.symbol}
                              type="button"
                              onMouseDown={(e) => {
                                // Prevent input blur from hiding results before selection.
                                e.preventDefault();
                                handleSelectStockSearch(r);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-chess-gray/30 transition-colors border-b border-chess-gray/20 last:border-b-0"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-chess-green font-black uppercase">{r.symbol}</span>
                                <span className="text-[11px] font-black text-chess-light-gray opacity-70">FMP</span>
                              </div>
                              <div className="text-xs font-bold text-chess-light-gray mt-1 truncate">{r.name}</div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-chess-light-gray uppercase">Company Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Apple Inc."
                    value={newStock.name}
                    onChange={e => setNewStock({...newStock, name: e.target.value})}
                    className="w-full bg-chess-darker border border-chess-gray/50 rounded-xl px-4 py-3 focus:border-chess-green focus:outline-none transition-colors font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-chess-light-gray uppercase">Shares</label>
                    <input 
                      required
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={newStock.shares}
                      onChange={e => setNewStock({...newStock, shares: e.target.value})}
                      className="w-full bg-chess-darker border border-chess-gray/50 rounded-xl px-4 py-3 focus:border-chess-green focus:outline-none transition-colors font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-chess-light-gray uppercase">Avg Cost ($)</label>
                    <input 
                      required
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={newStock.avgCost}
                      onChange={e => setNewStock({...newStock, avgCost: e.target.value})}
                      className="w-full bg-chess-darker border border-chess-gray/50 rounded-xl px-4 py-3 focus:border-chess-green focus:outline-none transition-colors font-bold"
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 rounded-xl font-black bg-chess-gray hover:bg-chess-gray/80 transition-colors"
                  >
                    CANCEL
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 rounded-xl font-black bg-chess-green text-chess-darker hover:bg-chess-green/90 transition-colors shadow-lg shadow-chess-green/20"
                  >
                    ADD ASSET
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
