import { Router } from "express";
import { requireAdmin } from "../middleware/adminAuth.js";
import {
  getPostVisits,
  getPostVisitCount,
  getPostVisitHourlyBreakdown,
  isPgConfigured,
} from "../repositories/analytics.repository.js";
import { getAllPostStatsHandler } from "./analytics.js";
import { createLogger } from "../lib/logger.js";

const router = Router();
const logger = createLogger("admin-analytics");
const DEFAULT_VISIT_LIMIT = 100;
const MAX_VISIT_LIMIT = 200;
const MAX_VISIT_OFFSET = 100_000;

router.use(requireAdmin);

const requirePg = (req, res, next) => {
  if (!isPgConfigured()) {
    return res
      .status(503)
      .json({ ok: false, error: "Not configured (DATABASE_URL missing)" });
  }
  next();
};

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseBoundedInteger(value, { defaultValue, min, max }) {
  const raw = firstQueryValue(value);
  if (raw === undefined || raw === null || raw === "") return defaultValue;

  const text = String(raw).trim();
  if (!/^-?\d+$/.test(text)) return defaultValue;

  const parsed = Number.parseInt(text, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}

export function parseVisitPagination(query = {}) {
  return {
    limit: parseBoundedInteger(query.limit, {
      defaultValue: DEFAULT_VISIT_LIMIT,
      min: 1,
      max: MAX_VISIT_LIMIT,
    }),
    offset: parseBoundedInteger(query.offset, {
      defaultValue: 0,
      min: 0,
      max: MAX_VISIT_OFFSET,
    }),
  };
}

router.get("/posts", requirePg, getAllPostStatsHandler);

router.get(
  "/posts/:year/:slug/visits",
  requirePg,
  async (req, res, next) => {
    try {
      const { year, slug } = req.params;
      const { limit, offset } = parseVisitPagination(req.query);
      const [visits, total] = await Promise.all([
        getPostVisits({ slug, year, limit, offset }),
        getPostVisitCount(slug, year),
      ]);
      return res.json({ ok: true, data: { visits, total, limit, offset } });
    } catch (err) {
      logger.error({}, "Failed to get post visits", { error: err.message });
      return next(err);
    }
  },
);

router.get(
  "/posts/:year/:slug/metrics",
  requirePg,
  async (req, res, next) => {
    try {
      const { year, slug } = req.params;
      const [total, hourly] = await Promise.all([
        getPostVisitCount(slug, year),
        getPostVisitHourlyBreakdown(slug, year),
      ]);
      return res.json({ ok: true, data: { total, hourly } });
    } catch (err) {
      logger.error({}, "Failed to get post metrics", { error: err.message });
      return next(err);
    }
  },
);

export default router;
