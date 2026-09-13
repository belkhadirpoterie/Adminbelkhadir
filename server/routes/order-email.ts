import nodemailer from "nodemailer";
import type { Order } from "@shared/api";

const statusCopy: Record<string, string> = {
  "en attente": "Commande reçue, en attente de traitement",
  "confirmée": "Commande confirmée, en cours de préparation",
  "façonnage": "Façonnage en cours",
  "préparation couleurs": "Préparation des couleurs",
  "réalisation motifs": "Réalisation des motifs",
  "finitions": "Finitions en cours",
  "prête/livraison": "Commande prête — livraison sous 5 jours",
  "livrée": "Commande livrée",
  "annulée": "Commande annulée",
};

type Row = Record<string, unknown>;

function configured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM_EMAIL);
}

export type OrderEmailResult = {
  sent: boolean;
  skipped: boolean;
  reason?: "smtp_not_configured" | "recipient_missing";
};

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

async function supabaseRows(table: string, query: string) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return (await response.json()) as Row[];
}

function orderItems(order: Row) {
  return Array.isArray(order.articles) ? order.articles as Array<{ product_id?: string | number; variant_id?: string | number; quantity?: number; price?: number }> : [];
}

export async function sendOrderStatusEmail(orderId: string | number, status: string): Promise<OrderEmailResult> {
  if (!configured()) return { sent: false, skipped: true, reason: "smtp_not_configured" };
  const orders = await supabaseRows("orders", `select=*&id=eq.${encodeURIComponent(String(orderId))}&limit=1`);
  const order = orders[0] as (Order & Row) | undefined;
  if (!order?.user_id) return { sent: false, skipped: true, reason: "recipient_missing" };
  const profiles = await supabaseRows("profiles", `select=*&id=eq.${encodeURIComponent(String(order.user_id))}&limit=1`);
  const profile = profiles[0];
  if (typeof profile?.email !== "string" || !profile.email.trim()) return { sent: false, skipped: true, reason: "recipient_missing" };
  const items = orderItems(order);
  const products = await supabaseRows("products", "select=id,name");
  const productNames = new Map(products.map((product) => [String(product.id), String(product.name ?? "Article")]))
  const total = typeof order.total_price === "number" ? `${order.total_price.toFixed(2).replace(".", ",")} €` : "—";
  const lines = items.map((item) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e4eae3">${escapeHtml(productNames.get(String(item.product_id)) ?? "Article")}</td><td style="padding:10px 0;border-bottom:1px solid #e4eae3;text-align:center">${escapeHtml(item.quantity ?? 1)}</td><td style="padding:10px 0;border-bottom:1px solid #e4eae3;text-align:right">${typeof item.price === "number" ? `${item.price.toFixed(2).replace(".", ",")} €` : "—"}</td></tr>`).join("");
  const title = statusCopy[status] ?? `Mise à jour de votre commande : ${status}`;
  const contact = `mailto:${encodeURIComponent(process.env.SMTP_FROM_EMAIL!)}`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f2eb;color:#18352b;font-family:Arial,sans-serif"><main style="max-width:620px;margin:0 auto;padding:32px 20px"><section style="background:#16543e;color:#f4e9d3;padding:28px;border-radius:18px 18px 0 0"><div style="font-size:12px;letter-spacing:3px;font-weight:bold">AB</div><h1 style="font-family:Georgia,serif;font-size:28px;margin:18px 0 0">Atelier Belkhadir Poterie</h1></section><section style="background:#fbfcf9;padding:32px;border-radius:0 0 18px 18px"><p style="font-size:16px">Bonjour ${escapeHtml(profile.prénom)} ${escapeHtml(profile.nom)},</p><h2 style="font-family:Georgia,serif;font-size:24px;color:#16543e">${escapeHtml(title)}</h2><p style="color:#63756b;line-height:1.6">Votre commande <strong>#${escapeHtml(order.id)}</strong> est actuellement au statut :</p><div style="display:inline-block;background:#e5f0e7;color:#16543e;padding:12px 16px;border-radius:10px;font-weight:bold">${escapeHtml(status)}</div><h3 style="margin-top:30px;color:#365347">Récapitulatif</h3><table style="width:100%;border-collapse:collapse;color:#52665a"><thead><tr><th style="text-align:left;padding:10px 0;border-bottom:2px solid #dfe6dd">Article</th><th style="padding:10px 0;border-bottom:2px solid #dfe6dd">Qté</th><th style="text-align:right;padding:10px 0;border-bottom:2px solid #dfe6dd">Prix</th></tr></thead><tbody>${lines}</tbody></table><p style="text-align:right;font-size:18px;font-weight:bold;color:#a17745">Total : ${total}</p><p style="margin-top:28px;color:#63756b;line-height:1.6">Vos informations sont incorrectes ? <a href="${contact}" style="color:#16543e;font-weight:bold">Contactez-nous</a>.</p></section></main></body></html>`;
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  await transport.sendMail({ from: process.env.SMTP_FROM_EMAIL, to: profile.email as string, subject: `Atelier Belkhadir — ${title}`, html });
  return { sent: true, skipped: false };
}

export function orderStatusLabel(status: string) {
  return statusCopy[status] ?? status;
}
