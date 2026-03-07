import { Router } from "express";
import {
  generatePdf,
  generateDocx,
  sanitizeExportFilename,
} from "../services/document-generation.service.js";

const router = Router();
const SUPPORTED_FORMATS = new Set(["pdf", "docx"]);

router.post("/generate", async (req, res, next) => {
  try {
    const body = req.body || {};
    const title = typeof body.title === "string" ? body.title : "document";
    const content = typeof body.content === "string" ? body.content : "";
    const format = typeof body.format === "string" ? body.format.toLowerCase() : "docx";
    const customCss = typeof body.customCss === "string" ? body.customCss : "";

    if (!content.trim()) {
      return res.status(400).json({ error: "content is required" });
    }
    if (!SUPPORTED_FORMATS.has(format)) {
      return res.status(400).json({ error: "format must be one of: pdf, docx" });
    }

    const safeFilename = sanitizeExportFilename(title);

    if (format === "pdf") {
      const bytes = await generatePdf({ title, content, customCss });
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}.pdf"`);
      res.type("application/pdf");
      return res.send(bytes);
    }

    const bytes = await generateDocx({ title, content, customCss });
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}.docx"`);
    res.type("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    return res.send(bytes);
  } catch (err) {
    if (err?.code === "PDF_CHROMIUM_NOT_FOUND") {
      return res.status(503).json({ error: err.message });
    }
    return next(err);
  }
});

export default router;
