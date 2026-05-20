export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_forecasts: {
        Row: {
          change_pct: number
          confidence: number
          current_price: number
          forecast_path: Json
          generated_at: string
          horizon_days: number
          id: string
          predicted_price: number
          signal: string
          ticker: string
        }
        Insert: {
          change_pct: number
          confidence: number
          current_price: number
          forecast_path: Json
          generated_at?: string
          horizon_days?: number
          id?: string
          predicted_price: number
          signal: string
          ticker: string
        }
        Update: {
          change_pct?: number
          confidence?: number
          current_price?: number
          forecast_path?: Json
          generated_at?: string
          horizon_days?: number
          id?: string
          predicted_price?: number
          signal?: string
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_forecasts_ticker_fkey"
            columns: ["ticker"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["ticker"]
          },
        ]
      }
      ai_metrics: {
        Row: {
          alpha: number | null
          buyhold_return: number | null
          direction_accuracy: number | null
          generated_at: string
          mae: number | null
          mape: number | null
          max_drawdown: number | null
          rmse: number | null
          sharpe: number | null
          strategy_return: number | null
          ticker: string
        }
        Insert: {
          alpha?: number | null
          buyhold_return?: number | null
          direction_accuracy?: number | null
          generated_at?: string
          mae?: number | null
          mape?: number | null
          max_drawdown?: number | null
          rmse?: number | null
          sharpe?: number | null
          strategy_return?: number | null
          ticker: string
        }
        Update: {
          alpha?: number | null
          buyhold_return?: number | null
          direction_accuracy?: number | null
          generated_at?: string
          mae?: number | null
          mape?: number | null
          max_drawdown?: number | null
          rmse?: number | null
          sharpe?: number | null
          strategy_return?: number | null
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_metrics_ticker_fkey"
            columns: ["ticker"]
            isOneToOne: true
            referencedRelation: "stocks"
            referencedColumns: ["ticker"]
          },
        ]
      }
      financial_profiles: {
        Row: {
          cash_liquid: number
          emergency_fund: number
          investment_horizon_years: number
          monthly_debt_payment: number
          monthly_expenses: number
          monthly_income: number
          total_assets: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_liquid?: number
          emergency_fund?: number
          investment_horizon_years?: number
          monthly_debt_payment?: number
          monthly_expenses?: number
          monthly_income?: number
          total_assets?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_liquid?: number
          emergency_fund?: number
          investment_horizon_years?: number
          monthly_debt_payment?: number
          monthly_expenses?: number
          monthly_income?: number
          total_assets?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      historical_prices: {
        Row: {
          close: number
          date: string
          ema20: number | null
          high: number
          low: number
          open: number
          price_smoothed: number | null
          rsi: number | null
          ticker: string
          volume: number
        }
        Insert: {
          close: number
          date: string
          ema20?: number | null
          high: number
          low: number
          open: number
          price_smoothed?: number | null
          rsi?: number | null
          ticker: string
          volume?: number
        }
        Update: {
          close?: number
          date?: string
          ema20?: number | null
          high?: number
          low?: number
          open?: number
          price_smoothed?: number | null
          rsi?: number | null
          ticker?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "historical_prices_ticker_fkey"
            columns: ["ticker"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["ticker"]
          },
        ]
      }
      holdings: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["asset_category"]
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["asset_category"]
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["asset_category"]
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      questionnaire_responses: {
        Row: {
          q1: number
          q2: number
          q3: number
          q4: number
          q5: number
          q6: number
          q7: number
          updated_at: string
          user_id: string
        }
        Insert: {
          q1: number
          q2: number
          q3: number
          q4: number
          q5: number
          q6: number
          q7: number
          updated_at?: string
          user_id: string
        }
        Update: {
          q1?: number
          q2?: number
          q3?: number
          q4?: number
          q5?: number
          q6?: number
          q7?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stocks: {
        Row: {
          exchange: string
          name: string
          sector: string
          ticker: string
        }
        Insert: {
          exchange?: string
          name: string
          sector: string
          ticker: string
        }
        Update: {
          exchange?: string
          name?: string
          sector?: string
          ticker?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          fee: number
          id: string
          notes: string | null
          price: number
          quantity: number
          side: Database["public"]["Enums"]["trade_side"]
          tax: number
          ticker: string
          traded_at: string
          user_id: string
        }
        Insert: {
          fee?: number
          id?: string
          notes?: string | null
          price: number
          quantity: number
          side: Database["public"]["Enums"]["trade_side"]
          tax?: number
          ticker: string
          traded_at?: string
          user_id: string
        }
        Update: {
          fee?: number
          id?: string
          notes?: string | null
          price?: number
          quantity?: number
          side?: Database["public"]["Enums"]["trade_side"]
          tax?: number
          ticker?: string
          traded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      xai_explanations: {
        Row: {
          feature: string
          generated_at: string
          id: string
          importance: number
          method: string
          ticker: string
        }
        Insert: {
          feature: string
          generated_at?: string
          id?: string
          importance: number
          method: string
          ticker: string
        }
        Update: {
          feature?: string
          generated_at?: string
          id?: string
          importance?: number
          method?: string
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "xai_explanations_ticker_fkey"
            columns: ["ticker"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["ticker"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      asset_category: "cash" | "gold" | "stock" | "bond_fund"
      trade_side: "buy" | "sell"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asset_category: ["cash", "gold", "stock", "bond_fund"],
      trade_side: ["buy", "sell"],
    },
  },
} as const
