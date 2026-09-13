export interface DemoResponse {
  message: string;
}

export interface ProductImage {
  id?: string | number;
  product_id?: string | number;
  image_url: string;
  position?: number;
  [key: string]: unknown;
}

export interface ProductPattern {
  id: string;
  name: string;
  colors?: unknown;
  primary_color?: string | null;
  thumbnail_url?: string | null;
  description?: string | null;
  [key: string]: unknown;
}

export interface Product {
  id: string | number;
  name: string;
  description?: string | null;
  price?: number | null;
  base_price?: number | null;
  stock?: number | null;
  image_url?: string | null;
  colors?: string[];
  patterns?: ProductPattern[];
  pattern_catalog?: ProductPattern[];
  images?: ProductImage[];
  variants?: ProductVariant[];
  [key: string]: unknown;
}

export interface ProductVariant {
  id: string | number;
  product_id?: string | number;
  size?: string | null;
  size_label?: string | null;
  dimensions?: string | null;
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
  base_price?: number;
  price?: number;
  stock?: number;
  image_url?: string;
  colors?: string[];
  patterns?: string[];
  variants?: Array<Partial<ProductVariant>>;
  images?: Array<Partial<ProductImage>>;
}

export interface ProductCreatePayload {
  name: string;
  description?: string;
  base_price?: number;
  category?: string;
  images: Array<{ image_url?: string; data?: string; file_name?: string; position: number }>;
  colors: string[];
  variants: Array<{ size_label: string; dimensions?: string; price: number }>;
  patterns: Array<{ id?: string; name: string; thumbnail_url?: string; data?: string; file_name?: string; description?: string }>;
}

export interface LoginPayload {
  username: string;
  password: string;
}
