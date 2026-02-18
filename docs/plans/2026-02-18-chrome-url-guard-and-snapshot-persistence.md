# Chrome URL Guard & Element Snapshot Persistence Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the "Cannot access a chrome:// URL" crash and persist element snapshots across page reloads/Chrome restarts so dom_change triggers can detect changes between sessions.

**Architecture:** Add URL validation guards at every Chrome API boundary (scripting.executeScript, tabs.sendMessage). Persist element snapshots to `chrome.storage.local` keyed by ruleId, so `DOMWatcher` can compare current element text against the last-known value even after Chrome is restarted.

**Tech Stack:** Jest 27, ts-jest, jsdom, TypeScript 5, Chrome Extension APIs.

---

## Background: Storage Architecture

**What persists across Chrome restarts (chrome.storage.local):**
- Rules (id, name, trigger, selector, urlPattern, destination)
- Logs (webhook delivery history)
- Settings (notification prefs, max log entries)

**What is lost on every page reload / Chrome restart:**
- `DOMWatcher.previousValues` — an in-memory `Map<ruleId, string>` that holds the last-seen textContent of each observed element. This means dom_change triggers can only detect changes *within a single page session*. If you close Chrome and reopen, the element text is re-captured fresh with no comparison baseline — so a change that happened while Chrome was closed goes undetected.

---

### Task 1: Add URL validation helper

**Files:**
- Create: `src/lib/url-utils.ts`
- Create: `tests/lib/url-utils.test.ts`

A shared helper to check if a URL is injectable (not chrome://, edge://, about:, etc.).

**Step 1: Write the failing test**

```ts
// tests/lib/url-utils.test.ts
import { isInjectableUrl } from "@/lib/url-utils";

describe("isInjectableUrl", () => {
  test("returns true for https URLs", () => {
    expect(isInjectableUrl("https://example.com")).toBe(true);
  });

  test("returns true for http URLs", () => {
    expect(isInjectableUrl("http://localhost:3000")).toBe(true);
  });

  test("returns false for chrome:// URLs", () => {
    expect(isInjectableUrl("chrome://extensions")).toBe(false);
  });

  test("returns false for chrome-extension:// URLs", () => {
    expect(isInjectableUrl("chrome-extension://abc/popup.html")).toBe(false);
  });

  test("returns false for about: URLs", () => {
    expect(isInjectableUrl("about:blank")).toBe(false);
  });

  test("returns false for edge:// URLs", () => {
    expect(isInjectableUrl("edge://settings")).toBe(false);
  });

  test("returns false for undefined/empty", () => {
    expect(isInjectableUrl(undefined)).toBe(false);
    expect(isInjectableUrl("")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/lib/url-utils.test.ts --verbose`
Expected: FAIL — module not found.

**Step 3: Write implementation**

```ts
// src/lib/url-utils.ts
const BLOCKED_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "about:",
  "edge://",
  "brave://",
  "opera://",
  "vivaldi://",
  "devtools://",
];

export function isInjectableUrl(url: string | undefined): boolean {
  if (!url) return false;
  return !BLOCKED_PREFIXES.some((prefix) => url.startsWith(prefix));
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/lib/url-utils.test.ts --verbose`
Expected: 7 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/url-utils.ts tests/lib/url-utils.test.ts
git commit -m "feat: add isInjectableUrl helper for chrome:// URL guard"
```

---

### Task 2: Guard INJECT_SELECTOR in service worker

**Files:**
- Modify: `src/background/service-worker.ts`

Add URL check before `chrome.scripting.executeScript`. This is the primary crash site.

**Step 1: Modify service-worker.ts**

Update the `INJECT_SELECTOR` case (around line 46):

```ts
    case "INJECT_SELECTOR": {
      const { tabId } = message.payload as { tabId: number };
      const tab = await chrome.tabs.get(tabId);
      if (!isInjectableUrl(tab.url)) {
        return { error: "Cannot inject into this page. Navigate to a regular web page first." };
      }
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/selector.js"],
      });
      return { success: true };
    }
```

Add import at top:
```ts
import { isInjectableUrl } from "@/lib/url-utils";
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: compiled successfully.

**Step 3: Commit**

```bash
git add src/background/service-worker.ts
git commit -m "fix: guard INJECT_SELECTOR against chrome:// URLs"
```

---

### Task 3: Guard Pick Element in SelectorStep

**Files:**
- Modify: `src/popup/components/wizard/SelectorStep.tsx`
- Modify: `tests/popup/components/wizard/SelectorStep.test.tsx`

Add URL check before sending messages. Show user-friendly error when on chrome:// page.

**Step 1: Update the test**

Add to `tests/popup/components/wizard/SelectorStep.test.tsx`:

```tsx
test("shows error when active tab is a chrome:// URL", async () => {
  // Mock chrome.tabs.query to return a chrome:// tab
  (chrome.tabs as any) = {
    query: jest.fn().mockResolvedValue([{ id: 1, url: "chrome://extensions" }]),
    sendMessage: jest.fn(),
  };

  render(<SelectorStep data={{ selector: "" }} onChange={jest.fn()} />);
  await act(async () => {
    fireEvent.click(screen.getByText("Pick Element"));
  });

  expect(screen.getByText(/cannot pick elements/i)).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/wizard/SelectorStep.test.tsx --verbose`
Expected: FAIL — no error message shown.

**Step 3: Update SelectorStep.tsx**

```tsx
import React, { useCallback, useState } from "react";
import { Crosshair } from "lucide-react";
import { Button } from "@/ui/Button";
import { isInjectableUrl } from "@/lib/url-utils";

export interface SelectorStepData {
  selector: string;
}

interface SelectorStepProps {
  data: SelectorStepData;
  onChange: (data: SelectorStepData) => void;
}

export function SelectorStep({ data, onChange }: SelectorStepProps) {
  const [error, setError] = useState<string | null>(null);

  const handlePickElement = useCallback(async () => {
    setError(null);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (!isInjectableUrl(tab.url)) {
      setError("Cannot pick elements on this page. Navigate to a regular web page first.");
      return;
    }

    await chrome.runtime.sendMessage({ type: "INJECT_SELECTOR", payload: { tabId: tab.id } });
    await chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_SELECTOR" });
    window.close();
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="css-selector" className="block text-xs font-medium text-gray-700 mb-1">
          CSS Selector
        </label>
        <input
          id="css-selector"
          type="text"
          value={data.selector}
          onChange={(e) => onChange({ selector: e.target.value })}
          placeholder="e.g. #price, .product-title"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-500 mb-2">Or pick an element visually:</p>
        <Button variant="secondary" size="sm" onClick={handlePickElement}>
          <Crosshair className="w-3.5 h-3.5 mr-1" />
          Pick Element
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}

      {data.selector && (
        <div className="bg-gray-50 rounded p-2">
          <p className="text-xs text-gray-500">Selected:</p>
          <code className="text-xs text-blue-700 break-all">{data.selector}</code>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/components/wizard/SelectorStep.test.tsx --verbose`
Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/components/wizard/SelectorStep.tsx tests/popup/components/wizard/SelectorStep.test.tsx
git commit -m "fix: show error when trying to pick element on chrome:// page"
```

---

### Task 4: Restrict content_scripts match pattern in manifest

**Files:**
- Modify: `public/manifest.json`

Change `<all_urls>` to explicit http/https patterns. This prevents Chrome from even attempting to load observer.js on chrome:// pages.

**Step 1: Update manifest.json**

Change:
```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
```

To:
```json
"content_scripts": [
  {
    "matches": ["http://*/*", "https://*/*"],
```

**Step 2: Run build**

Run: `npm run build`
Expected: compiled successfully.

**Step 3: Commit**

```bash
git add public/manifest.json
git commit -m "fix: restrict content script to http/https URLs only"
```

---

### Task 5: Add element snapshot persistence to StorageHelper

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `tests/lib/storage.test.ts`

Add methods to save/load per-rule element snapshots.

**Step 1: Write the failing tests**

Append to `tests/lib/storage.test.ts`:

```ts
describe("snapshots", () => {
  test("getSnapshot returns null when no snapshot exists", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    expect(await StorageHelper.getSnapshot("r1")).toBeNull();
  });

  test("saveSnapshot stores value keyed by ruleId", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    await StorageHelper.saveSnapshot("r1", "$10.00");
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      snapshots: { r1: "$10.00" },
    });
  });

  test("getSnapshot returns saved value", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      snapshots: { r1: "$10.00", r2: "$20.00" },
    });
    expect(await StorageHelper.getSnapshot("r1")).toBe("$10.00");
  });

  test("deleteSnapshot removes value for ruleId", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      snapshots: { r1: "$10.00", r2: "$20.00" },
    });
    await StorageHelper.deleteSnapshot("r1");
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      snapshots: { r2: "$20.00" },
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/lib/storage.test.ts --verbose`
Expected: FAIL — methods not found.

**Step 3: Add snapshot methods to StorageHelper**

Append to `src/lib/storage.ts`:

```ts
  static async getSnapshot(ruleId: string): Promise<string | null> {
    const result = await chrome.storage.local.get("snapshots");
    const snapshots = (result.snapshots as Record<string, string> | undefined) ?? {};
    return snapshots[ruleId] ?? null;
  }

  static async saveSnapshot(ruleId: string, value: string): Promise<void> {
    const result = await chrome.storage.local.get("snapshots");
    const snapshots = (result.snapshots as Record<string, string> | undefined) ?? {};
    snapshots[ruleId] = value;
    await chrome.storage.local.set({ snapshots });
  }

  static async deleteSnapshot(ruleId: string): Promise<void> {
    const result = await chrome.storage.local.get("snapshots");
    const snapshots = (result.snapshots as Record<string, string> | undefined) ?? {};
    delete snapshots[ruleId];
    await chrome.storage.local.set({ snapshots });
  }
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/lib/storage.test.ts --verbose`
Expected: 14 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/storage.ts tests/lib/storage.test.ts
git commit -m "feat: add snapshot persistence for element text values"
```

---

### Task 6: Use persisted snapshots in DOMWatcher

**Files:**
- Modify: `src/content/observer.ts`
- Modify: `tests/content/observer.test.ts`

Load previous element value from storage on startup. Save snapshot on every change. This means dom_change triggers detect changes across Chrome restarts.

**Step 1: Write the failing test**

Add to `tests/content/observer.test.ts`:

```ts
describe("DOMWatcher snapshot persistence", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    (chrome.storage.local.get as jest.Mock).mockReset();
    (chrome.storage.local.set as jest.Mock).mockReset();
    (chrome.runtime.sendMessage as jest.Mock).mockReset();
    (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  });

  test("detects change between sessions using persisted snapshot", async () => {
    // Element now shows "$12" but snapshot from last session was "$10"
    document.body.innerHTML = '<span id="price">$12</span>';

    (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "rules") {
        return Promise.resolve({
          rules: [
            {
              id: "r1",
              name: "Price Watch",
              enabled: true,
              trigger: "dom_change",
              urlPattern: "*",
              selector: "#price",
              destination: { id: "d1", url: "https://hook.test", label: "Test" },
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
            },
          ],
        });
      }
      if (key === "snapshots") {
        return Promise.resolve({ snapshots: { r1: "$10" } });
      }
      return Promise.resolve({});
    });

    const { DOMWatcher } = await import("@/content/observer");
    const watcher = new DOMWatcher();
    await watcher.startWatching();

    // Should detect the change from "$10" (persisted) to "$12" (current)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DOM_CHANGED",
        payload: expect.objectContaining({
          ruleId: "r1",
          previous: "$10",
          current: "$12",
        }),
      }),
    );
  });

  test("saves snapshot when element is first observed", async () => {
    document.body.innerHTML = '<span id="price">$10</span>';

    (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "rules") {
        return Promise.resolve({
          rules: [
            {
              id: "r1",
              name: "Price Watch",
              enabled: true,
              trigger: "dom_change",
              urlPattern: "*",
              selector: "#price",
              destination: { id: "d1", url: "https://hook.test", label: "Test" },
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
            },
          ],
        });
      }
      if (key === "snapshots") {
        return Promise.resolve({});  // No previous snapshot
      }
      return Promise.resolve({});
    });

    const { DOMWatcher } = await import("@/content/observer");
    const watcher = new DOMWatcher();
    await watcher.startWatching();

    // Should save the initial snapshot
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshots: expect.objectContaining({ r1: "$10" }),
      }),
    );

    // Should NOT send DOM_CHANGED since there's no previous value to compare
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "DOM_CHANGED" }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/content/observer.test.ts --verbose`
Expected: FAIL — DOMWatcher doesn't use storage for snapshots yet.

**Step 3: Update observer.ts**

Update `observeElement` to load/save snapshots via `StorageHelper`:

```ts
  private async observeElement(rule: Rule): Promise<void> {
    if (!rule.selector) return;
    const element = document.querySelector(rule.selector);
    if (!element) return;

    const currentText = element.textContent ?? "";
    const savedSnapshot = await StorageHelper.getSnapshot(rule.id);

    // If we have a saved snapshot and it differs, fire change event immediately
    if (savedSnapshot !== null && savedSnapshot !== currentText) {
      chrome.runtime.sendMessage({
        type: "DOM_CHANGED",
        payload: {
          ruleId: rule.id,
          selector: rule.selector,
          previous: savedSnapshot,
          current: currentText,
          url: window.location.href,
        },
      });
    }

    // Save current value as snapshot
    await StorageHelper.saveSnapshot(rule.id, currentText);
    this.previousValues.set(rule.id, currentText);

    const observer = new MutationObserver(() => {
      const current = element.textContent ?? "";
      const previous = this.previousValues.get(rule.id) ?? "";

      if (current !== previous) {
        chrome.runtime.sendMessage({
          type: "DOM_CHANGED",
          payload: {
            ruleId: rule.id,
            selector: rule.selector,
            previous,
            current,
            url: window.location.href,
          },
        });
        this.previousValues.set(rule.id, current);
        // Persist snapshot for next session
        StorageHelper.saveSnapshot(rule.id, current);
      }
    });

    observer.observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    this.observers.set(rule.id, observer);
  }
```

Note: `observeElement` changes from `private` to `private async` and the `startWatching` call needs to `await` it:

```ts
      if (rule.trigger === "dom_change" && rule.selector) {
        await this.observeElement(rule);
      }
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/content/observer.test.ts --verbose`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/content/observer.ts tests/content/observer.test.ts
git commit -m "feat: persist element snapshots across Chrome restarts"
```

---

### Task 7: Clean up snapshots on rule deletion

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `tests/lib/storage.test.ts`

When a rule is deleted, also delete its snapshot to avoid stale data.

**Step 1: Write the failing test**

Add to `tests/lib/storage.test.ts` in the `rules` describe block:

```ts
  test("deleteRule also removes associated snapshot", async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "rules") return Promise.resolve({ rules: [mockRule] });
      if (key === "snapshots") return Promise.resolve({ snapshots: { r1: "$10" } });
      return Promise.resolve({});
    });
    await StorageHelper.deleteRule("r1");
    // Should have called set twice: once for rules, once for snapshots
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ rules: [] });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ snapshots: {} });
  });
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/lib/storage.test.ts --verbose`
Expected: FAIL — deleteRule doesn't clean up snapshots.

**Step 3: Update deleteRule in storage.ts**

```ts
  static async deleteRule(ruleId: string): Promise<void> {
    const rules = await this.getRules();
    const filtered = rules.filter((r) => r.id !== ruleId);
    await chrome.storage.local.set({ rules: filtered });
    await this.deleteSnapshot(ruleId);
  }
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/lib/storage.test.ts --verbose`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/storage.ts tests/lib/storage.test.ts
git commit -m "fix: clean up snapshots when rule is deleted"
```

---

### Task 8: Full verification

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `npx jest --verbose`
Expected: All tests pass.

**Step 2: Run production build**

Run: `npm run build`
Expected: webpack compiled successfully.

**Step 3: Verify dist contents**

Run: `ls -R dist/`
Expected: All files present.
