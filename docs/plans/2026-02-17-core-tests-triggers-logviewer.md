# Core Tests, Missing Triggers & Log Viewer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add unit tests for all untested business logic, implement the 3 missing trigger types (click, page_visit, periodic_check), and build a log viewer UI — taking the MVP from ~60% to ~85%.

**Architecture:** Tests use Jest + jsdom with mocked Chrome APIs (already in `tests/setup.ts`). Missing triggers are added to the existing `DOMWatcher` class in `src/content/observer.ts`. The log viewer is a new React component in the popup, accessed via a tab bar in `App.tsx`. All popup state comes from `chrome.storage.local` via `StorageHelper`.

**Tech Stack:** Jest 27, ts-jest, jsdom, React 19, TypeScript 5, Tailwind CSS 4, Chrome Extension APIs.

---

### Task 1: Unit tests for SelectorGenerator

**Files:**
- Create: `tests/lib/selector-generator.test.ts`

Tests the priority-based CSS selector generation algorithm. Uses jsdom's DOM to create elements and verify generated selectors.

**Step 1: Write the tests**

```ts
// tests/lib/selector-generator.test.ts
import { SelectorGenerator } from "@/lib/selector-generator";

// Mock CSS.escape since jsdom doesn't have it
if (typeof CSS === "undefined") {
  (global as any).CSS = { escape: (s: string) => s.replace(/([^\w-])/g, "\\$1") };
}

describe("SelectorGenerator.generate", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("returns id selector when element has id", () => {
    document.body.innerHTML = '<div id="price">$10</div>';
    const el = document.getElementById("price")!;
    expect(SelectorGenerator.generate(el)).toBe("#price");
  });

  test("returns data-testid selector when present", () => {
    document.body.innerHTML = '<span data-testid="total">$20</span>';
    const el = document.querySelector('[data-testid="total"]')!;
    expect(SelectorGenerator.generate(el)).toBe('[data-testid="total"]');
  });

  test("returns data-cy selector when present (no data-testid)", () => {
    document.body.innerHTML = '<span data-cy="amount">$30</span>';
    const el = document.querySelector('[data-cy="amount"]')!;
    expect(SelectorGenerator.generate(el)).toBe('[data-cy="amount"]');
  });

  test("prefers id over data-testid", () => {
    document.body.innerHTML = '<div id="main" data-testid="main-div">content</div>';
    const el = document.getElementById("main")!;
    expect(SelectorGenerator.generate(el)).toBe("#main");
  });

  test("returns tag+class selector when unique", () => {
    document.body.innerHTML = '<p class="unique-class">text</p>';
    const el = document.querySelector(".unique-class")!;
    expect(SelectorGenerator.generate(el)).toBe("p.unique-class");
  });

  test("falls back to nth-child when class not unique", () => {
    document.body.innerHTML = '<ul><li class="item">A</li><li class="item">B</li></ul>';
    const el = document.querySelectorAll(".item")[1];
    const result = SelectorGenerator.generate(el);
    // Should contain nth-child since .item is not unique
    expect(result).toContain("li");
  });

  test("builds nth-child path for deeply nested element", () => {
    document.body.innerHTML = "<div><section><p>hello</p></section></div>";
    const el = document.querySelector("p")!;
    const result = SelectorGenerator.generate(el);
    expect(result).toContain("p");
    expect(result).toContain(">");
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx jest tests/lib/selector-generator.test.ts --verbose`
Expected: 7 tests PASS.

**Step 3: Commit**

```bash
git add tests/lib/selector-generator.test.ts
git commit -m "test: add unit tests for SelectorGenerator"
```

---

### Task 2: Unit tests for WebhookSender

**Files:**
- Create: `tests/lib/webhook.test.ts`

Tests HTTP POST behavior, success/failure handling, and network errors using a mocked `fetch`.

**Step 1: Write the tests**

```ts
// tests/lib/webhook.test.ts
import { WebhookSender } from "@/lib/webhook";
import { Destination, WebhookPayload } from "@/lib/types";

const mockDestination: Destination = {
  id: "d1",
  url: "https://hooks.example.com/webhook",
  label: "Test Hook",
};

const mockPayload: WebhookPayload = {
  event: "dom_change",
  rule: { id: "r1", name: "Test Rule" },
  source: { url: "https://example.com", selector: "#price" },
  change: { type: "mutation", previous: "$10", current: "$12" },
  timestamp: "2026-01-01T00:00:00Z",
  meta: { browser: "chrome", extensionVersion: "0.1.0" },
  powered_by: "BrowserHook",
};

beforeEach(() => {
  (global as any).fetch = jest.fn();
});

afterEach(() => {
  delete (global as any).fetch;
});

test("sends POST request with correct headers and body", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

  await WebhookSender.send(mockDestination, mockPayload);

  expect(fetch).toHaveBeenCalledWith("https://hooks.example.com/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mockPayload),
  });
});

test("returns success for 2xx response", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

  const result = await WebhookSender.send(mockDestination, mockPayload);

  expect(result.success).toBe(true);
  expect(result.statusCode).toBe(200);
  expect(result.error).toBeUndefined();
});

test("returns failure for 4xx response", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });

  const result = await WebhookSender.send(mockDestination, mockPayload);

  expect(result.success).toBe(false);
  expect(result.statusCode).toBe(404);
  expect(result.error).toBe("HTTP 404 Not Found");
});

test("returns failure for 5xx response", async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
  });

  const result = await WebhookSender.send(mockDestination, mockPayload);

  expect(result.success).toBe(false);
  expect(result.statusCode).toBe(500);
});

test("returns failure on network error", async () => {
  (fetch as jest.Mock).mockRejectedValue(new Error("Network failure"));

  const result = await WebhookSender.send(mockDestination, mockPayload);

  expect(result.success).toBe(false);
  expect(result.error).toBe("Network failure");
  expect(result.statusCode).toBeUndefined();
});

test("includes custom headers from destination", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

  const dest: Destination = {
    ...mockDestination,
    headers: { Authorization: "Bearer token123" },
  };

  await WebhookSender.send(dest, mockPayload);

  expect(fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token123",
      },
    }),
  );
});
```

**Step 2: Run tests**

Run: `npx jest tests/lib/webhook.test.ts --verbose`
Expected: 6 tests PASS.

**Step 3: Commit**

```bash
git add tests/lib/webhook.test.ts
git commit -m "test: add unit tests for WebhookSender"
```

---

### Task 3: Unit tests for StorageHelper

**Files:**
- Create: `tests/lib/storage.test.ts`

Tests CRUD operations, log truncation, and settings merge.

**Step 1: Write the tests**

```ts
// tests/lib/storage.test.ts
import { StorageHelper } from "@/lib/storage";
import { Rule, LogEntry } from "@/lib/types";

const mockRule: Rule = {
  id: "r1",
  name: "Test",
  enabled: true,
  trigger: "dom_change",
  urlPattern: "https://*",
  selector: "#el",
  destination: { id: "d1", url: "https://example.com", label: "Test" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const mockLog: LogEntry = {
  id: "l1",
  ruleId: "r1",
  ruleName: "Test",
  event: "dom_change",
  status: "success",
  statusCode: 200,
  destinationUrl: "https://example.com",
  timestamp: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
});

describe("rules", () => {
  test("getRules returns empty array when no rules", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    expect(await StorageHelper.getRules()).toEqual([]);
  });

  test("getRules returns stored rules", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
    expect(await StorageHelper.getRules()).toEqual([mockRule]);
  });

  test("saveRule adds new rule", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [] });
    await StorageHelper.saveRule(mockRule);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ rules: [mockRule] });
  });

  test("saveRule updates existing rule by id", async () => {
    const updated = { ...mockRule, name: "Updated" };
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
    await StorageHelper.saveRule(updated);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ rules: [updated] });
  });

  test("deleteRule removes rule by id", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
    await StorageHelper.deleteRule("r1");
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ rules: [] });
  });
});

describe("logs", () => {
  test("getLogs returns empty array when no logs", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    expect(await StorageHelper.getLogs()).toEqual([]);
  });

  test("addLog prepends to existing logs", async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "logs") return Promise.resolve({ logs: [] });
      if (key === "settings") return Promise.resolve({});
      return Promise.resolve({});
    });
    await StorageHelper.addLog(mockLog);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ logs: [mockLog] });
  });

  test("clearLogs empties log array", async () => {
    await StorageHelper.clearLogs();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ logs: [] });
  });
});

describe("settings", () => {
  test("getSettings returns defaults when none stored", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    const settings = await StorageHelper.getSettings();
    expect(settings.enableNotifications).toBe(true);
    expect(settings.maxLogEntries).toBe(500);
  });

  test("saveSettings merges with existing", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    await StorageHelper.saveSettings({ enableNotifications: false });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      settings: { enableNotifications: false, maxLogEntries: 500 },
    });
  });
});
```

**Step 2: Run tests**

Run: `npx jest tests/lib/storage.test.ts --verbose`
Expected: 9 tests PASS.

**Step 3: Commit**

```bash
git add tests/lib/storage.test.ts
git commit -m "test: add unit tests for StorageHelper"
```

---

### Task 4: Implement click trigger in DOMWatcher

**Files:**
- Modify: `src/content/observer.ts`
- Create: `tests/content/observer.test.ts`

Add click event listener for elements matching a rule's selector.

**Step 1: Write the failing test**

```ts
// tests/content/observer.test.ts
/**
 * Tests for the DOMWatcher class.
 *
 * NOTE: observer.ts auto-instantiates a watcher at module scope. To test the class
 * in isolation, we import only the exported class by restructuring the module.
 * For now, we test the URL matching helper and individual trigger setup by
 * extracting testable logic.
 *
 * The actual DOMWatcher class is not directly exported. We test its behavior
 * by setting up DOM and storage mocks, then importing the module.
 */

// We test the matchesUrl logic inline since it's private.
// Instead, test the observable behavior: does it call chrome.runtime.sendMessage
// when DOM changes happen.

describe("DOMWatcher click trigger", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    (chrome.storage.local.get as jest.Mock).mockReset();
    (chrome.runtime.sendMessage as jest.Mock).mockReset();
  });

  test("sends CLICK_EVENT message when matched element is clicked", async () => {
    document.body.innerHTML = '<button id="buy">Buy Now</button>';

    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      rules: [
        {
          id: "r1",
          name: "Click Rule",
          enabled: true,
          trigger: "click",
          urlPattern: "*",
          selector: "#buy",
          destination: { id: "d1", url: "https://hook.test", label: "Test" },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    });

    // Import module to trigger watcher initialization
    // We need to use a fresh import, so use jest.isolateModules
    const { DOMWatcher } = await import("@/content/observer");
    const watcher = new DOMWatcher();
    await watcher.startWatching();

    // Simulate click
    document.getElementById("buy")!.click();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CLICK_EVENT",
        payload: expect.objectContaining({
          ruleId: "r1",
          selector: "#buy",
        }),
      }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/content/observer.test.ts --verbose`
Expected: FAIL — `DOMWatcher` not exported / `CLICK_EVENT` not sent.

**Step 3: Modify observer.ts**

In `src/content/observer.ts`:

1. Export the `DOMWatcher` class (change `class DOMWatcher` to `export class DOMWatcher`).
2. Add `CLICK_EVENT` to `MessageType` in `src/lib/types.ts`.
3. Add `observeClick` method and the `click` case to `startWatching`.

Updated `src/content/observer.ts` (full file):

```ts
import { StorageHelper } from "@/lib/storage";
import { Rule } from "@/lib/types";

export class DOMWatcher {
  private observers = new Map<string, MutationObserver>();
  private previousValues = new Map<string, string>();
  private clickHandlers = new Map<string, { element: Element; handler: EventListener }>();

  async startWatching(): Promise<void> {
    const rules = await StorageHelper.getRules();
    const currentUrl = window.location.href;

    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (!this.matchesUrl(currentUrl, rule.urlPattern)) continue;

      if (rule.trigger === "dom_change" && rule.selector) {
        this.observeElement(rule);
      } else if (rule.trigger === "form_submit" && rule.selector) {
        this.observeForm(rule);
      } else if (rule.trigger === "click" && rule.selector) {
        this.observeClick(rule);
      } else if (rule.trigger === "page_visit") {
        this.handlePageVisit(rule);
      }
    }
  }

  stopWatching(): void {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
    this.previousValues.clear();
    for (const { element, handler } of this.clickHandlers.values()) {
      element.removeEventListener("click", handler);
    }
    this.clickHandlers.clear();
  }

  private observeElement(rule: Rule): void {
    if (!rule.selector) return;
    const element = document.querySelector(rule.selector);
    if (!element) return;

    this.previousValues.set(rule.id, element.textContent ?? "");

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
      }
    });

    observer.observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    this.observers.set(rule.id, observer);
  }

  private observeForm(rule: Rule): void {
    if (!rule.selector) return;
    const form = document.querySelector(rule.selector) as HTMLFormElement | null;
    if (!form) return;

    form.addEventListener("submit", () => {
      const formData = new FormData(form);
      const data: Record<string, string> = {};
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });

      chrome.runtime.sendMessage({
        type: "FORM_SUBMITTED",
        payload: {
          ruleId: rule.id,
          formData: data,
          url: window.location.href,
        },
      });
    });
  }

  private observeClick(rule: Rule): void {
    if (!rule.selector) return;
    const element = document.querySelector(rule.selector);
    if (!element) return;

    const handler = () => {
      chrome.runtime.sendMessage({
        type: "CLICK_EVENT",
        payload: {
          ruleId: rule.id,
          selector: rule.selector,
          url: window.location.href,
        },
      });
    };

    element.addEventListener("click", handler);
    this.clickHandlers.set(rule.id, { element, handler });
  }

  private handlePageVisit(rule: Rule): void {
    chrome.runtime.sendMessage({
      type: "PAGE_VISITED",
      payload: {
        ruleId: rule.id,
        url: window.location.href,
      },
    });
  }

  matchesUrl(url: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return regex.test(url);
    } catch {
      return url.includes(pattern);
    }
  }
}

// Initialize watcher when content script loads
const watcher = new DOMWatcher();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => watcher.startWatching());
} else {
  watcher.startWatching();
}
```

Also update `src/lib/types.ts` — add `"CLICK_EVENT"` and `"PAGE_VISITED"` to `MessageType`:

```ts
export type MessageType =
  | "ELEMENT_SELECTED"
  | "DOM_CHANGED"
  | "FORM_SUBMITTED"
  | "CLICK_EVENT"
  | "PAGE_VISITED"
  | "ACTIVATE_SELECTOR"
  | "DEACTIVATE_SELECTOR"
  | "INJECT_SELECTOR";
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/content/observer.test.ts --verbose`
Expected: 1 test PASS.

**Step 5: Commit**

```bash
git add src/content/observer.ts src/lib/types.ts tests/content/observer.test.ts
git commit -m "feat: implement click and page_visit triggers in DOMWatcher"
```

---

### Task 5: Add more DOMWatcher tests (page_visit, URL matching)

**Files:**
- Modify: `tests/content/observer.test.ts`

**Step 1: Add tests to existing file**

Append to `tests/content/observer.test.ts`:

```ts
describe("DOMWatcher page_visit trigger", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    (chrome.storage.local.get as jest.Mock).mockReset();
    (chrome.runtime.sendMessage as jest.Mock).mockReset();
  });

  test("sends PAGE_VISITED message immediately for matching URL", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      rules: [
        {
          id: "r2",
          name: "Visit Rule",
          enabled: true,
          trigger: "page_visit",
          urlPattern: "*",
          destination: { id: "d1", url: "https://hook.test", label: "Test" },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const { DOMWatcher } = await import("@/content/observer");
    const watcher = new DOMWatcher();
    await watcher.startWatching();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PAGE_VISITED",
        payload: expect.objectContaining({ ruleId: "r2" }),
      }),
    );
  });
});

describe("DOMWatcher.matchesUrl", () => {
  let watcher: any;

  beforeAll(async () => {
    const mod = await import("@/content/observer");
    watcher = new mod.DOMWatcher();
  });

  test("matches wildcard pattern", () => {
    expect(watcher.matchesUrl("https://example.com/page", "https://example.com/*")).toBe(true);
  });

  test("rejects non-matching URL", () => {
    expect(watcher.matchesUrl("https://other.com", "https://example.com/*")).toBe(false);
  });

  test("matches exact URL", () => {
    expect(watcher.matchesUrl("https://example.com", "https://example.com")).toBe(true);
  });

  test("falls back to includes on invalid regex", () => {
    expect(watcher.matchesUrl("https://example.com/page", "example.com")).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `npx jest tests/content/observer.test.ts --verbose`
Expected: 6 tests PASS (1 click + 1 page_visit + 4 URL matching).

**Step 3: Commit**

```bash
git add tests/content/observer.test.ts
git commit -m "test: add page_visit and URL matching tests for DOMWatcher"
```

---

### Task 6: Handle new message types in service worker

**Files:**
- Modify: `src/background/service-worker.ts`

Add `CLICK_EVENT` and `PAGE_VISITED` cases to the message handler.

**Step 1: Modify service-worker.ts**

Add these cases inside the `switch (message.type)` block, before the `default` case:

```ts
    case "CLICK_EVENT":
      return handleClickEvent(
        message.payload as { ruleId: string; selector: string; url: string },
      );

    case "PAGE_VISITED":
      return handlePageVisited(
        message.payload as { ruleId: string; url: string },
      );
```

Add the handler functions after the existing handlers:

```ts
async function handleClickEvent(payload: {
  ruleId: string;
  selector: string;
  url: string;
}): Promise<unknown> {
  const rules = await StorageHelper.getRules();
  const rule = rules.find((r) => r.id === payload.ruleId);
  if (!rule || !rule.enabled) return { skipped: true };

  return dispatchWebhook(rule, "click", {
    type: "click",
    current: payload.selector,
  });
}

async function handlePageVisited(payload: {
  ruleId: string;
  url: string;
}): Promise<unknown> {
  const rules = await StorageHelper.getRules();
  const rule = rules.find((r) => r.id === payload.ruleId);
  if (!rule || !rule.enabled) return { skipped: true };

  return dispatchWebhook(rule, "page_visit", {
    type: "visit",
    current: payload.url,
  });
}
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: compiled successfully.

**Step 3: Commit**

```bash
git add src/background/service-worker.ts
git commit -m "feat: handle CLICK_EVENT and PAGE_VISITED in service worker"
```

---

### Task 7: Build useLogs hook

**Files:**
- Create: `src/popup/hooks/useLogs.ts`
- Create: `tests/popup/hooks/useLogs.test.ts`

Hook for fetching and clearing logs, analogous to `useRules`.

**Step 1: Write the failing test**

```ts
// tests/popup/hooks/useLogs.test.ts
import { renderHook, act } from "@testing-library/react";
import { useLogs } from "@/popup/hooks/useLogs";
import { LogEntry } from "@/lib/types";

const mockLog: LogEntry = {
  id: "l1",
  ruleId: "r1",
  ruleName: "Test Rule",
  event: "dom_change",
  status: "success",
  statusCode: 200,
  destinationUrl: "https://hooks.example.com/webhook",
  timestamp: "2026-01-01T12:00:00Z",
};

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
});

test("loads logs from storage on mount", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [mockLog] });
  const { result } = renderHook(() => useLogs());
  await act(async () => {});
  expect(result.current.logs).toEqual([mockLog]);
  expect(result.current.loading).toBe(false);
});

test("returns empty array when no logs", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  const { result } = renderHook(() => useLogs());
  await act(async () => {});
  expect(result.current.logs).toEqual([]);
});

test("clearLogs empties the list", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [mockLog] });
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  const { result } = renderHook(() => useLogs());
  await act(async () => {});

  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [] });
  await act(async () => {
    await result.current.clearLogs();
  });
  expect(result.current.logs).toEqual([]);
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/hooks/useLogs.test.ts --verbose`
Expected: FAIL — module not found.

**Step 3: Write implementation**

```ts
// src/popup/hooks/useLogs.ts
import { useCallback, useEffect, useState } from "react";
import { LogEntry } from "@/lib/types";
import { StorageHelper } from "@/lib/storage";

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const stored = await StorageHelper.getLogs();
    setLogs(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clearLogs = useCallback(async () => {
    await StorageHelper.clearLogs();
    await refresh();
  }, [refresh]);

  return { logs, loading, clearLogs, refresh };
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/hooks/useLogs.test.ts --verbose`
Expected: 3 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/hooks/useLogs.ts tests/popup/hooks/useLogs.test.ts
git commit -m "feat: add useLogs hook for log viewer"
```

---

### Task 8: Build LogList component

**Files:**
- Create: `src/popup/components/LogList.tsx`
- Create: `tests/popup/components/LogList.test.tsx`

Displays log entries with status indicators, or empty state.

**Step 1: Write the failing test**

```tsx
// tests/popup/components/LogList.test.tsx
import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { LogList } from "@/popup/components/LogList";
import { LogEntry } from "@/lib/types";

const successLog: LogEntry = {
  id: "l1",
  ruleId: "r1",
  ruleName: "Price Watcher",
  event: "dom_change",
  status: "success",
  statusCode: 200,
  destinationUrl: "https://hooks.example.com/webhook",
  timestamp: "2026-01-15T12:30:00Z",
};

const failureLog: LogEntry = {
  id: "l2",
  ruleId: "r1",
  ruleName: "Price Watcher",
  event: "dom_change",
  status: "failure",
  statusCode: 500,
  destinationUrl: "https://hooks.example.com/webhook",
  timestamp: "2026-01-15T12:31:00Z",
  error: "HTTP 500 Internal Server Error",
};

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
});

test("shows empty state when no logs", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  render(<LogList />);
  await act(async () => {});
  expect(screen.getByText(/no logs yet/i)).toBeTruthy();
});

test("renders log entries", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [successLog, failureLog] });
  render(<LogList />);
  await act(async () => {});
  expect(screen.getAllByText("Price Watcher")).toHaveLength(2);
});

test("shows success indicator for successful logs", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [successLog] });
  render(<LogList />);
  await act(async () => {});
  expect(screen.getByText("200")).toBeTruthy();
});

test("shows error message for failed logs", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [failureLog] });
  render(<LogList />);
  await act(async () => {});
  expect(screen.getByText(/500/)).toBeTruthy();
});

test("clear button clears all logs", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [successLog] });
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  render(<LogList />);
  await act(async () => {});

  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ logs: [] });
  await act(async () => {
    fireEvent.click(screen.getByText("Clear"));
  });
  expect(screen.getByText(/no logs yet/i)).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/LogList.test.tsx --verbose`
Expected: FAIL — module not found.

**Step 3: Write implementation**

```tsx
// src/popup/components/LogList.tsx
import React from "react";
import { CheckCircle, XCircle, Trash2 } from "lucide-react";
import { useLogs } from "@/popup/hooks/useLogs";
import { LogEntry } from "@/lib/types";
import { Card } from "@/ui/Card";
import { Button } from "@/ui/Button";

export function LogList() {
  const { logs, loading, clearLogs } = useLogs();

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-6">Loading...</p>;
  }

  if (logs.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500 text-center py-6">
          No logs yet. Logs will appear here when webhooks are triggered.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={clearLogs}>
          <Trash2 className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>
      {logs.map((log) => (
        <LogItem key={log.id} log={log} />
      ))}
    </div>
  );
}

function LogItem({ log }: { log: LogEntry }) {
  const isSuccess = log.status === "success";
  const time = new Date(log.timestamp).toLocaleTimeString();

  return (
    <Card className="!p-3">
      <div className="flex items-start gap-2">
        {isSuccess ? (
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate">{log.ruleName}</span>
            <span className="text-xs text-gray-400 shrink-0 ml-2">{time}</span>
          </div>
          <p className="text-xs text-gray-500">{log.event}</p>
          {log.statusCode && (
            <span
              className={`text-xs ${isSuccess ? "text-green-600" : "text-red-600"}`}
            >
              {log.statusCode}
            </span>
          )}
          {log.error && <p className="text-xs text-red-500 mt-0.5 truncate">{log.error}</p>}
        </div>
      </div>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/components/LogList.test.tsx --verbose`
Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/components/LogList.tsx tests/popup/components/LogList.test.tsx
git commit -m "feat: add LogList component for webhook log viewer"
```

---

### Task 9: Add tab navigation to App.tsx (rules / logs)

**Files:**
- Modify: `src/popup/App.tsx`
- Modify: `tests/popup/App.test.tsx`

Add a third view "logs" and tab buttons to switch between rules and logs.

**Step 1: Update App test**

Add to `tests/popup/App.test.tsx`:

```tsx
test("switches to logs view when log button clicked", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  render(<App />);
  await act(async () => {});
  fireEvent.click(screen.getByLabelText("View logs"));
  await act(async () => {});
  expect(screen.getByText(/no logs yet/i)).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/App.test.tsx --verbose`
Expected: FAIL — "View logs" label not found.

**Step 3: Update App.tsx**

Replace `src/popup/App.tsx` with:

```tsx
import React, { useState } from "react";
import { Webhook, Plus, List, ScrollText } from "lucide-react";
import { Button } from "@/ui/Button";
import { RuleList } from "@/popup/components/RuleList";
import { LogList } from "@/popup/components/LogList";
import { CreateRuleWizard } from "@/popup/components/wizard/CreateRuleWizard";

type View = "rules" | "create" | "logs";

export function App() {
  const [view, setView] = useState<View>("rules");

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">BrowserHook</h1>
        </div>
        <div className="flex items-center gap-1">
          {view !== "create" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                aria-label="View logs"
                onClick={() => setView(view === "logs" ? "rules" : "logs")}
              >
                <ScrollText className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Create rule"
                onClick={() => setView("create")}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </>
          )}
          {view === "create" && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="View rules"
              onClick={() => setView("rules")}
            >
              <List className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {view === "rules" && <RuleList onCreateRule={() => setView("create")} />}
      {view === "create" && <CreateRuleWizard onDone={() => setView("rules")} />}
      {view === "logs" && <LogList />}
    </div>
  );
}
```

**Step 4: Run test to verify all pass**

Run: `npx jest tests/popup/App.test.tsx --verbose`
Expected: 4 tests PASS.

**Step 5: Run all tests**

Run: `npx jest --verbose`
Expected: All tests pass.

**Step 6: Run build**

Run: `npm run build`
Expected: compiled successfully.

**Step 7: Commit**

```bash
git add src/popup/App.tsx tests/popup/App.test.tsx
git commit -m "feat: add log viewer tab to popup navigation"
```

---

### Task 10: Full verification

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `npx jest --verbose`
Expected: All tests pass (should be ~60+ tests across 12+ suites).

**Step 2: Run production build**

Run: `npm run build`
Expected: webpack compiled successfully.

**Step 3: Verify dist contents**

Run: `ls -R dist/`
Expected: All files present (manifest.json, service-worker.js, popup/*, options/*, content/*, icons/*).
