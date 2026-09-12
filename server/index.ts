import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  handleDashboard,
  handleLogin,
  handleLogout,
  handleOrderStatus,
  handleOrders,
  handleProductDelete,
  handleProductUpdate,
  handleProducts,
  handleReviewModeration,
  handleReviews,
  handleSession,
} from "./routes/admin";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.post("/api/admin/login", handleLogin);
  app.post("/api/admin/logout", handleLogout);
  app.get("/api/admin/session", handleSession);
  app.get("/api/admin/dashboard", handleDashboard);
  app.get("/api/admin/products", handleProducts);
  app.patch("/api/admin/products/:id", handleProductUpdate);
  app.delete("/api/admin/products/:id", handleProductDelete);
  app.get("/api/admin/orders", handleOrders);
  app.patch("/api/admin/orders/:id/status", handleOrderStatus);
  app.get("/api/admin/reviews", handleReviews);
  app.patch("/api/admin/reviews/:id", handleReviewModeration);

  return app;
}
