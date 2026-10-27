import { createBrowserClient } from "@supabase/ssr";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

type ProductRow = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price_usd: number;
  wholesale_price_usd: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

type VariantRow = {
  id: string;
  product_id: string | null;
  sku: string;
  size: string;
  color: string;
  color_hex: string | null;
  stock_quantity: number;
  min_stock_alert: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

type InventoryLogRow = {
  id: string;
  variant_id: string | null;
  user_id: string | null;
  type: "ADDITION" | "ADJUSTMENT" | "SALE" | "RETURN";
  quantity_changed: number;
  previous_stock: number;
  new_stock: number;
  notes: string | null;
  created_at: string;
};

type ExchangeRateRow = {
  id: string;
  rate_ves: number;
  is_active: boolean | null;
  created_at: string;
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      categories: Table<
        CategoryRow,
        { id?: string; name: string; slug: string; created_at?: string },
        { id?: string; name?: string; slug?: string; created_at?: string }
      >;
      products: Table<
        ProductRow,
        {
          id?: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          image_url?: string | null;
          base_price_usd: number;
          wholesale_price_usd?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          category_id?: string | null;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          base_price_usd?: number;
          wholesale_price_usd?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      product_variants: Table<
        VariantRow,
        {
          id?: string;
          product_id: string;
          sku: string;
          size: string;
          color: string;
          color_hex?: string | null;
          stock_quantity?: number;
          min_stock_alert?: number;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          product_id?: string;
          sku?: string;
          size?: string;
          color?: string;
          color_hex?: string | null;
          stock_quantity?: number;
          min_stock_alert?: number;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      inventory_logs: Table<
        InventoryLogRow,
        {
          id?: string;
          variant_id: string;
          user_id?: string | null;
          type: "ADDITION" | "ADJUSTMENT" | "SALE" | "RETURN";
          quantity_changed: number;
          previous_stock: number;
          new_stock: number;
          notes?: string | null;
          created_at?: string;
        },
        {
          variant_id?: string | null;
          user_id?: string | null;
          type?: "ADDITION" | "ADJUSTMENT" | "SALE" | "RETURN";
          quantity_changed?: number;
          previous_stock?: number;
          new_stock?: number;
          notes?: string | null;
          created_at?: string;
        }
      >;
      exchange_rates: Table<
        ExchangeRateRow,
        {
          id?: string;
          rate_ves: number;
          is_active?: boolean;
          created_at?: string;
        },
        {
          id?: string;
          rate_ves?: number;
          is_active?: boolean;
          created_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
