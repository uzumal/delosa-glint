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
