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
