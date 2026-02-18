<p align="center">
  <img src="logo.png" alt="Delosa Glint" width="120" height="120" style="border-radius: 24px;" />
</p>

<h1 align="center">Delosa Glint</h1>

<p align="center">
  Turn any browser event into a webhook — no coding required.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
  <img src="https://img.shields.io/badge/version-0.1.0-orange" alt="Version" />
</p>

---

## Overview

Delosa Glint is a Chrome extension that monitors websites for changes and automatically sends notifications via webhooks. No programming knowledge required.

**Supported triggers:**

| Trigger | Description |
|---------|-------------|
| **DOM Change** | Detect when prices, stock status, or any page content updates |
| **Page Visit** | Fire a webhook when specific URLs are loaded |
| **Click** | Track when specific buttons or elements are clicked |
| **Form Submit** | Capture form submission events in real-time |
| **Periodic Check** | Poll pages at custom intervals for changes |

## Getting Started

### Installation from Chrome Web Store

1. Visit the [Chrome Web Store listing](#) *(link coming soon)*
2. Click **"Add to Chrome"**
3. The onboarding page will guide you through your first rule

### Installation from Source

```bash
# Clone the repository
git clone https://github.com/your-username/delosa-glint.git
cd delosa-glint

# Install dependencies
npm install

# Build for production
npm run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **"Load unpacked"**
4. Select the `dist/` directory

## Usage

### 3 Steps to Create a Rule

1. **Choose a trigger** — Select the browser event type to watch
2. **Pick an element** — Use the visual selector to click any element on the page (CSS selectors are auto-generated)
3. **Set your webhook** — Enter a destination URL and start receiving data

### Webhook Formats

| Format | Use Case |
|--------|----------|
| **Generic (JSON)** | Detailed payload for custom APIs |
| **Text** | Simple messages for Slack / Discord |

### Example Payload

```json
{
  "event": "dom_change",
  "rule": { "id": "r1", "name": "Price Watch" },
  "source": { "url": "https://example.com/product", "selector": "#price" },
  "change": { "type": "mutation", "previous": "$100", "current": "$89" },
  "timestamp": "2026-02-18T12:00:00Z",
  "meta": { "browser": "chrome", "extensionVersion": "0.1.0" },
  "powered_by": "Delosa Glint"
}
```

### Compatible Services

Works with any webhook-compatible service:

- Slack / Discord / Microsoft Teams
- Zapier / Make (Integromat) / n8n / IFTTT
- Google Sheets (via Apps Script)
- Custom REST APIs

## Development

### Prerequisites

- Node.js >= 18
- npm >= 9

### Commands

```bash
npm run dev      # Build in watch mode (development)
npm run build    # Production build
npm test         # Run all tests
npm run lint     # Lint source files
```

### Project Structure

```
src/
├── background/        # Service Worker
│   └── service-worker.ts
├── content/           # Content Scripts (injected into pages)
│   ├── observer.ts    # DOM/event monitoring
│   └── selector.ts    # Visual element picker
├── lib/               # Shared utilities
│   ├── types.ts       # TypeScript type definitions
│   ├── storage.ts     # Chrome Storage helpers
│   ├── webhook.ts     # Webhook sender
│   ├── validators.ts  # Input validation
│   ├── url-utils.ts   # URL pattern matching
│   └── selector-generator.ts
├── popup/             # Popup UI (React)
│   ├── App.tsx
│   ├── components/
│   │   ├── wizard/    # Rule creation wizard
│   │   ├── RuleList.tsx
│   │   ├── RuleCard.tsx
│   │   └── LogList.tsx
│   └── hooks/         # Custom React hooks
├── onboarding/        # Onboarding page
├── options/           # Options page
└── ui/                # Shared UI components (Button, Card, Toggle)

tests/                 # Jest test suites (mirrors src/ structure)
public/
├── manifest.json      # Chrome Extension Manifest V3
└── icons/             # Extension icons
```

### Architecture

```
Popup (React) ←→ Service Worker (Background) ←→ Content Script (DOM)
```

- **Popup** — Rule management UI, log viewer, creation wizard
- **Service Worker** — Orchestrates messaging, sends webhooks, manages alarms
- **Content Script** — Monitors DOM changes, handles visual element selection

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest V3 |
| Popup UI | React 19 + TypeScript + Tailwind CSS 4 |
| Content Script | TypeScript (vanilla DOM, zero dependencies) |
| Background | Service Worker (TypeScript) |
| Build | Webpack 5 + ts-loader + PostCSS |
| Test | Jest + jest-chrome + React Testing Library |

## Privacy

- All rule data and logs are stored **locally** in `chrome.storage.local`
- No external servers, analytics, or tracking
- Webhooks are sent **directly** from the browser to your configured endpoints
- No data leaves the browser except for the webhooks you explicitly configure

## License

[MIT](LICENSE)
