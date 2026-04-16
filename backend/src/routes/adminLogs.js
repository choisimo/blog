import { Router } from "express";
import { requireAdmin } from "../middleware/adminAuth.js";
import { logEmitter } from "../lib/logger.js";
import {
  getServerLogs,
  isPgConfigured,
} from "../repositories/analytics.repository.js";
import { createLogger } from "../lib/logger.js";

const router = Router();
const logger = createLogger("admin-logs");

router.use((req, res, next) => {
  if (req.path === "/stream" && !req.headers.authorization) {
    const token =
      typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (token) {
      req.headers.authorization = `Bearer ${token}`;
    }
  }
  next();
});

router.use(requireAdmin);

const requirePg = (req, res, next) => {
  if (!isPgConfigured()) {
    return res
      .status(503)
      .json({ ok: false, error: "Not configured (DATABASE_URL missing)" });
  }
  next();
};

router.get("/", requirePg, async (req, res, next) => {
  try {
    const { level, service, limit, offset, since } = req.query;
    const logs = await getServerLogs({
      level: level || undefined,
      service: service || undefined,
      limit: limit ? parseInt(limit, 10) : 200,
      offset: offset ? parseInt(offset, 10) : 0,
      since: since || undefined,
    });
    return res.json({ ok: true, data: { logs } });
  } catch (err) {
    logger.error({}, "Failed to get logs", { error: err.message });
    return next(err);
  }
});

router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write('data: {"type":"connected"}\n\n');

  const send = (entry) => {
    try {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    } catch {}
  };

  logEmitter.on("log", send);

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on("close", () => {
    logEmitter.off("log", send);
    clearInterval(heartbeat);
  });
});

export default router;
