import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CreateRuleWizard } from "@/popup/components/wizard/CreateRuleWizard";
import { Rule } from "@/lib/types";

// Mock crypto.randomUUID
Object.defineProperty(globalThis, "crypto", {
  value: { randomUUID: () => "test-uuid-123" },
});

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
  (chrome.storage.local.remove as jest.Mock).mockReset();
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);
});

test("renders step 1 (Trigger) initially", async () => {
  render(<CreateRuleWizard onDone={jest.fn()} />);
  await act(async () => {});
  expect(screen.getByLabelText("Rule name")).toBeTruthy();
  expect(screen.getByLabelText("URL pattern")).toBeTruthy();
});

test("Next button advances to step 2 when trigger needs selector", async () => {
  render(<CreateRuleWizard onDone={jest.fn()} />);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Test" } });
  fireEvent.change(screen.getByLabelText("URL pattern"), { target: { value: "https://*" } });
  fireEvent.click(screen.getByText("Next"));
  // Step 2 shows CSS Selector input
  expect(screen.getByLabelText("CSS Selector")).toBeTruthy();
});

test("skips step 2 for page_visit trigger", async () => {
  render(<CreateRuleWizard onDone={jest.fn()} />);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Test" } });
  fireEvent.change(screen.getByLabelText("URL pattern"), { target: { value: "https://*" } });
  fireEvent.click(screen.getByLabelText("Page Visit"));
  fireEvent.click(screen.getByText("Next"));
  // Should skip to step 3 — destination
  expect(screen.getByLabelText("Webhook URL")).toBeTruthy();
});

test("Back button returns to previous step", async () => {
  render(<CreateRuleWizard onDone={jest.fn()} />);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Test" } });
  fireEvent.change(screen.getByLabelText("URL pattern"), { target: { value: "https://*" } });
  fireEvent.click(screen.getByText("Next"));
  fireEvent.click(screen.getByText("Back"));
  expect(screen.getByLabelText("Rule name")).toBeTruthy();
});

test("Save button calls onDone after saving rule", async () => {
  const onDone = jest.fn();
  render(<CreateRuleWizard onDone={onDone} />);
  await act(async () => {});

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

test("restores wizard state from storage on mount", async () => {
  (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
    if (key === "pendingWizardState") {
      return Promise.resolve({
        pendingWizardState: {
          step: 1,
          trigger: { name: "Price Watch", urlPattern: "https://example.com/*", trigger: "dom_change", intervalMinutes: undefined },
          selector: { selector: "#price" },
          destination: { type: "generic", url: "", label: "" },
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
          destination: { type: "generic", url: "", label: "" },
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

const editRule: Rule = {
  id: "existing-rule-id",
  name: "Price Watch",
  enabled: true,
  trigger: "dom_change",
  urlPattern: "https://example.com/*",
  selector: "#price",
  destination: { id: "dest-id", type: "generic", url: "https://hooks.test/endpoint", label: "My Hook" },
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
  const editRulePageVisit: Rule = {
    ...editRule,
    trigger: "page_visit",
    selector: undefined,
  };
  render(<CreateRuleWizard onDone={jest.fn()} editRule={editRulePageVisit} />);
  await act(async () => {});

  // Fill step 0 and go to destination
  fireEvent.click(screen.getByText("Next"));
  expect(screen.getByText("Update Rule")).toBeTruthy();
});

test("preserves original id and createdAt when saving edited rule", async () => {
  const editRulePageVisit: Rule = {
    ...editRule,
    trigger: "page_visit",
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

test("editing a rule replaces it in storage, not duplicates it", async () => {
  const existingRule: Rule = { ...editRule };

  // Mock get to return existing rules when saveRule reads them
  (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
    if (key === "rules") return Promise.resolve({ rules: [existingRule] });
    return Promise.resolve({});
  });

  render(<CreateRuleWizard onDone={jest.fn()} editRule={existingRule} />);
  await act(async () => {});

  // Modify name
  fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Updated Name" } });

  // Navigate to selector step
  fireEvent.click(screen.getByText("Next"));
  // Navigate to destination step
  fireEvent.click(screen.getByText("Next"));

  await act(async () => {
    fireEvent.click(screen.getByText("Update Rule"));
  });

  // Find the set call that wrote rules
  const savedCall = (chrome.storage.local.set as jest.Mock).mock.calls.find(
    (call: any[]) => call[0].rules
  );
  expect(savedCall).toBeTruthy();

  // CRITICAL: should be exactly 1 rule (replaced), not 2 (duplicated)
  const savedRules = savedCall[0].rules;
  expect(savedRules).toHaveLength(1);
  expect(savedRules[0].id).toBe("existing-rule-id");
  expect(savedRules[0].name).toBe("Updated Name");
});
