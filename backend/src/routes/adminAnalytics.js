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

router.use(requireAdmin);

const requirePg = (req, res, next) => {
  if (!isPgConfigured()) {
    return res
      .status(503)
      .json({ ok: false, error: "Not configured (DATABASE_URL missing)" });
  }
  next();
};

router.get("/posts", requirePg, getAllPostStatsHandler);

router.get(
  "/posts/:year/:slug/visits",
  requirePg,
  async (req, res, next) => {
    try {
      const { year, slug } = req.params;
      const limit = parseInt(req.query.limit, 10) || 100;
      const offset = parseInt(req.query.offset, 10) || 0;
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
