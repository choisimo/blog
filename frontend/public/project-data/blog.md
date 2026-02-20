---
id: blog
title: "Blog Platform"
description: "Edge Computing 기반 풀스택 블로그 플랫폼. Cloudflare Workers + D1 + R2, React SPA, Node.js 백엔드, AI/RAG 서비스, CI/CD 자동화까지 포함한 프로덕션 수준 아키텍처."
date: 2026-02-19
category: "Fullstack"
tags: ["Fullstack", "Edge Computing", "AI", "CI/CD"]
stack: ["React", "TypeScript", "Cloudflare Workers", "Hono", "Node.js", "D1", "R2"]
status: "Live"
type: "link"
url: "https://github.com/choisimo/blog"
codeUrl: "https://github.com/choisimo/blog"
featured: true
published: true
---

# Blog Platform

풀스택 개인 블로그 플랫폼. Cloudflare Workers 기반 Edge Computing 아키텍처로 글로벌 저지연 서비스를 제공합니다.

- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Edge Layer: Cloudflare Workers + Hono + D1(SQLite) + R2(스토리지) + KV(캐시)
- Backend: Node.js + Express + AI/RAG 서비스
- CI/CD: GitHub Actions 자동 배포
