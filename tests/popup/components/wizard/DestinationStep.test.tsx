import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DestinationStep, DestinationStepData } from "@/popup/components/wizard/DestinationStep";

const defaults: DestinationStepData = { type: "generic", url: "", label: "" };

test("renders webhook URL input", () => {
  render(<DestinationStep data={defaults} onChange={jest.fn()} />);
  expect(screen.getByLabelText("Webhook URL")).toBeTruthy();
});

test("renders label input", () => {
  render(<DestinationStep data={defaults} onChange={jest.fn()} />);
  expect(screen.getByLabelText("Label")).toBeTruthy();
});

test("calls onChange when URL is typed", () => {
  const onChange = jest.fn();
  render(<DestinationStep data={defaults} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Webhook URL"), {
    target: { value: "https://hooks.example.com/test" },
  });
  expect(onChange).toHaveBeenCalledWith({ type: "generic", url: "https://hooks.example.com/test", label: "" });
});

test("calls onChange when label is typed", () => {
  const onChange = jest.fn();
  render(<DestinationStep data={defaults} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Label"), { target: { value: "My Slack" } });
  expect(onChange).toHaveBeenCalledWith({ type: "generic", url: "", label: "My Slack" });
});

test("shows validation error for invalid webhook URL on blur", () => {
  render(<DestinationStep data={{ type: "generic", url: "not-a-url", label: "" }} onChange={jest.fn()} />);
  fireEvent.blur(screen.getByLabelText("Webhook URL"));
  expect(screen.getByText("Must be a valid URL (http:// or https://)")).toBeTruthy();
});

test("shows no error for valid https URL after blur", () => {
  render(<DestinationStep data={{ type: "generic", url: "https://hooks.slack.com/test", label: "" }} onChange={jest.fn()} />);
  fireEvent.blur(screen.getByLabelText("Webhook URL"));
  expect(screen.queryByText(/must be a valid/i)).toBeNull();
});

test("shows validation error for empty webhook URL on blur", () => {
  render(<DestinationStep data={{ type: "generic", url: "", label: "" }} onChange={jest.fn()} />);
  fireEvent.blur(screen.getByLabelText("Webhook URL"));
  expect(screen.getByText("Webhook URL is required")).toBeTruthy();
});
