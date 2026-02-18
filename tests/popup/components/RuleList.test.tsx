import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RuleList } from "@/popup/components/RuleList";
import { Rule } from "@/lib/types";

const mockRule: Rule = {
  id: "r1",
  name: "Price Watcher",
  enabled: true,
  trigger: "dom_change",
  urlPattern: "https://example.com/*",
  selector: "#price",
  destination: { id: "d1", type: "generic", url: "https://hooks.example.com/webhook", label: "My Hook" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
});

test("shows empty state when no rules", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  render(<RuleList onCreateRule={jest.fn()} onEditRule={jest.fn()} />);
  await act(async () => {});
  expect(screen.getByText(/no rules yet/i)).toBeTruthy();
});

test("renders rule cards when rules exist", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });
  render(<RuleList onCreateRule={jest.fn()} onEditRule={jest.fn()} />);
  await act(async () => {});
  expect(screen.getByText("Price Watcher")).toBeTruthy();
});

test("calls onEditRule when edit button is clicked on a rule card", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ rules: [mockRule] });

  const onEdit = jest.fn();
  render(<RuleList onCreateRule={jest.fn()} onEditRule={onEdit} />);
  await act(async () => {});

  fireEvent.click(screen.getByLabelText("Edit rule"));
  expect(onEdit).toHaveBeenCalledWith(mockRule);
});
