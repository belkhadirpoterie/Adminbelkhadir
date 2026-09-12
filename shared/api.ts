export interface DemoResponse {
  message: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  stock?: number | null;
  colors?: string[];
  patterns?: string[];
  variants?: ProductVariant[];
  [key: string]: unknown;
}

export interface ProductVariant {
  id: string;
  product_id?: string;
  size?: string | null;
  price?: number | null;
  stock?: number | null;
  [key: string]: unknown;
}

export interface Order {
  id: string;
  status?: string | null;
  total?: number | null;
  customer_name?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface Review {
  id: string;
  is_approved?: boolean | null;
  rating?: number | null;
  comment?: string | null;
  author_name?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface AdminDashboardResponse {
  configured: boolean;
  products: Product[];
  orders: Order[];
  reviews: Review[];
  notifications: unknown[];
  analyticsAvailable: boolean;
}

export interface AdminSessionResponse {
  authenticated: boolean;
  username?: string;
  token?: string;
}

export interface ProductMutationPayload {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  colors?: string[];
  patterns?: string[];
  variants?: Array<Partial<ProductVariant>>;
}

export interface LoginPayload {
  username: string;
  password: string;
}
