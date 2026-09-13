import crypto from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { sendOrderStatusEmail } from "./order-email";
import type {
  AdminDashboardResponse,
  AdminSessionResponse,
  LoginPayload,
  Order,
  Product,
  ProductCreatePayload,
  ProductPattern,
  ProductMutationPayload,
  Review,
} from "@shared/api";

const SESSION_COOKIE = "atelier_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const allowedOrderStatuses = ["en attente", "confirmée", "façonnage", "préparation couleurs", "réalisation motifs", "finitions", "prête/livraison", "livrée", "annulée"];

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

async function optionalSupabaseRequest<T extends SupabaseRow = SupabaseRow>(table: string, options: { method?: string; query?: string; body?: unknown } = {}) {
  try {
    return await supabaseRequest<T>(table, options);
  } catch {
    return [] as T[];
  }
}

async function uploadImage(data: string, fileName: string, folder: string) {
  const match = data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Format d'image invalide");
  const [, contentType, encoded] = match;
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("Image trop volumineuse (8 Mo maximum)");
  const bucket = "atelier-products";
  const storageHeaders = { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, "Content-Type": "application/json" };
  const bucketResponse = await fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket`, { method: "POST", headers: storageHeaders, body: JSON.stringify({ id: bucket, name: bucket, public: true }) });
  if (!bucketResponse.ok && bucketResponse.status !== 409) throw new Error("Le bucket de stockage Supabase est indisponible");
  const extension = fileName.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || contentType.split("/")[1].replace(/[^a-z0-9]/gi, "");
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const uploadResponse = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, { method: "POST", headers: { Authorization: storageHeaders.Authorization, apikey: storageHeaders.apikey, "Content-Type": contentType, "x-upsert": "false" }, body: buffer });
  if (!uploadResponse.ok) throw new Error("Le téléversement de l'image a échoué");
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function resolveImage(image: { image_url?: string; data?: string; file_name?: string }, folder: string) {
  if (image.data) return uploadImage(image.data, image.file_name ?? "image", folder);
  if (image.image_url) return image.image_url;
  throw new Error("Image manquante");
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
    const normalizedOrders = orders.map(normalizeOrder);
    response.products = products;
    response.orders = normalizedOrders;
    response.reviews = reviews;
    response.notifications = normalizedOrders.slice(0, 3).map((order) => ({ type: "new_order", order_id: order.id, created_at: order.created_at }));
    res.json(response);
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "Erreur Supabase" });
  }
});

function normalizeOrder(row: Order): Order {
  const firstName = row["prénom"];
  const lastName = row.nom;
  const customerName = row.customer_name ?? [firstName, lastName].filter(Boolean).join(" ");
  return {
    ...row,
    id: String(row.id),
    customer_name: customerName || null,
    total: typeof row.total_price === "number" ? row.total_price : row.total,
  };
}

async function hydrateProducts(products: Product[]) {
  const [variants, images, colors, relations, patterns] = await Promise.all([
    optionalSupabaseRequest("product_variants", { query: "select=*" }),
    optionalSupabaseRequest("product_images", { query: "select=*&order=position.asc" }),
    optionalSupabaseRequest("product_available_colors", { query: "select=*" }),
    optionalSupabaseRequest("product_available_patterns", { query: "select=*" }),
    optionalSupabaseRequest<ProductPattern>("product_patterns", { query: "select=*" }),
  ]);
  return products.map((product) => {
    const productRelations = relations.filter((relation) => String(relation.product_id) === String(product.id));
    const patternIds = productRelations.map((relation) => String(relation.pattern_id));
    return {
      ...product,
      variants: variants.filter((variant) => String(variant.product_id) === String(product.id)),
      images: images.filter((image) => String(image.product_id) === String(product.id)),
      colors: colors.filter((color) => String(color.product_id) === String(product.id)).map((color) => String(color.color)),
      patterns: patterns.filter((pattern) => patternIds.includes(String(pattern.id))),
    };
  });
}

export const handleProducts = requireAdmin(async (_req, res) => {
  if (!isConfigured()) {
    res.json([]);
    return;
  }
  try {
    const products = await supabaseRequest<Product>("products", { query: "select=*&order=created_at.desc" });
    res.json(await hydrateProducts(products));
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "Erreur Supabase" });
  }
});

export const handleProductDetail = requireAdmin(async (req, res) => {
  if (!isConfigured()) {
    res.status(503).json({ message: "Supabase n'est pas configuré" });
    return;
  }
  try {
    const products = await supabaseRequest<Product>(`products?id=eq.${encodeURIComponent(String(req.params.id))}&limit=1`);
    if (!products[0]) {
      res.status(404).json({ message: "Produit introuvable" });
      return;
    }
    res.json((await hydrateProducts(products))[0]);
  } catch (error) {
    res.status(502).json({ message: error instanceof Error ? error.message : "Erreur Supabase" });
  }
});

export const handleProductCreate = requireAdmin(async (req, res) => {
  if (!isConfigured()) {
    res.status(503).json({ message: "Supabase n'est pas configuré" });
    return;
  }
  const body = req.body as ProductCreatePayload;
  if (!body.name?.trim()) {
    res.status(400).json({ message: "Le nom du produit est requis" });
    return;
  }
  try {
    await supabaseRequest("product_images", { query: "select=id&limit=0" });
    await supabaseRequest("product_available_colors", { query: "select=product_id&limit=0" });
    const images = await Promise.all((body.images ?? []).map((image) => resolveImage(image, "gallery")));
    const patternsWithImages = await Promise.all((body.patterns ?? []).map(async (pattern) => ({
      id: pattern.id ?? crypto.randomUUID(),
      name: pattern.name,
      thumbnail_url: pattern.data ? await uploadImage(pattern.data, pattern.file_name ?? "pattern", "patterns") : pattern.thumbnail_url ?? null,
      description: pattern.description ?? null,
    })));
    const productRows = await supabaseRequest<Product>("products", {
      method: "POST",
      body: {
        name: body.name.trim(),
        description: body.description ?? "",
        base_price: body.base_price ?? 0,
        category: body.category ?? null,
        image_url: images[0] ?? null,
      },
    });
    const product = productRows[0];
    if (!product) throw new Error("Produit non créé");
    if (body.variants?.length) await supabaseRequest("product_variants", { method: "POST", body: body.variants.map((variant) => ({ product_id: product.id, size_label: variant.size_label, dimensions: variant.dimensions ?? null, price: variant.price })) });
    if (images.length) await supabaseRequest("product_images", { method: "POST", body: images.map((image_url, position) => ({ product_id: product.id, image_url, position })) });
    if (body.colors?.length) await supabaseRequest("product_available_colors", { method: "POST", body: body.colors.map((color) => ({ product_id: product.id, color })) });
    if (patternsWithImages.length) {
      const patterns = await supabaseRequest<ProductPattern>("product_patterns", { method: "POST", body: patternsWithImages });
      await supabaseRequest("product_available_patterns", { method: "POST", body: patterns.map((pattern) => ({ product_id: product.id, pattern_id: pattern.id })) });
    }
    res.status(201).json((await hydrateProducts([product]))[0]);
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
  for (const key of ["name", "description", "base_price", "image_url"]) {
    if (body[key as keyof ProductMutationPayload] !== undefined) product[key] = body[key as keyof ProductMutationPayload];
  }
  if (body.price !== undefined) product.base_price = body.price;
  try {
    const result = await supabaseRequest<Product>(`products?id=eq.${encodeURIComponent(String(req.params.id))}`, { method: "PATCH", body: product });
    if (body.variants) {
      await supabaseRequest(`product_variants?product_id=eq.${encodeURIComponent(String(req.params.id))}`, { method: "DELETE" });
      if (body.variants.length) await supabaseRequest("product_variants", { method: "POST", body: body.variants.map((variant) => ({ product_id: String(req.params.id), size_label: variant.size_label ?? variant.size ?? "", dimensions: variant.dimensions ?? null, price: variant.price ?? 0 })) });
    }
    if (body.images) {
      await supabaseRequest(`product_images?product_id=eq.${encodeURIComponent(String(req.params.id))}`, { method: "DELETE" });
      if (body.images.length) await supabaseRequest("product_images", { method: "POST", body: body.images.map((image, position) => ({ product_id: String(req.params.id), image_url: image.image_url, position: image.position ?? position })) });
    }
    if (body.colors) {
      await supabaseRequest(`product_available_colors?product_id=eq.${encodeURIComponent(String(req.params.id))}`, { method: "DELETE" });
      if (body.colors.length) await supabaseRequest("product_available_colors", { method: "POST", body: body.colors.map((color) => ({ product_id: String(req.params.id), color })) });
    }
    if (body.patterns) {
      await supabaseRequest(`product_available_patterns?product_id=eq.${encodeURIComponent(String(req.params.id))}`, { method: "DELETE" });
      if (body.patterns.length) await supabaseRequest("product_available_patterns", { method: "POST", body: body.patterns.map((pattern) => ({ product_id: String(req.params.id), pattern_id: pattern })) });
    }
    res.json((await hydrateProducts(result[0] ? [result[0]] : []))[0] ?? {});
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
    const productId = encodeURIComponent(String(req.params.id));
    await supabaseRequest(`product_available_patterns?product_id=eq.${productId}`, { method: "DELETE" });
    await supabaseRequest(`product_variants?product_id=eq.${productId}`, { method: "DELETE" });
    await supabaseRequest(`product_images?product_id=eq.${productId}`, { method: "DELETE" });
    await supabaseRequest(`product_available_colors?product_id=eq.${productId}`, { method: "DELETE" });
    await supabaseRequest(`products?id=eq.${productId}`, { method: "DELETE" });
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
    const orders = await supabaseRequest<Order>("orders", { query: "select=*&order=created_at.desc" });
    res.json(orders.map(normalizeOrder));
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
    let email = { sent: false, skipped: true };
    try {
      email = await sendOrderStatusEmail(String(req.params.id), status);
    } catch (emailError) {
      console.error("Order status email failed", emailError);
    }
    res.json({ ...(result[0] ?? {}), email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur Supabase";
    if (message.includes("orders_status_check")) {
      res.status(409).json({
        message: "Les étapes de fabrication ne sont pas encore activées dans Supabase. Appliquez la migration 20260918000001_order_status_cycle.sql avant de choisir ce statut.",
      });
      return;
    }
    res.status(502).json({ message });
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
