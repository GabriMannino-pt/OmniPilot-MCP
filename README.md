# 🚀 OmniPilot-MCP

> **Autonomous Cross-Platform Executive Agent for Browser & Desktop Operations via Model Context Protocol (MCP)**

[![CI Pipeline](https://github.com/GabriMannino-pt/OmniPilot-MCP/actions/workflows/ci.yml/badge.svg)](https://github.com/GabriMannino-pt/OmniPilot-MCP/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green?logo=node.js)](https://nodejs.org/)
[![Protocol](https://img.shields.io/badge/MCP-2024--11--05-orange)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 💡 Overview

**OmniPilot-MCP** is a state-of-the-art Computer-Use and GUI Automation executive agent designed to bridge Large Language Models (LLMs) with web applications and OS environments using the **Model Context Protocol (MCP)** standard.

It features:
- 👁️ **Dual-Perception Engine:** Hybrid accessibility DOM inspection + visual screen coordinates.
- 🛡️ **3-Tier Risk Engine:** Deterministic pre-execution safety classifier (Tier 1 Safe Read-Only, Tier 2 Recoverable, Tier 3 Critical/Irreversible).
- 🛑 **Human-in-the-Loop (HITL) Guardrails:** Suspends critical executions (payments, deletions, email dispatch) until visual human confirmation is provided.
- ⚡ **Strict JSON-RPC 2.0 Compliance:** Standard Model Context Protocol SDK implementation compatible with Claude Desktop, Cursor, and custom MCP clients.

---

## 🛠️ MCP Tool Catalog (`tools/list`)

| Tool Name | Parameters | Risk Tier | Description |
| :--- | :--- | :--- | :--- |
| `omnipilot_take_screenshot` | `target: 'browser' \| 'desktop'`, `format: 'base64'` | **Tier 1 (Safe)** | Captures active display or browser canvas with reference coordinates. |
| `omnipilot_inspect_dom` | `selector?: string`, `includeAccessibility: boolean` | **Tier 1 (Safe)** | Extracts semantic ARIA accessibility tree and interactive DOM elements. |
| `omnipilot_click_element` | `selector: string`, `waitForNavigation?: boolean` | **Tier 2 / Tier 3** | Clicks a DOM element deterministically; escalates to Tier 3 if selector matches critical actions. |
| `omnipilot_click_coordinate` | `x: number`, `y: number`, `button: 'left' \| 'right'` | **Tier 2 (Low Risk)**| Dispatches hardware-level cursor clicks at canvas/screen coordinates. |
| `omnipilot_type_text` | `text: string`, `selector?: string`, `isSecret?: boolean` | **Tier 2 / Tier 3** | Types keystrokes or fills form controls; escalates to Tier 3 for credentials. |
| `omnipilot_request_approval` | `actionSummary: string`, `tier: 3`, `boundingBox?: Rect` | **Tier 3 (Critical)**| Guardrail suspending execution for explicit human authorization. |

---

## 📦 Getting Started

### Prerequisites
- Node.js `v20.0.0` or higher
- npm `v10.0.0` or higher

### Installation

```bash
git clone https://github.com/GabriMannino-pt/OmniPilot-MCP.git
cd OmniPilot-MCP
npm install
```

### Build & Test

```bash
# Compile TypeScript to dist/
npm run build

# Run unit tests with Vitest
npm test

# Run interactive CLI showcase runner
npm run cli
```

### Run MCP Server (Stdio)

```bash
npm start
```

### Configure Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "omnipilot": {
      "command": "node",
      "args": ["D:/omnipilot-mcp/dist/index.js"]
    }
  }
}
```

---

## 🏛️ Project Architecture

```text
d:/omnipilot-mcp/
├── .github/workflows/ci.yml     # Continuous Integration pipeline
├── docker/                      # Multi-stage Docker packaging
├── src/
│   ├── mcp/
│   │   ├── mcpServer.ts         # Core JSON-RPC 2.0 MCP Server
│   │   ├── schemas.ts           # Zod schema definitions
│   │   └── handlers/            # Tools, resources, and prompt handlers
│   ├── perception/
│   │   ├── domEngine.ts         # ARIA and DOM accessibility parser
│   │   ├── visionEngine.ts      # Screenshotting & coordinate mapper
│   │   └── dualPerception.ts    # Hybrid Dual-Perception aggregator
│   ├── execution/
│   │   ├── browserDriver.ts     # Browser driver & Playwright interface
│   │   └── desktopDriver.ts     # OS display and mouse driver
│   ├── safety/
│   │   ├── riskEngine.ts        # 3-Tier safety risk classifier
│   │   └── approvalGate.ts      # Event-driven HITL guardrail
│   ├── cli.ts                   # E2E CLI showcase runner
│   └── index.ts                 # Stdio MCP entrypoint
├── tests/
│   └── unit/                    # Vitest unit test suite
├── package.json
└── tsconfig.json
```

---

## 📋 Implementation Phasing Status

- [x] **Fase 1 (Scaffolding & Core MCP):** Repository setup, TypeScript strict mode, Zod schemas, MCP JSON-RPC 2.0 server, 3-Tier Risk Engine, HITL approval gate, unit tests, CI pipeline.
- [ ] **Fase 2 (Dual-Perception Engine):** Live Playwright integration with ARIA accessibility snapshot parser and visual screenshot coordinate mapper.
- [ ] **Fase 3 (Tiered Risk Engine & HITL):** Deep guardrails with visual bounding box overlay and interactive CLI/Dashboard approval.
- [ ] **Fase 4 (Showcase CLI & Test Suite):** Full end-to-end simulated workflow (report generation and order draft).
- [ ] **Fase 5 (Web Control Dashboard):** React 19 + Vite real-time visual canvas and approval cockpit.
- [ ] **Fase 6 (Release & Showcase):** Documentation, benchmark comparisons, and deployment artifacts.
