# 🚀 OmniPilot-MCP — Release Notes v0.1.0

**Release Tag:** `v0.1.0`  
**Date:** October 20, 2026  
**Author:** Gabriele Mannino  

---

## 🌟 Highlights of v0.1.0

OmniPilot-MCP v0.1.0 is the foundational release of the autonomous cross-platform executive agent built on top of the **Model Context Protocol (MCP)** specification `2024-11-05`.

### 1. Dual-Perception Engine (Vision + DOM)
- Headless Chromium browser automation via Playwright with ARIA accessibility snapshots (`page.locator().ariaSnapshot()`).
- Lossless PNG screenshotting and center coordinate calculations for all interactive elements.
- Visual grounding engine powered by `sharp` with SVG dynamic overlays for highlighted bounding boxes.

### 2. Deterministic 3-Tier Risk Engine
- **Tier 1 (Safe - Read Only):** Latency zero, unconstrained read execution (`omnipilot_take_screenshot`, `omnipilot_inspect_dom`).
- **Tier 2 (Low Risk):** Mutating recoverable operations with structured audit logging (`omnipilot_type_text`, safe clicks).
- **Tier 3 (Critical / Irreversible):** Automatic keyword intent classification (`delete`, `pay`, `bonifico`, `invia`, secret credential fields). Suspends execution and requires human confirmation.

### 3. Human-in-the-Loop (HITL) Guardrail
- Event-driven `ApprovalGate` emitting requests with visual coordinates and action summaries.
- Automatic red bounding box overlay generated on target button for visual human verification.
- Interactive terminal CLI prompt + Web Dashboard real-time approval cockpit.

### 4. Web Control Dashboard (React 19 + Vite)
- Real-time visual canvas with toggleable ARIA element annotations.
- Floating HITL approval modal with one-click `[Conferma Esecuzione]` and `[Annulla]` buttons.
- Filterable audit trail table tracking all operations by tier, duration, and status.

### 5. Reproducible E2E Procurement Demo (`npm run demo`)
- Autonomous end-to-end workflow: ERP supplier invoice table extraction, payment notice email draft generation, and HITL-guarded wire transfer dispatch.

---

## 🧪 Verification Metrics
- **Test Files:** 6 passed (100%)
- **Total Tests:** 32 passed (100%)
- **TypeScript:** Strict Mode with 0 warnings/errors
- **Supported Runtimes:** Node.js 20.x, 22.x (Linux, Windows, macOS)
