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
