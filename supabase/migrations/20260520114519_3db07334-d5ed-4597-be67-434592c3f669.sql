
CREATE TABLE public.stocks (
  ticker text PRIMARY KEY,
  name text NOT NULL,
  sector text NOT NULL,
  exchange text NOT NULL DEFAULT 'HOSE'
);
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stocks public read" ON public.stocks FOR SELECT USING (true);

CREATE TABLE public.historical_prices (
  ticker text NOT NULL REFERENCES public.stocks(ticker) ON DELETE CASCADE,
  date date NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  volume numeric NOT NULL DEFAULT 0,
  price_smoothed numeric,
  rsi numeric,
  ema20 numeric,
  PRIMARY KEY (ticker, date)
);
ALTER TABLE public.historical_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hp public read" ON public.historical_prices FOR SELECT USING (true);
CREATE INDEX idx_hp_ticker_date ON public.historical_prices(ticker, date DESC);

CREATE TABLE public.ai_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL REFERENCES public.stocks(ticker) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  current_price numeric NOT NULL,
  horizon_days integer NOT NULL DEFAULT 7,
  predicted_price numeric NOT NULL,
  change_pct numeric NOT NULL,
  signal text NOT NULL,
  confidence numeric NOT NULL,
  forecast_path jsonb NOT NULL
);
ALTER TABLE public.ai_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fc public read" ON public.ai_forecasts FOR SELECT USING (true);
CREATE INDEX idx_fc_ticker ON public.ai_forecasts(ticker, generated_at DESC);

CREATE TABLE public.ai_metrics (
  ticker text PRIMARY KEY REFERENCES public.stocks(ticker) ON DELETE CASCADE,
  rmse numeric, mae numeric, mape numeric,
  direction_accuracy numeric,
  strategy_return numeric, buyhold_return numeric, alpha numeric,
  sharpe numeric, max_drawdown numeric,
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "m public read" ON public.ai_metrics FOR SELECT USING (true);

CREATE TABLE public.xai_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL REFERENCES public.stocks(ticker) ON DELETE CASCADE,
  method text NOT NULL,
  feature text NOT NULL,
  importance numeric NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xai_explanations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xai public read" ON public.xai_explanations FOR SELECT USING (true);
CREATE INDEX idx_xai_ticker ON public.xai_explanations(ticker, method);

CREATE TYPE public.trade_side AS ENUM ('buy','sell');
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ticker text NOT NULL,
  side public.trade_side NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  price numeric NOT NULL CHECK (price > 0),
  fee numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  traded_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx own read" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tx own insert" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tx own update" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tx own delete" ON public.transactions FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_tx_user ON public.transactions(user_id, traded_at DESC);
