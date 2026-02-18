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
  destination: { id: "d1", type: "generic", url: "https://hooks.example.com/webhook", label: "My Hook" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

test("renders rule name and trigger type", () => {
  render(<RuleCard rule={mockRule} onToggle={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} />);
  expect(screen.getByText("Price Watcher")).toBeTruthy();
  expect(screen.getByText("dom_change")).toBeTruthy();
});

test("renders destination URL", () => {
  render(<RuleCard rule={mockRule} onToggle={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} />);
  expect(screen.getByText("My Hook")).toBeTruthy();
});

test("calls onToggle with rule id when toggle clicked", () => {
  const onToggle = jest.fn();
  render(<RuleCard rule={mockRule} onToggle={onToggle} onDelete={jest.fn()} onEdit={jest.fn()} />);
  fireEvent.click(screen.getByRole("switch"));
  expect(onToggle).toHaveBeenCalledWith("r1");
});

test("calls onDelete with rule id when delete clicked", () => {
  const onDelete = jest.fn();
  render(<RuleCard rule={mockRule} onToggle={jest.fn()} onDelete={onDelete} onEdit={jest.fn()} />);
  fireEvent.click(screen.getByLabelText("Delete rule"));
  expect(onDelete).toHaveBeenCalledWith("r1");
});

test("shows disabled styling when rule is disabled", () => {
  const disabled = { ...mockRule, enabled: false };
  render(<RuleCard rule={disabled} onToggle={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} />);
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
});

test("calls onEdit with rule when edit button clicked", () => {
  const onEdit = jest.fn();
  render(<RuleCard rule={mockRule} onToggle={jest.fn()} onDelete={jest.fn()} onEdit={onEdit} />);
  fireEvent.click(screen.getByLabelText("Edit rule"));
  expect(onEdit).toHaveBeenCalledWith(mockRule);
});
