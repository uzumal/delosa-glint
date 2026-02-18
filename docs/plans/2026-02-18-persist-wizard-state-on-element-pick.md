# Persist Wizard State During Element Pick Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the "popup disappears and wizard resets" problem when using Pick Element. Save wizard state to `chrome.storage.local` before closing the popup, then restore it when the popup reopens. Also add element preview (innerHTML snippet) to ELEMENT_SELECTED so users can see what content they're monitoring.

**Architecture:** Before `window.close()`, serialize the entire wizard state (step, trigger data, selector data, destination data) to `chrome.storage.local` as `pendingWizardState`. On popup open, if `pendingWizardState` exists, restore it into the wizard. The content script `selector.ts` is enhanced to also capture a text preview of the picked element. The observer already monitors subtrees correctly (`subtree: true` + `element.textContent` captures all descendant text).

**Tech Stack:** Jest 27, ts-jest, jsdom, React 19, TypeScript 5, Chrome Extension APIs.

---

## Analysis of the 3 issues

### Issue 1: Popup closes and wizard resets (BUG — fix required)
Current flow:
1. User opens popup → creates wizard → fills in name, URL pattern, trigger type
2. Clicks "Pick Element" → `window.close()` is called → **all React state destroyed**
3. Content script injects, user picks element → `ELEMENT_SELECTED` → stored as `pendingSelection`
4. User reopens popup → `pendingSelection` is read but wizard starts fresh (name, URL pattern, destination all empty)

**Fix:** Save full wizard state before closing, restore on reopen.

### Issue 2: Subtree monitoring for div elements (ALREADY WORKING)
The observer already uses:
```ts
observer.observe(element, { childList: true, characterData: true, subtree: true });
```
And `element.textContent` captures all descendant text. If a user picks a `<div>`, any change to any child element's text will trigger the mutation. **No code change needed.**

However, we should enhance the element picker to show a **text preview** of what will be monitored, so users can verify they're picking the right container.

### Issue 3: Snapshot persistence across page reloads (ALREADY WORKING)
In the previous plan we added `StorageHelper.getSnapshot/saveSnapshot` which persists to `chrome.storage.local`. This survives page reloads **and** Chrome restarts. The `DOMWatcher.observeElement` loads saved snapshots on startup and compares. **No code change needed.**

---

### Task 1: Save wizard state before closing popup

**Files:**
- Create: `src/popup/hooks/useWizardPersistence.ts`
- Create: `tests/popup/hooks/useWizardPersistence.test.ts`

A hook that saves/loads wizard state to `chrome.storage.local`.

**Step 1: Write the failing test**

```ts
// tests/popup/hooks/useWizardPersistence.test.ts
import { saveWizardState, loadWizardState, clearWizardState, WizardState } from "@/popup/hooks/useWizardPersistence";

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
  (chrome.storage.local.remove as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);
});

const mockState: WizardState = {
  step: 1,
  trigger: { name: "Price Watch", urlPattern: "https://example.com/*", trigger: "dom_change", intervalMinutes: undefined },
  selector: { selector: "" },
  destination: { url: "", label: "" },
};

test("saveWizardState stores state to chrome.storage.local", async () => {
  await saveWizardState(mockState);
  expect(chrome.storage.local.set).toHaveBeenCalledWith({ pendingWizardState: mockState });
});

test("loadWizardState returns null when nothing stored", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  expect(await loadWizardState()).toBeNull();
});

test("loadWizardState returns saved state", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ pendingWizardState: mockState });
  expect(await loadWizardState()).toEqual(mockState);
});

test("clearWizardState removes stored state", async () => {
  await clearWizardState();
  expect(chrome.storage.local.remove).toHaveBeenCalledWith("pendingWizardState");
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/hooks/useWizardPersistence.test.ts --verbose`
Expected: FAIL — module not found.

**Step 3: Write implementation**

```ts
// src/popup/hooks/useWizardPersistence.ts
import { TriggerStepData } from "@/popup/components/wizard/TriggerStep";
import { SelectorStepData } from "@/popup/components/wizard/SelectorStep";
import { DestinationStepData } from "@/popup/components/wizard/DestinationStep";

export interface WizardState {
  step: number;
  trigger: TriggerStepData;
  selector: SelectorStepData;
  destination: DestinationStepData;
}

export async function saveWizardState(state: WizardState): Promise<void> {
  await chrome.storage.local.set({ pendingWizardState: state });
}

export async function loadWizardState(): Promise<WizardState | null> {
  const result = await chrome.storage.local.get("pendingWizardState");
  return (result.pendingWizardState as WizardState | undefined) ?? null;
}

export async function clearWizardState(): Promise<void> {
  await chrome.storage.local.remove("pendingWizardState");
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/hooks/useWizardPersistence.test.ts --verbose`
Expected: 4 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/hooks/useWizardPersistence.ts tests/popup/hooks/useWizardPersistence.test.ts
git commit -m "feat: add wizard state persistence helpers"
```

---

### Task 2: Update SelectorStep to save wizard state before closing

**Files:**
- Modify: `src/popup/components/wizard/SelectorStep.tsx`
- Modify: `tests/popup/components/wizard/SelectorStep.test.tsx`

Remove `window.close()` from SelectorStep. Instead, save state and close from the parent (CreateRuleWizard). SelectorStep just signals that picking should begin.

**Step 1: Update SelectorStep to accept onPickElement callback**

Change `SelectorStep` to accept an `onPickElement` callback prop instead of managing tab injection itself. This gives the parent (CreateRuleWizard) control to save state before closing.

Updated `SelectorStepProps`:
```ts
interface SelectorStepProps {
  data: SelectorStepData;
  onChange: (data: SelectorStepData) => void;
  onPickElement?: () => void;
  pickError?: string | null;
}
```

Updated SelectorStep.tsx (full file):
```tsx
import React from "react";
import { Crosshair } from "lucide-react";
import { Button } from "@/ui/Button";

export interface SelectorStepData {
  selector: string;
}

interface SelectorStepProps {
  data: SelectorStepData;
  onChange: (data: SelectorStepData) => void;
  onPickElement?: () => void;
  pickError?: string | null;
}

export function SelectorStep({ data, onChange, onPickElement, pickError }: SelectorStepProps) {
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
        <Button variant="secondary" size="sm" onClick={onPickElement}>
          <Crosshair className="w-3.5 h-3.5 mr-1" />
          Pick Element
        </Button>
      </div>

      {pickError && (
        <p className="text-xs text-red-500 text-center">{pickError}</p>
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

**Step 2: Update test**

Update `tests/popup/components/wizard/SelectorStep.test.tsx`:

- Remove the `chrome.tabs` mock from beforeEach (SelectorStep no longer uses chrome.tabs)
- Replace the chrome:// URL test with a test for `onPickElement` callback
- Keep the existing rendering/onChange tests

```tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectorStep, SelectorStepData } from "@/popup/components/wizard/SelectorStep";

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

test("calls onPickElement when Pick Element button clicked", () => {
  const onPick = jest.fn();
  render(<SelectorStep data={defaults} onChange={jest.fn()} onPickElement={onPick} />);
  fireEvent.click(screen.getByText("Pick Element"));
  expect(onPick).toHaveBeenCalledTimes(1);
});

test("shows pickError when provided", () => {
  render(<SelectorStep data={defaults} onChange={jest.fn()} pickError="Cannot pick on this page" />);
  expect(screen.getByText("Cannot pick on this page")).toBeTruthy();
});
```

**Step 3: Run test to verify it passes**

Run: `npx jest tests/popup/components/wizard/SelectorStep.test.tsx --verbose`
Expected: 6 tests PASS.

**Step 4: Commit**

```bash
git add src/popup/components/wizard/SelectorStep.tsx tests/popup/components/wizard/SelectorStep.test.tsx
git commit -m "refactor: move pick element logic out of SelectorStep into parent"
```

---

### Task 3: Update CreateRuleWizard to persist state and handle pick flow

**Files:**
- Modify: `src/popup/components/wizard/CreateRuleWizard.tsx`
- Modify: `tests/popup/components/wizard/CreateRuleWizard.test.tsx`

The wizard now:
1. On mount: loads `pendingWizardState` → restores step/trigger/selector/destination
2. Also loads `pendingSelection` → merges into selector
3. On "Pick Element": saves wizard state → injects selector → closes popup
4. On "Save Rule" or "Cancel": clears `pendingWizardState`

**Step 1: Add test for state restoration**

Add to `tests/popup/components/wizard/CreateRuleWizard.test.tsx`:

```tsx
test("restores wizard state from storage on mount", async () => {
  (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
    if (key === "pendingWizardState") {
      return Promise.resolve({
        pendingWizardState: {
          step: 1,
          trigger: { name: "Price Watch", urlPattern: "https://example.com/*", trigger: "dom_change", intervalMinutes: undefined },
          selector: { selector: "#price" },
          destination: { url: "", label: "" },
        },
      });
    }
    if (key === "pendingSelection") return Promise.resolve({});
    return Promise.resolve({});
  });

  render(<CreateRuleWizard onDone={jest.fn()} />);
  await act(async () => {});

  // Should be on step 1 (Element) with the selector pre-filled
  expect(screen.getByLabelText("CSS Selector")).toBeTruthy();
  const input = screen.getByLabelText("CSS Selector") as HTMLInputElement;
  expect(input.value).toBe("#price");
});

test("merges pendingSelection into restored wizard state", async () => {
  (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
    if (key === "pendingWizardState") {
      return Promise.resolve({
        pendingWizardState: {
          step: 1,
          trigger: { name: "Price Watch", urlPattern: "https://example.com/*", trigger: "dom_change", intervalMinutes: undefined },
          selector: { selector: "" },
          destination: { url: "", label: "" },
        },
      });
    }
    if (key === "pendingSelection") {
      return Promise.resolve({ pendingSelection: { selector: ".picked-element", url: "https://example.com" } });
    }
    return Promise.resolve({});
  });

  render(<CreateRuleWizard onDone={jest.fn()} />);
  await act(async () => {});

  const input = screen.getByLabelText("CSS Selector") as HTMLInputElement;
  expect(input.value).toBe(".picked-element");
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/components/wizard/CreateRuleWizard.test.tsx --verbose`
Expected: FAIL — wizard doesn't restore state yet.

**Step 3: Update CreateRuleWizard.tsx**

Key changes:
1. On mount, load `pendingWizardState` and `pendingSelection`
2. Move the pick element flow into the wizard (URL check, save state, inject, close)
3. Pass `onPickElement` and `pickError` to SelectorStep
4. Clear wizard state on save/cancel

```tsx
import React, { useCallback, useEffect, useState } from "react";
import { Rule } from "@/lib/types";
import { StorageHelper } from "@/lib/storage";
import { isInjectableUrl } from "@/lib/url-utils";
import { Button } from "@/ui/Button";
import { StepIndicator } from "@/popup/components/StepIndicator";
import { TriggerStep, TriggerStepData } from "./TriggerStep";
import { SelectorStep, SelectorStepData } from "./SelectorStep";
import { DestinationStep, DestinationStepData } from "./DestinationStep";
import { saveWizardState, loadWizardState, clearWizardState } from "@/popup/hooks/useWizardPersistence";

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
  const [pickError, setPickError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const showSelector = needsSelector(trigger.trigger);
  const steps = showSelector ? STEPS_WITH_SELECTOR : STEPS_WITHOUT_SELECTOR;
  const lastStep = steps.length - 1;

  // Restore wizard state and pending selection on mount
  useEffect(() => {
    (async () => {
      const savedState = await loadWizardState();
      if (savedState) {
        setStep(savedState.step);
        setTrigger(savedState.trigger);
        setSelector(savedState.selector);
        setDestination(savedState.destination);
      }

      // Check for pending selection from visual picker
      const result = await chrome.storage.local.get("pendingSelection");
      const pending = result.pendingSelection as { selector: string; url: string } | undefined;
      if (pending?.selector) {
        setSelector({ selector: pending.selector });
        await chrome.storage.local.remove("pendingSelection");
      }

      // Clear wizard state now that we've loaded it
      await clearWizardState();
      setLoaded(true);
    })();
  }, []);

  const handlePickElement = useCallback(async () => {
    setPickError(null);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (!isInjectableUrl(tab.url)) {
      setPickError("Cannot pick elements on this page. Navigate to a regular web page first.");
      return;
    }

    // Save wizard state before closing
    await saveWizardState({ step, trigger, selector, destination });

    await chrome.runtime.sendMessage({ type: "INJECT_SELECTOR", payload: { tabId: tab.id } });
    await chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_SELECTOR" });
    window.close();
  }, [step, trigger, selector, destination]);

  const handleNext = () => {
    if (step < lastStep) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleCancel = async () => {
    await clearWizardState();
    onDone();
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
    await clearWizardState();
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
      return (
        <SelectorStep
          data={selector}
          onChange={setSelector}
          onPickElement={handlePickElement}
          pickError={pickError}
        />
      );
    }
    return <DestinationStep data={destination} onChange={setDestination} />;
  };

  if (!loaded) return null;

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
          <Button variant="secondary" size="sm" onClick={handleCancel}>
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

**Step 4: Run test to verify all pass**

Run: `npx jest tests/popup/components/wizard/CreateRuleWizard.test.tsx --verbose`
Expected: 7 tests PASS (5 original + 2 new).

**Step 5: Commit**

```bash
git add src/popup/components/wizard/CreateRuleWizard.tsx tests/popup/components/wizard/CreateRuleWizard.test.tsx
git commit -m "feat: persist wizard state across popup close/reopen during element pick"
```

---

### Task 4: Update App.tsx to auto-open wizard when pending state exists

**Files:**
- Modify: `src/popup/App.tsx`
- Modify: `tests/popup/App.test.tsx`

When the popup opens and there's a `pendingWizardState` or `pendingSelection` in storage, automatically switch to the "create" view.

**Step 1: Add test**

Add to `tests/popup/App.test.tsx`:

```tsx
test("auto-opens wizard when pendingWizardState exists", async () => {
  (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
    if (key === "pendingWizardState") {
      return Promise.resolve({
        pendingWizardState: {
          step: 1,
          trigger: { name: "Test", urlPattern: "*", trigger: "dom_change", intervalMinutes: undefined },
          selector: { selector: "" },
          destination: { url: "", label: "" },
        },
      });
    }
    if (key === "pendingSelection") return Promise.resolve({});
    return Promise.resolve({});
  });

  render(<App />);
  await act(async () => {});

  // Should auto-open the wizard (showing the CSS Selector field)
  expect(screen.getByLabelText("CSS Selector")).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/popup/App.test.tsx --verbose`
Expected: FAIL — App starts at rules view.

**Step 3: Update App.tsx**

Add an effect that checks for pending wizard state on mount:

```tsx
import React, { useEffect, useState } from "react";
import { Webhook, Plus, List, ScrollText } from "lucide-react";
import { Button } from "@/ui/Button";
import { RuleList } from "@/popup/components/RuleList";
import { LogList } from "@/popup/components/LogList";
import { CreateRuleWizard } from "@/popup/components/wizard/CreateRuleWizard";
import { loadWizardState } from "@/popup/hooks/useWizardPersistence";

type View = "rules" | "create" | "logs";

export function App() {
  const [view, setView] = useState<View>("rules");

  useEffect(() => {
    (async () => {
      const savedState = await loadWizardState();
      const pending = await chrome.storage.local.get("pendingSelection");
      if (savedState || pending.pendingSelection) {
        setView("create");
      }
    })();
  }, []);

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

**Step 4: Run test to verify it passes**

Run: `npx jest tests/popup/App.test.tsx --verbose`
Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add src/popup/App.tsx tests/popup/App.test.tsx
git commit -m "feat: auto-open wizard when returning from element pick"
```

---

### Task 5: Enhance ELEMENT_SELECTED to include text preview

**Files:**
- Modify: `src/content/selector.ts`
- Modify: `src/background/service-worker.ts`

When an element is picked, send a text preview (first 200 chars of textContent) so the wizard can show what the user is monitoring.

**Step 1: Update selector.ts**

In `onClick`, capture a textPreview:

```ts
  private onClick = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    if (!this.highlightedElement) return;

    const selector = SelectorGenerator.generate(this.highlightedElement);
    const textContent = this.highlightedElement.textContent ?? "";
    const textPreview = textContent.trim().substring(0, 200);

    chrome.runtime.sendMessage({
      type: "ELEMENT_SELECTED",
      payload: { selector, textPreview, url: window.location.href },
    });

    this.deactivate();
  };
```

**Step 2: Update service worker's handleElementSelected**

Store textPreview in `pendingSelection`:

```ts
async function handleElementSelected(payload: {
  selector: string;
  textPreview?: string;
  url: string;
}): Promise<unknown> {
  await chrome.storage.local.set({ pendingSelection: payload });
  return { success: true };
}
```

**Step 3: Update SelectorStep to show preview**

Add to `SelectorStepData`:
```ts
export interface SelectorStepData {
  selector: string;
  textPreview?: string;
}
```

Update `SelectorStep` to show preview when available:
```tsx
{data.selector && (
  <div className="bg-gray-50 rounded p-2">
    <p className="text-xs text-gray-500">Selected:</p>
    <code className="text-xs text-blue-700 break-all">{data.selector}</code>
    {data.textPreview && (
      <p className="text-xs text-gray-400 mt-1 truncate">Preview: {data.textPreview}</p>
    )}
  </div>
)}
```

Update CreateRuleWizard to merge textPreview:
```ts
if (pending?.selector) {
  setSelector({ selector: pending.selector, textPreview: pending.textPreview });
}
```

**Step 4: Run build**

Run: `npm run build`
Expected: compiled successfully.

**Step 5: Commit**

```bash
git add src/content/selector.ts src/background/service-worker.ts src/popup/components/wizard/SelectorStep.tsx src/popup/components/wizard/CreateRuleWizard.tsx
git commit -m "feat: show text preview of picked element in wizard"
```

---

### Task 6: Full verification

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
