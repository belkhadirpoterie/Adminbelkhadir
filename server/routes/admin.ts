import crypto from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import type {
  AdminDashboardResponse,
  AdminSessionResponse,
  LoginPayload,
  Order,
  Product,
  ProductMutationPayload,
  Review,
} from "@shared/api";

const SESSION_COOKIE = "atelier_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const allowedOrderStatuses = ["en attente", "confirmée", "livrée", "annulée"];

type SupabaseRow = Record<string, unknown>;

function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function sessionSecret() {
  return process.env.ADMIN_PASSWORD ?? "atelier-belkhadir-session";
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function createSession(username: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${username}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${encode(payload)}.${signature}`;
}

function usernameFromToken(token: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  try {
    const payload = decode(encodedPayload);
    const expectedSignature = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
    const validSignature = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
    const [username, expiresAt] = payload.split(".");
    if (!validSignature || !username || Number(expiresAt) < Math.floor(Date.now() / 1000)) return null;
    return username === process.env.ADMIN_USERNAME ? username : null;
  } catch {
    return null;
  }
}

function sessionTokenFromRequest(req: Request) {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length);

  const cookie = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie?.slice(`${SESSION_COOKIE}=`.length) ?? null;
}

function authenticatedUsername(req: Request) {
  const token = sessionTokenFromRequest(req);
  return token ? usernameFromToken(token) : null;
}

function requireAdmin(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (!authenticatedUsername(req)) {
      res.status(401).json({ message: "Authentification requise" });
      return;
    }
    return handler(req, res, next);
  };
}

async function supabaseRequest<T extends SupabaseRow = SupabaseRow>(
  table: string,
  options: { method?: string; query?: string; body?: unknown } = {},
) {
  if (!isConfigured()) return [] as T[];
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/${table}`);
  if (options.query) new URLSearchParams(options.query).forEach((value, key) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase ${response.status}: ${message}`);
  }
  if (response.status === 204) return [] as T[];
  return (await response.json()) as T[];
}

function setSessionCookie(req: Request, res: Response, token: string) {
  const forwardedProtocol = req.headers["x-forwarded-proto"];
  const isHttps = req.protocol === "https" || forwardedProtocol === "https" || process.env.NODE_ENV === "production";
  const secure = isHttps ? "; Secure" : "";
  const sameSite = isHttps ? "None" : "Lax";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_MAX_AGE}; Path=/; HttpOnly; SameSite=${sameSite}${secure}`,
  );
}

export const handleLogin: RequestHandler = (req, res) => {
  const { username, password } = req.body as LoginPayload;
  const valid = Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) &&
    username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;

  if (!valid) {
    res.status(401).json({ message: "Identifiants invalides" });
    return;
  }

  const token = createSession(username);
  setSessionCookie(req, res, token);
  res.json({ authenticated: true, username, token });
};

export const handleLogout: RequestHandler = (req, res) => {
  const forwardedProtocol = req.headers["x-forwarded-proto"];
  const isHttps = req.protocol === "https" || forwardedProtocol === "https" || process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=${isHttps ? "None" : "Lax"}${isHttps ? "; Secure" : ""}`);
  res.json({ authenticated: false });
};

export const handleSession: RequestHandler = (req, res) => {
  const username = authenticatedUsername(req);
  const response: AdminSessionResponse = username
    ? { authenticated: true, username }
    : { authenticated: false };
  res.json(response);
};

export const handleDashboard = requireAdmin(async (_req, res) => {
  const response: AdminDashboardResponse = {
    configured: isConfigured(),
    products: [],
    orders: [],
    reviews: [],
    notifications: [],
    analyticsAvailable: false,
  };

  if (!isConfigured()) {
    res.json(response);
    return;
  }

  try {
    const [products, orders, reviews] = await Promise.all([
      supabaseRequest<Product>("products", { query: "select=*&order=created_at.desc&limit=8" }),
      supabaseRequest<Order>("orders", { query: "select=*&order=created_at.desc&limit=8" }),
      supabaseRequest<Review>("reviews", { query: "select=*&order=created_at.desc&limit=8" }),
    ]);
    response.products = products;
    response.orders = orders;
    response.reviews = reviews;
    response.notifications = orders.slice(0, 3).map((order) => ({ type: "new_order", order_id: order.id, created_at: order.created_at }));
    res.json(response);
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "Erreur Supabase" });
  }
});

export const handleProducts = requireAdmin(async (_req, res) => {
  if (!isConfigured()) {
    res.json([]);
    return;
  }
  try {
    const products = await supabaseRequest<Product>("products", { query: "select=*&order=created_at.desc" });
    const variants = await supabaseRequest("product_variants", { query: "select=*" });
    res.json(products.map((product) => ({ ...product, variants: variants.filter((variant) => variant.product_id === product.id) })));
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "Erreur Supabase" });
  }
});

export const handleProductUpdate = requireAdmin(async (req, res) => {
  if (!isConfigured()) {
    res.status(503).json({ message: "Supabase n'est pas configuré" });
    return;
  }
  const body = req.body as ProductMutationPayload;
  const product: Record<string, unknown> = {};
  for (const key of ["name", "description", "price", "stock", "colors", "patterns"]) {
    if (body[key as keyof ProductMutationPayload] !== undefined) product[key] = body[key as keyof ProductMutationPayload];
  }
  try {
    const result = await supabaseRequest(`products?id=eq.${encodeURIComponent(String(req.params.id))}`, { method: "PATCH", body: product });
    if (body.variants) {
      await supabaseRequest(`product_variants?product_id=eq.${encodeURIComponent(String(req.params.id))}`, { method: "DELETE" });
      if (body.variants.length) await supabaseRequest("product_variants", { method: "POST", body: body.variants.map((variant) => ({ ...variant, product_id: String(req.params.id) })) });
    }
    res.json(result[0] ?? {});
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "Erreur Supabase" });
  }
});

export const handleProductDelete = requireAdmin(async (req, res) => {
  if (!isConfigured()) {
    res.status(503).json({ message: "Supabase n'est pas configuré" });
    return;
  }
  try {
    await supabaseRequest(`products?id=eq.${encodeURIComponent(String(req.params.id))}`, { method: "DELETE" });
    res.json({ deleted: true });
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "Erreur Supabase" });
  }
});

export const handleOrders = requireAdmin(async (_req, res) => {
  if (!isConfigured()) {
    res.json([]);
    return;
  }
  try {
    res.json(await supabaseRequest("orders", { query: "select=*&order=created_at.desc" }));
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "Erreur Supabase" });
  }
});

export const handleOrderStatus = requireAdmin(async (req, res) => {
  if (!isConfigured()) {
    res.status(503).json({ message: "Supabase n'est pas configuré" });
    return;
  }
  const { status } = req.body as { status?: string };
  if (!status || !allowedOrderStatuses.includes(status)) {
    res.status(400).json({ message: "Statut de commande invalide" });
    return;
  }
  try {
    const result = await supabaseRequest(`orders?id=eq.${encodeURIComponent(String(req.params.id))}`, {
      method: "PATCH",
      body: { status },
    });
    res.json(result[0] ?? {});
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "Erreur Supabase" });
  }
});

export const handleReviews = requireAdmin(async (_req, res) => {
  if (!isConfigured()) {
    res.json([]);
    return;
  }
  try {
    res.json(await supabaseRequest("reviews", { query: "select=*&order=created_at.desc" }));
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "Erreur Supabase" });
  }
});

export const handleReviewModeration = requireAdmin(async (req, res) => {
  if (!isConfigured()) {
    res.status(503).json({ message: "Supabase n'est pas configuré" });
    return;
  }
  const { action } = req.body as { action?: "approve" | "reject" | "delete" };
  try {
    if (action === "delete") {
      await supabaseRequest(`reviews?id=eq.${encodeURIComponent(String(req.params.id))}`, { method: "DELETE" });
      res.json({ deleted: true });
      return;
    }
    if (action !== "approve" && action !== "reject") {
      res.status(400).json({ message: "Action de modération invalide" });
      return;
    }
    const result = await supabaseRequest(`reviews?id=eq.${encodeURIComponent(String(req.params.id))}`, {
      method: "PATCH",
      body: { is_approved: action === "approve" },
    });
    res.json(result[0] ?? {});
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "Erreur Supabase" });
  }
});
