# Rule Creation & Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete rule creation wizard and rule list management UI so users can create, view, toggle, and delete webhook rules from the popup.

**Architecture:** The popup uses React components rendered inside a 360px-wide Chrome extension popup. A multi-step wizard (3 steps: trigger config, element selection, webhook destination) collects rule data and saves it via `StorageHelper`. The rule list fetches from storage on mount and provides toggle/delete actions. The element selector step communicates with the content script via `chrome.tabs.sendMessage`. All state is local React state until final save.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 4, Chrome Extension APIs (`chrome.storage.local`, `chrome.tabs.sendMessage`), existing `StorageHelper` class, existing UI atoms (`Button`, `Card`, `Toggle`).

---

### Task 1: Configure Jest for React/TypeScript testing

**Files:**
- Create: `jest.config.js`
- Modify: `tests/setup.ts`
- Modify: `tsconfig.json`

Jest is not yet configured. We need it working before writing any tests.

**Step 1: Create jest.config.js**

```js
// jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  setupFiles: ["<rootDir>/tests/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.css$": "<rootDir>/tests/__mocks__/styleMock.js",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
};
```

**Step 2: Create CSS mock file**

```js
// tests/__mocks__/styleMock.js
module.exports = {};
```

**Step 3: Add test include to tsconfig.json**

In `tsconfig.json`, change `"exclude": ["node_modules", "dist", "tests"]` to `"exclude": ["node_modules", "dist"]` so TypeScript recognizes test files.

**Step 4: Run jest to verify config**

Run: `npx jest --passWithNoTests`
Expected: "No tests found" or 0 test suites, exit 0.

**Step 5: Commit**

```bash
git add jest.config.js tests/__mocks__/styleMock.js tsconfig.json tests/setup.ts
git commit -m "chore: configure jest for react/typescript testing"
```

---

### Task 2: Build useRules hook (storage integration)

**Files:**
- Create: `src/popup/hooks/useRules.ts`
- Create: `tests/popup/hooks/useRules.test.ts`

This hook encapsulates all rule CRUD operations for popup components.

**Step 1: Write the failing test**

```ts
// tests/popup/hooks/useRules.test.ts
import { renderHook, act } from "@testing-library/react";
import { useRules } from "@/popup/hooks/useRules";
import { Rule } from "@/lib/types";

const mockRule: Rule = {
  id: "r1",
  name: "Test Rule",
  enabled: true,
  trigger: "dom_change",
  urlPattern: "https://example.com/*",
  selector: "#price",
  destination: { id: "d1", url: "https://hooks.example.com/webhook", label: "My Hook" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
});

test("loads rules from storage on mount", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });

  const { result } = renderHook(() => useRules());

  // Initially loading
  expect(result.current.loading).toBe(true);

  // Wait for effect
  await act(async () => {});

  expect(result.current.rules).toEqual([mockRule]);
  expect(result.current.loading).toBe(false);
});

test("returns empty array when no rules stored", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});

  const { result } = renderHook(() => useRules());
  await act(async () => {});

  expect(result.current.rules).toEqual([]);
});

test("saveRule adds a new rule and refreshes", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [] });
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);

  const { result } = renderHook(() => useRules());
  await act(async () => {});

  // After save, re-fetch returns the new rule
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });

  await act(async () => {
    await result.current.saveRule(mockRule);
  });

  expect(result.current.rules).toEqual([mockRule]);
});

test("deleteRule removes rule and refreshes", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);

  const { result } = renderHook(() => useRules());
  await act(async () => {});

  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [] });

  await act(async () => {
    await result.current.deleteRule("r1");
  });

  expect(result.current.rules).toEqual([]);
});

test("toggleRule flips enabled and saves", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);

  const { result } = renderHook(() => useRules());
  await act(async () => {});

  const toggled = { ...mockRule, enabled: false };
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [toggled] });

  await act(async () => {
    await result.current.toggleRule("r1");
  });

  expect(result.current.rules[0].enabled).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/hooks/useRules.test.ts -v`
Expected: FAIL — module `@/popup/hooks/useRules` not found.

**Step 3: Write minimal implementation**

```ts
// src/popup/hooks/useRules.ts
import { useCallback, useEffect, useState } from "react";
import { Rule } from "@/lib/types";
import { StorageHelper } from "@/lib/storage";

export function useRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const stored = await StorageHelper.getRules();
    setRules(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveRule = useCallback(
    async (rule: Rule) => {
      await StorageHelper.saveRule(rule);
      await refresh();
    },
    [refresh],
  );

  const deleteRule = useCallback(
    async (ruleId: string) => {
      await StorageHelper.deleteRule(ruleId);
      await refresh();
    },
    [refresh],
  );

  const toggleRule = useCallback(
    async (ruleId: string) => {
      const rule = rules.find((r) => r.id === ruleId);
      if (!rule) return;
      await StorageHelper.saveRule({ ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() });
      await refresh();
    },
    [rules, refresh],
  );

  return { rules, loading, saveRule, deleteRule, toggleRule, refresh };
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/hooks/useRules.test.ts -v`
Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/hooks/useRules.ts tests/popup/hooks/useRules.test.ts
git commit -m "feat: add useRules hook for rule CRUD operations"
```

---

### Task 3: Build RuleCard component

**Files:**
- Create: `src/popup/components/RuleCard.tsx`
- Create: `tests/popup/components/RuleCard.test.tsx`

Displays a single rule with toggle and delete controls.

**Step 1: Write the failing test**

```tsx
// tests/popup/components/RuleCard.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RuleCard } from "@/popup/components/RuleCard";
import { Rule } from "@/lib/types";

const mockRule: Rule = {
  id: "r1",
  name: "Price Watcher",
  enabled: true,
  trigger: "dom_change",
  urlPattern: "https://example.com/*",
  selector: "#price",
  destination: { id: "d1", url: "https://hooks.example.com/webhook", label: "My Hook" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

test("renders rule name and trigger type", () => {
  render(<RuleCard rule={mockRule} onToggle={jest.fn()} onDelete={jest.fn()} />);
  expect(screen.getByText("Price Watcher")).toBeTruthy();
  expect(screen.getByText("dom_change")).toBeTruthy();
});

test("renders destination URL", () => {
  render(<RuleCard rule={mockRule} onToggle={jest.fn()} onDelete={jest.fn()} />);
  expect(screen.getByText("My Hook")).toBeTruthy();
});

test("calls onToggle with rule id when toggle clicked", () => {
  const onToggle = jest.fn();
  render(<RuleCard rule={mockRule} onToggle={onToggle} onDelete={jest.fn()} />);
  fireEvent.click(screen.getByRole("switch"));
  expect(onToggle).toHaveBeenCalledWith("r1");
});

test("calls onDelete with rule id when delete clicked", () => {
  const onDelete = jest.fn();
  render(<RuleCard rule={mockRule} onToggle={jest.fn()} onDelete={onDelete} />);
  fireEvent.click(screen.getByLabelText("Delete rule"));
  expect(onDelete).toHaveBeenCalledWith("r1");
});

test("shows disabled styling when rule is disabled", () => {
  const disabled = { ...mockRule, enabled: false };
  render(<RuleCard rule={disabled} onToggle={jest.fn()} onDelete={jest.fn()} />);
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/RuleCard.test.tsx -v`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```tsx
// src/popup/components/RuleCard.tsx
import React from "react";
import { Trash2 } from "lucide-react";
import { Rule } from "@/lib/types";
import { Card } from "@/ui/Card";
import { Toggle } from "@/ui/Toggle";

interface RuleCardProps {
  rule: Rule;
  onToggle: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
}

export function RuleCard({ rule, onToggle, onDelete }: RuleCardProps) {
  return (
    <Card className={rule.enabled ? "" : "opacity-60"}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{rule.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{rule.trigger}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{rule.destination.label}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Toggle label="" checked={rule.enabled} onChange={() => onToggle(rule.id)} />
          <button
            aria-label="Delete rule"
            onClick={() => onDelete(rule.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/components/RuleCard.test.tsx -v`
Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/components/RuleCard.tsx tests/popup/components/RuleCard.test.tsx
git commit -m "feat: add RuleCard component with toggle and delete"
```

---

### Task 4: Build RuleList component

**Files:**
- Create: `src/popup/components/RuleList.tsx`
- Create: `tests/popup/components/RuleList.test.tsx`

Displays all rules or an empty state. Wired to `useRules` hook.

**Step 1: Write the failing test**

```tsx
// tests/popup/components/RuleList.test.tsx
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { RuleList } from "@/popup/components/RuleList";
import { Rule } from "@/lib/types";

const mockRule: Rule = {
  id: "r1",
  name: "Price Watcher",
  enabled: true,
  trigger: "dom_change",
  urlPattern: "https://example.com/*",
  selector: "#price",
  destination: { id: "d1", url: "https://hooks.example.com/webhook", label: "My Hook" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
});

test("shows empty state when no rules", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  render(<RuleList onCreateRule={jest.fn()} />);
  await act(async () => {});
  expect(screen.getByText(/no rules yet/i)).toBeTruthy();
});

test("renders rule cards when rules exist", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
  render(<RuleList onCreateRule={jest.fn()} />);
  await act(async () => {});
  expect(screen.getByText("Price Watcher")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/RuleList.test.tsx -v`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```tsx
// src/popup/components/RuleList.tsx
import React from "react";
import { useRules } from "@/popup/hooks/useRules";
import { RuleCard } from "@/popup/components/RuleCard";
import { Card } from "@/ui/Card";

interface RuleListProps {
  onCreateRule: () => void;
}

export function RuleList({ onCreateRule }: RuleListProps) {
  const { rules, loading, toggleRule, deleteRule } = useRules();

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-6">Loading...</p>;
  }

  if (rules.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500 text-center py-6">
          No rules yet. Click + to create your first webhook rule.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} onToggle={toggleRule} onDelete={deleteRule} />
      ))}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/components/RuleList.test.tsx -v`
Expected: 2 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/components/RuleList.tsx tests/popup/components/RuleList.test.tsx
git commit -m "feat: add RuleList component with empty state"
```

---

### Task 5: Build StepIndicator component

**Files:**
- Create: `src/popup/components/StepIndicator.tsx`
- Create: `tests/popup/components/StepIndicator.test.tsx`

Visual step indicator for the 3-step wizard (Trigger, Element, Destination).

**Step 1: Write the failing test**

```tsx
// tests/popup/components/StepIndicator.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { StepIndicator } from "@/popup/components/StepIndicator";

test("renders all step labels", () => {
  render(<StepIndicator currentStep={0} steps={["Trigger", "Element", "Destination"]} />);
  expect(screen.getByText("Trigger")).toBeTruthy();
  expect(screen.getByText("Element")).toBeTruthy();
  expect(screen.getByText("Destination")).toBeTruthy();
});

test("marks current step as active", () => {
  render(<StepIndicator currentStep={1} steps={["Trigger", "Element", "Destination"]} />);
  const el = screen.getByText("Element");
  expect(el.className).toContain("text-blue-600");
});

test("marks completed steps differently", () => {
  render(<StepIndicator currentStep={2} steps={["Trigger", "Element", "Destination"]} />);
  const trigger = screen.getByText("Trigger");
  expect(trigger.className).toContain("text-blue-600");
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/StepIndicator.test.tsx -v`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```tsx
// src/popup/components/StepIndicator.tsx
import React from "react";

interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
              i <= currentStep
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`text-xs ${
              i <= currentStep ? "text-blue-600 font-medium" : "text-gray-400"
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/components/StepIndicator.test.tsx -v`
Expected: 3 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/components/StepIndicator.tsx tests/popup/components/StepIndicator.test.tsx
git commit -m "feat: add StepIndicator component for wizard navigation"
```

---

### Task 6: Build TriggerStep component (wizard step 1)

**Files:**
- Create: `src/popup/components/wizard/TriggerStep.tsx`
- Create: `tests/popup/components/wizard/TriggerStep.test.tsx`

Collects: rule name, URL pattern, trigger type, and optional interval.

**Step 1: Write the failing test**

```tsx
// tests/popup/components/wizard/TriggerStep.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TriggerStep, TriggerStepData } from "@/popup/components/wizard/TriggerStep";

const defaults: TriggerStepData = {
  name: "",
  urlPattern: "",
  trigger: "dom_change",
  intervalMinutes: undefined,
};

test("renders name and URL pattern inputs", () => {
  render(<TriggerStep data={defaults} onChange={jest.fn()} />);
  expect(screen.getByLabelText("Rule name")).toBeTruthy();
  expect(screen.getByLabelText("URL pattern")).toBeTruthy();
});

test("renders trigger type radio buttons", () => {
  render(<TriggerStep data={defaults} onChange={jest.fn()} />);
  expect(screen.getByLabelText("DOM Change")).toBeTruthy();
  expect(screen.getByLabelText("Page Visit")).toBeTruthy();
  expect(screen.getByLabelText("Click")).toBeTruthy();
  expect(screen.getByLabelText("Form Submit")).toBeTruthy();
  expect(screen.getByLabelText("Periodic Check")).toBeTruthy();
});

test("calls onChange when name is typed", () => {
  const onChange = jest.fn();
  render(<TriggerStep data={defaults} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "My Rule" } });
  expect(onChange).toHaveBeenCalledWith({ ...defaults, name: "My Rule" });
});

test("shows interval input when periodic_check selected", () => {
  const data = { ...defaults, trigger: "periodic_check" as const };
  render(<TriggerStep data={data} onChange={jest.fn()} />);
  expect(screen.getByLabelText("Check interval (minutes)")).toBeTruthy();
});

test("hides interval input for non-periodic triggers", () => {
  render(<TriggerStep data={defaults} onChange={jest.fn()} />);
  expect(screen.queryByLabelText("Check interval (minutes)")).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/wizard/TriggerStep.test.tsx -v`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```tsx
// src/popup/components/wizard/TriggerStep.tsx
import React from "react";
import { TriggerType } from "@/lib/types";

export interface TriggerStepData {
  name: string;
  urlPattern: string;
  trigger: TriggerType;
  intervalMinutes?: number;
}

interface TriggerStepProps {
  data: TriggerStepData;
  onChange: (data: TriggerStepData) => void;
}

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: "dom_change", label: "DOM Change" },
  { value: "page_visit", label: "Page Visit" },
  { value: "click", label: "Click" },
  { value: "form_submit", label: "Form Submit" },
  { value: "periodic_check", label: "Periodic Check" },
];

export function TriggerStep({ data, onChange }: TriggerStepProps) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="rule-name" className="block text-xs font-medium text-gray-700 mb-1">
          Rule name
        </label>
        <input
          id="rule-name"
          type="text"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="e.g. Price Watcher"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="url-pattern" className="block text-xs font-medium text-gray-700 mb-1">
          URL pattern
        </label>
        <input
          id="url-pattern"
          type="text"
          value={data.urlPattern}
          onChange={(e) => onChange({ ...data, urlPattern: e.target.value })}
          placeholder="e.g. https://example.com/*"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-gray-700 mb-1">Trigger type</legend>
        <div className="space-y-1">
          {TRIGGER_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="trigger"
                value={opt.value}
                checked={data.trigger === opt.value}
                onChange={() => onChange({ ...data, trigger: opt.value })}
                className="text-blue-600"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {data.trigger === "periodic_check" && (
        <div>
          <label htmlFor="interval" className="block text-xs font-medium text-gray-700 mb-1">
            Check interval (minutes)
          </label>
          <input
            id="interval"
            type="number"
            min={1}
            value={data.intervalMinutes ?? ""}
            onChange={(e) =>
              onChange({ ...data, intervalMinutes: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="60"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/components/wizard/TriggerStep.test.tsx -v`
Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/components/wizard/TriggerStep.tsx tests/popup/components/wizard/TriggerStep.test.tsx
git commit -m "feat: add TriggerStep wizard component"
```

---

### Task 7: Build SelectorStep component (wizard step 2)

**Files:**
- Create: `src/popup/components/wizard/SelectorStep.tsx`
- Create: `tests/popup/components/wizard/SelectorStep.test.tsx`

Lets the user pick an element on the page or type a CSS selector manually. For `page_visit` trigger, this step is skipped (handled in the parent wizard). This component sends `ACTIVATE_SELECTOR` to the content script and listens for the selection result via `chrome.storage.local` (the `pendingSelection` key set by the service worker).

**Step 1: Write the failing test**

```tsx
// tests/popup/components/wizard/SelectorStep.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectorStep, SelectorStepData } from "@/popup/components/wizard/SelectorStep";

// Mock chrome.tabs
beforeEach(() => {
  (global as any).chrome.tabs = {
    query: jest.fn(),
    sendMessage: jest.fn(),
  };
});

const defaults: SelectorStepData = { selector: "" };

test("renders manual CSS selector input", () => {
  render(<SelectorStep data={defaults} onChange={jest.fn()} />);
  expect(screen.getByLabelText("CSS Selector")).toBeTruthy();
});

test("renders pick element button", () => {
  render(<SelectorStep data={defaults} onChange={jest.fn()} />);
  expect(screen.getByText("Pick Element")).toBeTruthy();
});

test("calls onChange when selector is typed manually", () => {
  const onChange = jest.fn();
  render(<SelectorStep data={defaults} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("CSS Selector"), { target: { value: "#price" } });
  expect(onChange).toHaveBeenCalledWith({ selector: "#price" });
});

test("shows selector value when provided", () => {
  render(<SelectorStep data={{ selector: ".my-class" }} onChange={jest.fn()} />);
  const input = screen.getByLabelText("CSS Selector") as HTMLInputElement;
  expect(input.value).toBe(".my-class");
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/wizard/SelectorStep.test.tsx -v`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```tsx
// src/popup/components/wizard/SelectorStep.tsx
import React, { useCallback } from "react";
import { Crosshair } from "lucide-react";
import { Button } from "@/ui/Button";

export interface SelectorStepData {
  selector: string;
}

interface SelectorStepProps {
  data: SelectorStepData;
  onChange: (data: SelectorStepData) => void;
}

export function SelectorStep({ data, onChange }: SelectorStepProps) {
  const handlePickElement = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Inject selector content script if not already present, then activate
    chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_SELECTOR" });

    // Close popup — selector works on the page. User re-opens popup after picking.
    // The selected element is saved to chrome.storage.local.pendingSelection
    // by the service worker, and the wizard reads it on next open.
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

Run: `npx jest tests/popup/components/wizard/SelectorStep.test.tsx -v`
Expected: 4 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/components/wizard/SelectorStep.tsx tests/popup/components/wizard/SelectorStep.test.tsx
git commit -m "feat: add SelectorStep wizard component with pick element"
```

---

### Task 8: Build DestinationStep component (wizard step 3)

**Files:**
- Create: `src/popup/components/wizard/DestinationStep.tsx`
- Create: `tests/popup/components/wizard/DestinationStep.test.tsx`

Collects webhook URL and an optional label.

**Step 1: Write the failing test**

```tsx
// tests/popup/components/wizard/DestinationStep.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DestinationStep, DestinationStepData } from "@/popup/components/wizard/DestinationStep";

const defaults: DestinationStepData = { url: "", label: "" };

test("renders webhook URL input", () => {
  render(<DestinationStep data={defaults} onChange={jest.fn()} />);
  expect(screen.getByLabelText("Webhook URL")).toBeTruthy();
});

test("renders label input", () => {
  render(<DestinationStep data={defaults} onChange={jest.fn()} />);
  expect(screen.getByLabelText("Label")).toBeTruthy();
});

test("calls onChange when URL is typed", () => {
  const onChange = jest.fn();
  render(<DestinationStep data={defaults} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Webhook URL"), {
    target: { value: "https://hooks.example.com/test" },
  });
  expect(onChange).toHaveBeenCalledWith({ url: "https://hooks.example.com/test", label: "" });
});

test("calls onChange when label is typed", () => {
  const onChange = jest.fn();
  render(<DestinationStep data={defaults} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Label"), { target: { value: "My Slack" } });
  expect(onChange).toHaveBeenCalledWith({ url: "", label: "My Slack" });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/wizard/DestinationStep.test.tsx -v`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```tsx
// src/popup/components/wizard/DestinationStep.tsx
import React from "react";

export interface DestinationStepData {
  url: string;
  label: string;
}

interface DestinationStepProps {
  data: DestinationStepData;
  onChange: (data: DestinationStepData) => void;
}

export function DestinationStep({ data, onChange }: DestinationStepProps) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="webhook-url" className="block text-xs font-medium text-gray-700 mb-1">
          Webhook URL
        </label>
        <input
          id="webhook-url"
          type="url"
          value={data.url}
          onChange={(e) => onChange({ ...data, url: e.target.value })}
          placeholder="https://hooks.slack.com/services/..."
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="dest-label" className="block text-xs font-medium text-gray-700 mb-1">
          Label
        </label>
        <input
          id="dest-label"
          type="text"
          value={data.label}
          onChange={(e) => onChange({ ...data, label: e.target.value })}
          placeholder="e.g. My Slack Channel"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/components/wizard/DestinationStep.test.tsx -v`
Expected: 4 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/components/wizard/DestinationStep.tsx tests/popup/components/wizard/DestinationStep.test.tsx
git commit -m "feat: add DestinationStep wizard component"
```

---

### Task 9: Build CreateRuleWizard component (orchestrates steps 1-3)

**Files:**
- Create: `src/popup/components/wizard/CreateRuleWizard.tsx`
- Create: `tests/popup/components/wizard/CreateRuleWizard.test.tsx`

Multi-step form that combines TriggerStep, SelectorStep, and DestinationStep. On save, constructs a `Rule` object and calls `saveRule`.

**Step 1: Write the failing test**

```tsx
// tests/popup/components/wizard/CreateRuleWizard.test.tsx
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CreateRuleWizard } from "@/popup/components/wizard/CreateRuleWizard";

// Mock crypto.randomUUID
Object.defineProperty(globalThis, "crypto", {
  value: { randomUUID: () => "test-uuid-123" },
});

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
});

test("renders step 1 (Trigger) initially", () => {
  render(<CreateRuleWizard onDone={jest.fn()} />);
  expect(screen.getByLabelText("Rule name")).toBeTruthy();
  expect(screen.getByLabelText("URL pattern")).toBeTruthy();
});

test("Next button advances to step 2 when trigger needs selector", () => {
  render(<CreateRuleWizard onDone={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Test" } });
  fireEvent.change(screen.getByLabelText("URL pattern"), { target: { value: "https://*" } });
  fireEvent.click(screen.getByText("Next"));
  // Step 2 shows CSS Selector input
  expect(screen.getByLabelText("CSS Selector")).toBeTruthy();
});

test("skips step 2 for page_visit trigger", () => {
  render(<CreateRuleWizard onDone={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Test" } });
  fireEvent.change(screen.getByLabelText("URL pattern"), { target: { value: "https://*" } });
  fireEvent.click(screen.getByLabelText("Page Visit"));
  fireEvent.click(screen.getByText("Next"));
  // Should skip to step 3 — destination
  expect(screen.getByLabelText("Webhook URL")).toBeTruthy();
});

test("Back button returns to previous step", () => {
  render(<CreateRuleWizard onDone={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Test" } });
  fireEvent.change(screen.getByLabelText("URL pattern"), { target: { value: "https://*" } });
  fireEvent.click(screen.getByText("Next"));
  fireEvent.click(screen.getByText("Back"));
  expect(screen.getByLabelText("Rule name")).toBeTruthy();
});

test("Save button calls onDone after saving rule", async () => {
  const onDone = jest.fn();
  render(<CreateRuleWizard onDone={onDone} />);

  // Step 1: fill trigger
  fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Test" } });
  fireEvent.change(screen.getByLabelText("URL pattern"), { target: { value: "https://*" } });
  fireEvent.click(screen.getByLabelText("Page Visit"));
  fireEvent.click(screen.getByText("Next"));

  // Step 3: fill destination (step 2 skipped for page_visit)
  fireEvent.change(screen.getByLabelText("Webhook URL"), {
    target: { value: "https://hooks.example.com/test" },
  });
  fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Test Hook" } });

  await act(async () => {
    fireEvent.click(screen.getByText("Save Rule"));
  });

  expect(chrome.storage.local.set).toHaveBeenCalled();
  expect(onDone).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/wizard/CreateRuleWizard.test.tsx -v`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```tsx
// src/popup/components/wizard/CreateRuleWizard.tsx
import React, { useEffect, useState } from "react";
import { Rule } from "@/lib/types";
import { StorageHelper } from "@/lib/storage";
import { Button } from "@/ui/Button";
import { StepIndicator } from "@/popup/components/StepIndicator";
import { TriggerStep, TriggerStepData } from "./TriggerStep";
import { SelectorStep, SelectorStepData } from "./SelectorStep";
import { DestinationStep, DestinationStepData } from "./DestinationStep";

interface CreateRuleWizardProps {
  onDone: () => void;
}

const STEPS_WITH_SELECTOR = ["Trigger", "Element", "Destination"];
const STEPS_WITHOUT_SELECTOR = ["Trigger", "Destination"];

function needsSelector(trigger: string): boolean {
  return trigger !== "page_visit" && trigger !== "periodic_check";
}

export function CreateRuleWizard({ onDone }: CreateRuleWizardProps) {
  const [step, setStep] = useState(0);
  const [trigger, setTrigger] = useState<TriggerStepData>({
    name: "",
    urlPattern: "",
    trigger: "dom_change",
    intervalMinutes: undefined,
  });
  const [selector, setSelector] = useState<SelectorStepData>({ selector: "" });
  const [destination, setDestination] = useState<DestinationStepData>({ url: "", label: "" });

  const showSelector = needsSelector(trigger.trigger);
  const steps = showSelector ? STEPS_WITH_SELECTOR : STEPS_WITHOUT_SELECTOR;
  const lastStep = steps.length - 1;

  // Check for pending selection from visual picker
  useEffect(() => {
    chrome.storage.local.get("pendingSelection").then((result) => {
      const pending = result.pendingSelection as { selector: string; url: string } | undefined;
      if (pending?.selector) {
        setSelector({ selector: pending.selector });
        chrome.storage.local.remove("pendingSelection");
      }
    });
  }, []);

  const handleNext = () => {
    if (step < lastStep) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSave = async () => {
    const now = new Date().toISOString();
    const rule: Rule = {
      id: crypto.randomUUID(),
      name: trigger.name,
      enabled: true,
      trigger: trigger.trigger,
      urlPattern: trigger.urlPattern,
      selector: showSelector ? selector.selector : undefined,
      intervalMinutes: trigger.intervalMinutes,
      destination: {
        id: crypto.randomUUID(),
        url: destination.url,
        label: destination.label || destination.url,
      },
      createdAt: now,
      updatedAt: now,
    };
    await StorageHelper.saveRule(rule);
    onDone();
  };

  const isStepValid = (): boolean => {
    if (step === 0) return trigger.name.trim() !== "" && trigger.urlPattern.trim() !== "";
    if (showSelector && step === 1) return selector.selector.trim() !== "";
    const destStep = showSelector ? 2 : 1;
    if (step === destStep) return destination.url.trim() !== "";
    return true;
  };

  const renderStep = () => {
    if (step === 0) {
      return <TriggerStep data={trigger} onChange={setTrigger} />;
    }
    if (showSelector && step === 1) {
      return <SelectorStep data={selector} onChange={setSelector} />;
    }
    return <DestinationStep data={destination} onChange={setDestination} />;
  };

  return (
    <div className="space-y-3">
      <StepIndicator currentStep={step} steps={steps} />
      {renderStep()}
      <div className="flex justify-between pt-2">
        {step > 0 ? (
          <Button variant="secondary" size="sm" onClick={handleBack}>
            Back
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
        {step < lastStep ? (
          <Button size="sm" onClick={handleNext} disabled={!isStepValid()}>
            Next
          </Button>
        ) : (
          <Button size="sm" onClick={handleSave} disabled={!isStepValid()}>
            Save Rule
          </Button>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/components/wizard/CreateRuleWizard.test.tsx -v`
Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/components/wizard/CreateRuleWizard.tsx tests/popup/components/wizard/CreateRuleWizard.test.tsx
git commit -m "feat: add CreateRuleWizard multi-step form"
```

---

### Task 10: Wire up App.tsx with real components

**Files:**
- Modify: `src/popup/App.tsx`
- Create: `tests/popup/App.test.tsx`

Replace the scaffold placeholders with the real `RuleList` and `CreateRuleWizard`.

**Step 1: Write the failing test**

```tsx
// tests/popup/App.test.tsx
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { App } from "@/popup/App";

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
});

test("renders BrowserHook header", async () => {
  render(<App />);
  await act(async () => {});
  expect(screen.getByText("BrowserHook")).toBeTruthy();
});

test("shows rule list by default", async () => {
  render(<App />);
  await act(async () => {});
  expect(screen.getByText(/no rules yet/i)).toBeTruthy();
});

test("switches to create view when + button clicked", async () => {
  render(<App />);
  await act(async () => {});
  fireEvent.click(screen.getByLabelText("Create rule"));
  expect(screen.getByLabelText("Rule name")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/App.test.tsx -v`
Expected: FAIL — "Create rule" label not found (current App.tsx doesn't use aria-label).

**Step 3: Rewrite App.tsx**

Replace the entire content of `src/popup/App.tsx` with:

```tsx
// src/popup/App.tsx
import React, { useState } from "react";
import { Webhook, Plus, List } from "lucide-react";
import { Button } from "@/ui/Button";
import { RuleList } from "@/popup/components/RuleList";
import { CreateRuleWizard } from "@/popup/components/wizard/CreateRuleWizard";

type View = "rules" | "create";

export function App() {
  const [view, setView] = useState<View>("rules");

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">BrowserHook</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label={view === "rules" ? "Create rule" : "View rules"}
          onClick={() => setView(view === "rules" ? "create" : "rules")}
        >
          {view === "rules" ? <Plus className="w-4 h-4" /> : <List className="w-4 h-4" />}
        </Button>
      </header>

      {view === "rules" ? (
        <RuleList onCreateRule={() => setView("create")} />
      ) : (
        <CreateRuleWizard onDone={() => setView("rules")} />
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/App.test.tsx -v`
Expected: 3 tests PASS.

**Step 5: Run all tests**

Run: `npx jest -v`
Expected: All tests pass.

**Step 6: Run build to verify everything compiles**

Run: `npm run build`
Expected: webpack compiled successfully.

**Step 7: Commit**

```bash
git add src/popup/App.tsx tests/popup/App.test.tsx
git commit -m "feat: wire up App with RuleList and CreateRuleWizard"
```

---

### Task 11: Add selector content script to manifest for on-demand injection

**Files:**
- Modify: `public/manifest.json`
- Modify: `src/background/service-worker.ts`

The selector content script should be injected on-demand (when the user clicks "Pick Element") rather than on every page. Update manifest to use `scripting` permission and inject programmatically.

**Step 1: Update manifest.json**

Add `"scripting"` to the permissions array in `public/manifest.json`. Remove the `content_scripts` array entirely (observer will also be injected on-demand in a later task; for now, keep it as-is since it needs to run automatically — actually keep `content_scripts` for observer, just add scripting permission):

```json
{
  "permissions": ["activeTab", "storage", "alarms", "notifications", "scripting"]
}
```

**Step 2: Update service-worker.ts to inject selector on demand**

Add this handler to `service-worker.ts`, inside `handleMessage` switch, before the `default` case. Also add a new message type for injection:

Add `"INJECT_SELECTOR"` to the `MessageType` union in `src/lib/types.ts`.

In service-worker.ts, add the case:

```ts
case "INJECT_SELECTOR": {
  const { tabId } = message.payload as { tabId: number };
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content/selector.js"],
  });
  return { success: true };
}
```

**Step 3: Update SelectorStep to inject before activating**

In `src/popup/components/wizard/SelectorStep.tsx`, update `handlePickElement`:

```ts
const handlePickElement = useCallback(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Inject selector script, then activate
  await chrome.runtime.sendMessage({ type: "INJECT_SELECTOR", payload: { tabId: tab.id } });
  await chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_SELECTOR" });
  window.close();
}, []);
```

**Step 4: Run build**

Run: `npm run build`
Expected: compiled successfully.

**Step 5: Commit**

```bash
git add public/manifest.json src/lib/types.ts src/background/service-worker.ts src/popup/components/wizard/SelectorStep.tsx
git commit -m "feat: inject selector content script on demand via scripting API"
```

---

### Task 12: Run full test suite and build verification

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `npx jest -v`
Expected: All tests pass (should be ~25+ tests across all files).

**Step 2: Run production build**

Run: `npm run build`
Expected: webpack compiled successfully with no errors.

**Step 3: Verify dist contents**

Run: `ls -R dist/`
Expected output includes: `manifest.json`, `service-worker.js`, `popup/popup.html`, `popup/popup.js`, `popup/popup.css`, `options/options.html`, `options/options.js`, `options/options.css`, `content/selector.js`, `content/observer.js`, `icons/`.

**Step 4: Commit (if any fixes were needed)**

```bash
git add -A && git commit -m "chore: fix any test/build issues from integration"
```

(Skip if no changes needed.)
