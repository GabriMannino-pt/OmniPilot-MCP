# 🚀 OmniPilot-MCP — Global Community Launch Pack

> **Flagship Open Source Project:** [https://github.com/GabriMannino-pt/OmniPilot-MCP](https://github.com/GabriMannino-pt/OmniPilot-MCP)  
> **Showcase Visual Asset:** [`screenshots/omnipilot-firewall-showcase.png`](https://raw.githubusercontent.com/GabriMannino-pt/OmniPilot-MCP/main/screenshots/omnipilot-firewall-showcase.png)  
> **Status:** v0.2.0 (Active Building-in-Public / Production-Grade Architecture)

---

## 1. 🟠 Hacker News — Show HN Submission

### Submission Details:
* **Title:** `Show HN: OmniPilot – Pre-execution visual firewall for LLM computer-use (MCP)`
* **URL:** `https://github.com/GabriMannino-pt/OmniPilot-MCP`
* **Text (First Comment / Post Body if Ask/Show HN text):**

```markdown
Hi HN,

I built OmniPilot-MCP (https://github.com/GabriMannino-pt/OmniPilot-MCP) to address an elephant in the room with autonomous computer-use agents: LLMs are probabilistic, but OS and browser actions are deterministic and often irreversible.

When an agent is tasked with browser or desktop workflows (e.g. ERP reconciliation, form filing, customer ops), an off-by-a-few-pixels hallucination or an indirect prompt injection shouldn't result in clicking "Send Wire Transfer" or "Delete Cluster" instead of "Save Draft".

Rather than relying on prompt-level constraints or post-execution undo logs, OmniPilot implements a deterministic Pre-Execution Visual Firewall:

1. Dual-Perception Grounding: Combines Playwright's ARIA accessibility snapshot with Set-of-Mark (SoM) visual coordinates. Elements receive numeric visual overlays `[1, 2, 3...]` mapped back to DOM locators, eliminating raw coordinate guesswork.
2. 3-Tier Risk Engine:
   - Tier 1 (Read-only): Inspection, DOM extraction, and screenshots run at zero latency.
   - Tier 2 (Mutations): Low-risk form fills and navigation are tracked in a SHA-256 tamper-evident audit chain.
   - Tier 3 (Irreversible): Actions classified as high-risk (payments, destructive deletes, external messaging, credential access) trigger an immediate physical pause.
3. Visual Bounding-Box & Human-in-the-Loop: On Tier 3, the agent halts, paints a high-visibility red bounding frame around the target element directly on the screen, and requires explicit 1-click human verification via a local embedded React cockpit before the event is dispatched.
4. Anti-TOCTOU & Security Defenses: Includes pre-hover DOM-mutation checks right before the click event to prevent Time-of-Check to Time-of-Use element swapping, SSRF blocking against RFC 1918 private subnets, and an automated fuzzing suite of 57 unit/e2e tests.

The server implements the Model Context Protocol (MCP 2024-11-05 standard) so it can plug directly into Claude Desktop, Cursor, or run standalone via CLI/Docker.

Everything is open-source (MIT). We are actively developing v0.2.0 in public and welcome feedback on edge-case perception and firewall UX.

Repo: https://github.com/GabriMannino-pt/OmniPilot-MCP
Showcase screenshot: https://raw.githubusercontent.com/GabriMannino-pt/OmniPilot-MCP/main/screenshots/omnipilot-firewall-showcase.png
```

---

## 2. 🤖 Reddit — `r/ClaudeAI`

### Post Details:
* **Target Subreddit:** `r/ClaudeAI`
* **Flair:** `Project / Tool` or `Discussion`
* **Attached Media:** Upload `screenshots/omnipilot-firewall-showcase.png`
* **Post Title:** `I built an open-source Visual Firewall for Claude Computer-Use so it doesn't accidentally click "Delete" or "Send Transfer" (OmniPilot-MCP)`
* **Post Body:**

```markdown
Hey r/ClaudeAI,

Like many here, I've been experimenting heavily with Claude 3.5 Sonnet's Computer-Use and MCP capabilities. While the capability is astonishing, deploying autonomous browser/desktop actions in production environments has a major safety bottleneck:

**What prevents Claude from accidentally clicking an irreversible button (like submitting a payment, emailing a client, or dropping a table) when a prompt injection occurs or coordinates drift?**

To solve this architecturally, I created **OmniPilot-MCP** — an open-source (MIT) framework that sits between Claude and the operating system via the official Model Context Protocol (MCP).

### 🛡️ How the Pre-Execution Visual Firewall works:
1. **Set-of-Mark (SoM) Dual-Perception:** The browser DOM tree (Playwright) and visual screen canvas are synchronized. Claude sees numbered badges on interactive elements instead of guessing raw x/y pixels.
2. **Deterministic 3-Tier Risk Engine:**
   - Safe reads run instantly.
   - Normal typing/drafting is audit-logged with SHA-256 hashes.
   - High-consequence actions (payments, form submissions, deletions) are **physically intercepted before the mouse clicks**.
3. **Red Bounding-Box Interception (Human-in-the-Loop):** When a Tier 3 action is triggered, Claude is frozen. OmniPilot paints a red box around the exact button on your screen and serves an approval card to an embedded local Web Cockpit. You click "Approve" (or reject), and only then does the driver proceed.
4. **Anti-TOCTOU Protection:** If the webpage shifts or a modal pops up between the model's decision and the click, the action is cancelled deterministically.

### 🧪 Tested & Verifiable:
We built an extensive test suite (57/57 tests passing) testing fuzzing inputs, SSRF private IP blocking, and prompt injection resilience.

You can install it directly into Claude Desktop via Smithery:
`npx -y @smithery/cli install @GabriMannino-pt/OmniPilot-MCP --client claude`

Or check out the GitHub repo:
👉 https://github.com/GabriMannino-pt/OmniPilot-MCP

I'm developing this project in public (v0.2.0) and would love to get your thoughts, feature requests, or edge cases you've encountered with Claude Computer-Use!
```

---

## 3. 🦙 Reddit — `r/LocalLLaMA`

### Post Details:
* **Target Subreddit:** `r/LocalLLaMA`
* **Flair:** `Project`
* **Attached Media:** Upload `screenshots/omnipilot-firewall-showcase.png`
* **Post Title:** `OmniPilot-MCP: Open-source deterministic Computer-Use agent with Set-of-Mark & Pre-Execution Visual Firewall (MIT)`
* **Post Body:**

```markdown
Hi everyone,

With local Vision-Language Models (Qwen2-VL, MiniCPM-V, Llama 3.2 Vision) getting increasingly capable at GUI understanding, the biggest limitation for local agentic execution has been reliable grounding and safety containment.

Most open-source computer-use implementations either:
- Rely purely on blind coordinate prediction (high failure rate across screen DPIs), or
- Give raw system access with zero guardrails against drift or hallucinated clicks.

I've released **OmniPilot-MCP** (v0.2.0, MIT), an agentic architecture designed specifically for deterministic GUI execution via the Model Context Protocol:

### Key Highlights:
- **Zero-Guess Grounding (SoM):** Uses Playwright's accessibility tree + visual numbered markers (Set-of-Mark) overlaid in memory using `sharp`. The model interacts via discrete IDs rather than continuous (x, y) floating coordinates.
- **Pre-Execution Visual Firewall:** Evaluates actions through a 3-tier risk engine. Safe actions execute immediately; irreversible actions (e.g. form submit, delete, checkout) pause execution, highlight the target with a red bounding frame, and require local operator approval.
- **Anti-TOCTOU Timing Guard:** Re-verifies element bounding boxes right before dispatching the mouse event to prevent race conditions from DOM mutations or overlay popups.
- **Standard Protocol:** Fully compliant with MCP (2024-11-05), runnable via Stdio or Docker, and accompanied by a local React 19 control dashboard.
- **57/57 Automated Tests:** Includes stress fuzzing, CSRF validation, and tamper-evident SHA-256 audit chaining.

GitHub Repository: https://github.com/GabriMannino-pt/OmniPilot-MCP

Looking forward to your feedback on local VLM prompt templates and desktop driver benchmarks!
```

---

## 4. 🐦 X (Twitter) Launch Thread

### Tweet 1 (Hook + Visual):
```text
Giving LLMs direct mouse and keyboard control without a deterministic visual firewall is a massive production vulnerability.

What happens when an agent hallucinates and clicks "Delete Cluster" instead of "Save"?

Meet OmniPilot-MCP: An open-source autonomous agent with a Pre-Execution Visual Firewall 🧵👇
[Attach: screenshots/omnipilot-firewall-showcase.png]
```

### Tweet 2 (Core Innovation):
```text
2/ Most computer-use agents rely on blind coordinate guessing.

OmniPilot uses a Dual-Perception Engine:
• Playwright ARIA Accessibility Tree
• Set-of-Mark (SoM) visual overlays

The model sees numbered tags [1, 2, 3...] mapped deterministically to real DOM elements. No coordinate drift.
```

### Tweet 3 (The Firewall):
```text
3/ The 3-Tier Risk Engine:
🟢 Tier 1: Read/inspect operations execute instantly at 0 latency.
🟡 Tier 2: Form filling & navigation tracked in a SHA-256 audit log.
🔴 Tier 3: Irreversible actions (payments, deletions, sends) FREEZE execution and paint a red bounding frame on-screen.
```

### Tweet 4 (Human-in-the-Loop):
```text
4/ Before any critical action executes, OmniPilot holds the event and pops a verification card in a local React 19 cockpit.

Anti-TOCTOU guards verify the target hasn't moved under the cursor. If the DOM shifts, the click aborts.
57/57 security tests passing.
```

### Tweet 5 (Call to Action):
```text
5/ We're building OmniPilot-MCP in public as a standard for safe autonomous computer-use.

⭐ Star the repo on GitHub: https://github.com/GabriMannino-pt/OmniPilot-MCP
📦 Install via Smithery: npx -y @smithery/cli install @GabriMannino-pt/OmniPilot-MCP

PRs & feedback welcome! 🚀
```
