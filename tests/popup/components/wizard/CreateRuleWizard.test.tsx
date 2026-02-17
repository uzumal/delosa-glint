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
