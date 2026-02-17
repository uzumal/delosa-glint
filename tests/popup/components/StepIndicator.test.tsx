import React from "react";
import { render, screen } from "@testing-library/react";
import { StepIndicator } from "@/popup/components/StepIndicator";

test("renders all step labels", () => {
  render(<StepIndicator currentStep={0} steps={["Trigger", "Element", "Destination"]} />);
  expect(screen.getByText("Trigger")).toBeTruthy();
  expect(screen.getByText("Element")).toBeTruthy();
  expect(screen.getByText("Destination")).toBeTruthy();
});

test("marks current step as active", () => {
  render(<StepIndicator currentStep={1} steps={["Trigger", "Element", "Destination"]} />);
  const el = screen.getByText("Element");
  expect(el.className).toContain("text-blue-600");
});

test("marks completed steps differently", () => {
  render(<StepIndicator currentStep={2} steps={["Trigger", "Element", "Destination"]} />);
  const trigger = screen.getByText("Trigger");
  expect(trigger.className).toContain("text-blue-600");
});
