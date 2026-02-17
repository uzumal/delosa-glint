# Rule Editing & Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to edit existing rules via the wizard and add field validation (Webhook URL format, rule name length, CSS selector syntax) with inline error display.

**Architecture:** Reuse `CreateRuleWizard` by accepting an optional `editRule` prop — when provided, it pre-populates state and preserves `id`/`createdAt` on save. A new `src/lib/validators.ts` module provides pure validation functions used by each wizard step. Validation errors appear inline on blur; Next/Save buttons stay disabled until valid. `RuleCard` gets an edit button; `App.tsx` gains an `"edit"` view that passes the selected rule to the wizard.

**Tech Stack:** Jest 27, ts-jest, jsdom, React 19, TypeScript 5, Chrome Extension APIs.

---

### Task 1: Create validators module

**Files:**
- Create: `src/lib/validators.ts`
- Create: `tests/lib/validators.test.ts`

**Step 1: Write the failing test**

```ts
// tests/lib/validators.test.ts
import {
  validateRuleName,
  validateUrlPattern,
  validateWebhookUrl,
  validateSelector,
} from "@/lib/validators";

describe("validateRuleName", () => {
  test("returns null for valid name", () => {
    expect(validateRuleName("Price Watch")).toBeNull();
  });

  test("returns error for empty name", () => {
    expect(validateRuleName("")).toBe("Rule name is required");
  });

  test("returns error for whitespace-only name", () => {
    expect(validateRuleName("   ")).toBe("Rule name is required");
  });

  test("returns error for name exceeding 100 chars", () => {
    expect(validateRuleName("a".repeat(101))).toBe("Rule name must be 100 characters or less");
  });
});

describe("validateUrlPattern", () => {
  test("returns null for valid pattern", () => {
    expect(validateUrlPattern("https://example.com/*")).toBeNull();
  });

  test("returns error for empty pattern", () => {
    expect(validateUrlPattern("")).toBe("URL pattern is required");
  });
});

describe("validateWebhookUrl", () => {
  test("returns null for valid https URL", () => {
    expect(validateWebhookUrl("https://hooks.slack.com/services/T00/B00/xxx")).toBeNull();
  });

  test("returns null for valid http URL", () => {
    expect(validateWebhookUrl("http://localhost:3000/webhook")).toBeNull();
  });

  test("returns error for empty URL", () => {
    expect(validateWebhookUrl("")).toBe("Webhook URL is required");
  });

  test("returns error for invalid URL", () => {
    expect(validateWebhookUrl("not-a-url")).toBe("Must be a valid URL (http:// or https://)");
  });

  test("returns error for non-http protocol", () => {
    expect(validateWebhookUrl("ftp://example.com/hook")).toBe("Must be a valid URL (http:// or https://)");
  });
});

describe("validateSelector", () => {
  test("returns null for valid selector", () => {
    expect(validateSelector("#price")).toBeNull();
  });

  test("returns error for empty selector", () => {
    expect(validateSelector("")).toBe("CSS selector is required");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/lib/validators.test.ts --verbose`
Expected: FAIL — module not found.

**Step 3: Write implementation**

```ts
// src/lib/validators.ts
export function validateRuleName(name: string): string | null {
  if (!name.trim()) return "Rule name is required";
  if (name.length > 100) return "Rule name must be 100 characters or less";
  return null;
}

export function validateUrlPattern(pattern: string): string | null {
  if (!pattern.trim()) return "URL pattern is required";
  return null;
}

export function validateWebhookUrl(url: string): string | null {
  if (!url.trim()) return "Webhook URL is required";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Must be a valid URL (http:// or https://)";
    }
    return null;
  } catch {
    return "Must be a valid URL (http:// or https://)";
  }
}

export function validateSelector(selector: string): string | null {
  if (!selector.trim()) return "CSS selector is required";
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/lib/validators.test.ts --verbose`
Expected: 11 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/validators.ts tests/lib/validators.test.ts
git commit -m "feat: add field validators for rule wizard"
```

---

### Task 2: Add validation to TriggerStep

**Files:**
- Modify: `src/popup/components/wizard/TriggerStep.tsx`
- Modify: `tests/popup/components/wizard/TriggerStep.test.tsx`

**Step 1: Write the failing test**

Add to `tests/popup/components/wizard/TriggerStep.test.tsx`:

```tsx
test("shows validation error for empty name on blur", () => {
  render(<TriggerStep data={{ name: "", urlPattern: "", trigger: "dom_change", intervalMinutes: undefined }} onChange={jest.fn()} />);
  fireEvent.blur(screen.getByLabelText("Rule name"));
  expect(screen.getByText("Rule name is required")).toBeTruthy();
});

test("shows validation error for name exceeding 100 chars on blur", () => {
  render(<TriggerStep data={{ name: "a".repeat(101), urlPattern: "", trigger: "dom_change", intervalMinutes: undefined }} onChange={jest.fn()} />);
  fireEvent.blur(screen.getByLabelText("Rule name"));
  expect(screen.getByText("Rule name must be 100 characters or less")).toBeTruthy();
});

test("does not show validation error before blur", () => {
  render(<TriggerStep data={{ name: "", urlPattern: "", trigger: "dom_change", intervalMinutes: undefined }} onChange={jest.fn()} />);
  expect(screen.queryByText("Rule name is required")).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/wizard/TriggerStep.test.tsx --verbose`
Expected: FAIL — no validation errors shown.

**Step 3: Update TriggerStep.tsx**

Add state tracking for which fields have been touched (blurred), and show validation errors for touched fields:

```tsx
import React, { useState } from "react";
import { TriggerType } from "@/lib/types";
import { validateRuleName, validateUrlPattern } from "@/lib/validators";

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
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const nameError = touched.name ? validateRuleName(data.name) : null;
  const urlError = touched.urlPattern ? validateUrlPattern(data.urlPattern) : null;

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
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          placeholder="e.g. Price Watcher"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {nameError && <p className="text-xs text-red-500 mt-0.5">{nameError}</p>}
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
          onBlur={() => setTouched((t) => ({ ...t, urlPattern: true }))}
          placeholder="e.g. https://example.com/*"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {urlError && <p className="text-xs text-red-500 mt-0.5">{urlError}</p>}
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

Run: `npx jest tests/popup/components/wizard/TriggerStep.test.tsx --verbose`
Expected: 8 tests PASS (5 original + 3 new).

**Step 5: Commit**

```bash
git add src/popup/components/wizard/TriggerStep.tsx tests/popup/components/wizard/TriggerStep.test.tsx
git commit -m "feat: add on-blur validation to TriggerStep"
```

---

### Task 3: Add validation to DestinationStep

**Files:**
- Modify: `src/popup/components/wizard/DestinationStep.tsx`
- Modify: `tests/popup/components/wizard/DestinationStep.test.tsx`

**Step 1: Write the failing test**

Add to `tests/popup/components/wizard/DestinationStep.test.tsx`:

```tsx
test("shows validation error for invalid webhook URL on blur", () => {
  render(<DestinationStep data={{ url: "not-a-url", label: "" }} onChange={jest.fn()} />);
  fireEvent.blur(screen.getByLabelText("Webhook URL"));
  expect(screen.getByText("Must be a valid URL (http:// or https://)")).toBeTruthy();
});

test("shows no error for valid https URL after blur", () => {
  render(<DestinationStep data={{ url: "https://hooks.slack.com/test", label: "" }} onChange={jest.fn()} />);
  fireEvent.blur(screen.getByLabelText("Webhook URL"));
  expect(screen.queryByText(/must be a valid/i)).toBeNull();
});

test("shows validation error for empty webhook URL on blur", () => {
  render(<DestinationStep data={{ url: "", label: "" }} onChange={jest.fn()} />);
  fireEvent.blur(screen.getByLabelText("Webhook URL"));
  expect(screen.getByText("Webhook URL is required")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/wizard/DestinationStep.test.tsx --verbose`
Expected: FAIL — no validation errors shown.

**Step 3: Update DestinationStep.tsx**

```tsx
import React, { useState } from "react";
import { validateWebhookUrl } from "@/lib/validators";

export interface DestinationStepData {
  url: string;
  label: string;
}

interface DestinationStepProps {
  data: DestinationStepData;
  onChange: (data: DestinationStepData) => void;
}

export function DestinationStep({ data, onChange }: DestinationStepProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const urlError = touched.url ? validateWebhookUrl(data.url) : null;

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
          onBlur={() => setTouched((t) => ({ ...t, url: true }))}
          placeholder="https://hooks.slack.com/services/..."
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {urlError && <p className="text-xs text-red-500 mt-0.5">{urlError}</p>}
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

Run: `npx jest tests/popup/components/wizard/DestinationStep.test.tsx --verbose`
Expected: 7 tests PASS (4 original + 3 new).

**Step 5: Commit**

```bash
git add src/popup/components/wizard/DestinationStep.tsx tests/popup/components/wizard/DestinationStep.test.tsx
git commit -m "feat: add webhook URL validation to DestinationStep"
```

---

### Task 4: Update wizard isStepValid to use validators

**Files:**
- Modify: `src/popup/components/wizard/CreateRuleWizard.tsx`

Currently `isStepValid` just checks non-empty. Update it to use the validator functions for consistency.

**Step 1: Update isStepValid**

```ts
import { validateRuleName, validateUrlPattern, validateWebhookUrl, validateSelector } from "@/lib/validators";

// In isStepValid():
const isStepValid = (): boolean => {
  if (step === 0) {
    return validateRuleName(trigger.name) === null && validateUrlPattern(trigger.urlPattern) === null;
  }
  if (showSelector && step === 1) {
    return validateSelector(selector.selector) === null;
  }
  const destStep = showSelector ? 2 : 1;
  if (step === destStep) {
    return validateWebhookUrl(destination.url) === null;
  }
  return true;
};
```

**Step 2: Run existing wizard tests**

Run: `npx jest tests/popup/components/wizard/CreateRuleWizard.test.tsx --verbose`
Expected: All 7 tests still pass.

**Step 3: Commit**

```bash
git add src/popup/components/wizard/CreateRuleWizard.tsx
git commit -m "refactor: use validator functions in wizard isStepValid"
```

---

### Task 5: Add edit button to RuleCard

**Files:**
- Modify: `src/popup/components/RuleCard.tsx`
- Modify: `tests/popup/components/RuleCard.test.tsx`

**Step 1: Write the failing test**

Add to `tests/popup/components/RuleCard.test.tsx`:

```tsx
test("calls onEdit with rule when edit button clicked", () => {
  const onEdit = jest.fn();
  render(<RuleCard rule={mockRule} onToggle={jest.fn()} onDelete={jest.fn()} onEdit={onEdit} />);
  fireEvent.click(screen.getByLabelText("Edit rule"));
  expect(onEdit).toHaveBeenCalledWith(mockRule);
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/RuleCard.test.tsx --verbose`
Expected: FAIL — onEdit prop doesn't exist.

**Step 3: Update RuleCard.tsx**

```tsx
import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Rule } from "@/lib/types";
import { Card } from "@/ui/Card";
import { Toggle } from "@/ui/Toggle";

interface RuleCardProps {
  rule: Rule;
  onToggle: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onEdit: (rule: Rule) => void;
}

export function RuleCard({ rule, onToggle, onDelete, onEdit }: RuleCardProps) {
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
            aria-label="Edit rule"
            onClick={() => onEdit(rule)}
            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
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

Note: Existing tests for RuleCard need to add the `onEdit` prop. Update the existing test renders to include `onEdit={jest.fn()}`.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/components/RuleCard.test.tsx --verbose`
Expected: 6 tests PASS (5 original + 1 new).

**Step 5: Commit**

```bash
git add src/popup/components/RuleCard.tsx tests/popup/components/RuleCard.test.tsx
git commit -m "feat: add edit button to RuleCard"
```

---

### Task 6: Update RuleList to propagate onEditRule

**Files:**
- Modify: `src/popup/components/RuleList.tsx`
- Modify: `tests/popup/components/RuleList.test.tsx`

**Step 1: Write the failing test**

Add to `tests/popup/components/RuleList.test.tsx`:

```tsx
test("calls onEditRule when edit button is clicked on a rule card", async () => {
  const mockRule = {
    id: "r1",
    name: "Test Rule",
    enabled: true,
    trigger: "dom_change" as const,
    urlPattern: "https://*",
    destination: { id: "d1", url: "https://hook.test", label: "Test" },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });

  const onEdit = jest.fn();
  render(<RuleList onCreateRule={jest.fn()} onEditRule={onEdit} />);
  await act(async () => {});

  fireEvent.click(screen.getByLabelText("Edit rule"));
  expect(onEdit).toHaveBeenCalledWith(mockRule);
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/RuleList.test.tsx --verbose`
Expected: FAIL — onEditRule prop doesn't exist.

**Step 3: Update RuleList.tsx**

```tsx
import React from "react";
import { Rule } from "@/lib/types";
import { useRules } from "@/popup/hooks/useRules";
import { RuleCard } from "@/popup/components/RuleCard";
import { Card } from "@/ui/Card";

interface RuleListProps {
  onCreateRule: () => void;
  onEditRule: (rule: Rule) => void;
}

export function RuleList({ onCreateRule, onEditRule }: RuleListProps) {
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
        <RuleCard key={rule.id} rule={rule} onToggle={toggleRule} onDelete={deleteRule} onEdit={onEditRule} />
      ))}
    </div>
  );
}
```

Note: Existing tests for RuleList need to add the `onEditRule` prop. Update the existing test renders to include `onEditRule={jest.fn()}`.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/components/RuleList.test.tsx --verbose`
Expected: 3 tests PASS (2 original + 1 new).

**Step 5: Commit**

```bash
git add src/popup/components/RuleList.tsx tests/popup/components/RuleList.test.tsx
git commit -m "feat: propagate onEditRule through RuleList"
```

---

### Task 7: Update CreateRuleWizard to support edit mode

**Files:**
- Modify: `src/popup/components/wizard/CreateRuleWizard.tsx`
- Modify: `tests/popup/components/wizard/CreateRuleWizard.test.tsx`

**Step 1: Write the failing test**

Add to `tests/popup/components/wizard/CreateRuleWizard.test.tsx`:

```tsx
const editRule: Rule = {
  id: "existing-rule-id",
  name: "Price Watch",
  enabled: true,
  trigger: "dom_change",
  urlPattern: "https://example.com/*",
  selector: "#price",
  destination: { id: "dest-id", url: "https://hooks.test/endpoint", label: "My Hook" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

test("pre-populates fields when editRule is provided", async () => {
  render(<CreateRuleWizard onDone={jest.fn()} editRule={editRule} />);
  await act(async () => {});

  // Step 0: Trigger — should show pre-filled name
  const nameInput = screen.getByLabelText("Rule name") as HTMLInputElement;
  expect(nameInput.value).toBe("Price Watch");
  const urlInput = screen.getByLabelText("URL pattern") as HTMLInputElement;
  expect(urlInput.value).toBe("https://example.com/*");
});

test("shows Update Rule button in edit mode on final step", async () => {
  const editRulePageVisit = {
    ...editRule,
    trigger: "page_visit" as const,
    selector: undefined,
  };
  render(<CreateRuleWizard onDone={jest.fn()} editRule={editRulePageVisit} />);
  await act(async () => {});

  // Fill step 0 and go to destination
  fireEvent.click(screen.getByText("Next"));
  expect(screen.getByText("Update Rule")).toBeTruthy();
});

test("preserves original id and createdAt when saving edited rule", async () => {
  const editRulePageVisit = {
    ...editRule,
    trigger: "page_visit" as const,
    selector: undefined,
  };
  render(<CreateRuleWizard onDone={jest.fn()} editRule={editRulePageVisit} />);
  await act(async () => {});

  fireEvent.click(screen.getByText("Next"));

  await act(async () => {
    fireEvent.click(screen.getByText("Update Rule"));
  });

  // Verify the saved rule preserves original id
  const savedCall = (chrome.storage.local.set as jest.Mock).mock.calls.find(
    (call: any[]) => call[0].rules
  );
  expect(savedCall).toBeTruthy();
  const savedRules = savedCall[0].rules;
  expect(savedRules[0].id).toBe("existing-rule-id");
  expect(savedRules[0].createdAt).toBe("2026-01-01T00:00:00Z");
});
```

Import `Rule` at the top of the test file:
```tsx
import { Rule } from "@/lib/types";
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/wizard/CreateRuleWizard.test.tsx --verbose`
Expected: FAIL — editRule prop doesn't exist.

**Step 3: Update CreateRuleWizard.tsx**

Key changes:
1. Accept optional `editRule?: Rule` prop
2. Initialize state from `editRule` when provided (takes priority over `pendingWizardState`)
3. On save: preserve `id`/`createdAt` from `editRule`, only update `updatedAt`
4. Show "Update Rule" button text instead of "Save Rule" in edit mode

Update the interface:
```tsx
interface CreateRuleWizardProps {
  onDone: () => void;
  editRule?: Rule;
}
```

Update the component signature and state initialization:
```tsx
export function CreateRuleWizard({ onDone, editRule }: CreateRuleWizardProps) {
  const isEdit = !!editRule;

  const [step, setStep] = useState(0);
  const [trigger, setTrigger] = useState<TriggerStepData>(() =>
    editRule
      ? {
          name: editRule.name,
          urlPattern: editRule.urlPattern,
          trigger: editRule.trigger,
          intervalMinutes: editRule.intervalMinutes,
        }
      : { name: "", urlPattern: "", trigger: "dom_change", intervalMinutes: undefined }
  );
  const [selector, setSelector] = useState<SelectorStepData>(() =>
    editRule?.selector ? { selector: editRule.selector } : { selector: "" }
  );
  const [destination, setDestination] = useState<DestinationStepData>(() =>
    editRule
      ? { url: editRule.destination.url, label: editRule.destination.label }
      : { url: "", label: "" }
  );
```

Update the `useEffect` to skip loading wizard state when editing:
```tsx
  useEffect(() => {
    if (isEdit) {
      setLoaded(true);
      return;
    }
    // ... existing loading logic ...
  }, []);
```

Update `handleSave`:
```tsx
  const handleSave = async () => {
    const now = new Date().toISOString();
    const rule: Rule = {
      id: editRule?.id ?? crypto.randomUUID(),
      name: trigger.name,
      enabled: editRule?.enabled ?? true,
      trigger: trigger.trigger,
      urlPattern: trigger.urlPattern,
      selector: showSelector ? selector.selector : undefined,
      intervalMinutes: trigger.intervalMinutes,
      destination: {
        id: editRule?.destination.id ?? crypto.randomUUID(),
        url: destination.url,
        label: destination.label || destination.url,
      },
      createdAt: editRule?.createdAt ?? now,
      updatedAt: now,
    };
    await StorageHelper.saveRule(rule);
    await clearWizardState();
    onDone();
  };
```

Update Save button text:
```tsx
  <Button size="sm" onClick={handleSave} disabled={!isStepValid()}>
    {isEdit ? "Update Rule" : "Save Rule"}
  </Button>
```

**Step 4: Run test to verify all pass**

Run: `npx jest tests/popup/components/wizard/CreateRuleWizard.test.tsx --verbose`
Expected: 10 tests PASS (7 existing + 3 new).

**Step 5: Commit**

```bash
git add src/popup/components/wizard/CreateRuleWizard.tsx tests/popup/components/wizard/CreateRuleWizard.test.tsx
git commit -m "feat: support editing existing rules in wizard"
```

---

### Task 8: Wire up App.tsx for edit view

**Files:**
- Modify: `src/popup/App.tsx`
- Modify: `tests/popup/App.test.tsx`

**Step 1: Write the failing test**

Add to `tests/popup/App.test.tsx`:

```tsx
test("opens wizard in edit mode when rule edit button clicked", async () => {
  const mockRule = {
    id: "r1",
    name: "Price Watch",
    enabled: true,
    trigger: "dom_change" as const,
    urlPattern: "https://example.com/*",
    selector: "#price",
    destination: { id: "d1", url: "https://hook.test", label: "Test Hook" },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
    if (key === "rules") return Promise.resolve({ rules: [mockRule] });
    return Promise.resolve({});
  });

  render(<App />);
  await act(async () => {});

  // Click edit on the rule
  fireEvent.click(screen.getByLabelText("Edit rule"));
  await act(async () => {});

  // Wizard should show pre-filled rule name
  const nameInput = screen.getByLabelText("Rule name") as HTMLInputElement;
  expect(nameInput.value).toBe("Price Watch");
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/App.test.tsx --verbose`
Expected: FAIL — edit flow not wired up.

**Step 3: Update App.tsx**

```tsx
import React, { useEffect, useState } from "react";
import { Webhook, Plus, List, ScrollText } from "lucide-react";
import { Rule } from "@/lib/types";
import { Button } from "@/ui/Button";
import { RuleList } from "@/popup/components/RuleList";
import { LogList } from "@/popup/components/LogList";
import { CreateRuleWizard } from "@/popup/components/wizard/CreateRuleWizard";
import { loadWizardState } from "@/popup/hooks/useWizardPersistence";

type View = "rules" | "create" | "edit" | "logs";

export function App() {
  const [view, setView] = useState<View>("rules");
  const [editingRule, setEditingRule] = useState<Rule | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const savedState = await loadWizardState();
      const pending = await chrome.storage.local.get("pendingSelection");
      if (savedState || pending.pendingSelection) {
        setView("create");
      }
    })();
  }, []);

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule);
    setView("edit");
  };

  const handleWizardDone = () => {
    setEditingRule(undefined);
    setView("rules");
  };

  const showWizard = view === "create" || view === "edit";

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">BrowserHook</h1>
        </div>
        <div className="flex items-center gap-1">
          {!showWizard && (
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
          {showWizard && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="View rules"
              onClick={handleWizardDone}
            >
              <List className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {view === "rules" && <RuleList onCreateRule={() => setView("create")} onEditRule={handleEditRule} />}
      {view === "create" && <CreateRuleWizard onDone={handleWizardDone} />}
      {view === "edit" && <CreateRuleWizard onDone={handleWizardDone} editRule={editingRule} />}
      {view === "logs" && <LogList />}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/App.test.tsx --verbose`
Expected: 6 tests PASS (5 existing + 1 new).

**Step 5: Commit**

```bash
git add src/popup/App.tsx tests/popup/App.test.tsx
git commit -m "feat: wire up rule editing in App.tsx"
```

---

### Task 9: Full verification

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
