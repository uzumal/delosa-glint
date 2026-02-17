import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

test("shows error when active tab is a chrome:// URL", async () => {
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
