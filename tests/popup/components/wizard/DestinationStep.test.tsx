import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DestinationStep, DestinationStepData } from "@/popup/components/wizard/DestinationStep";

const defaults: DestinationStepData = { url: "", label: "" };

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
  expect(onChange).toHaveBeenCalledWith({ url: "https://hooks.example.com/test", label: "" });
});

test("calls onChange when label is typed", () => {
  const onChange = jest.fn();
  render(<DestinationStep data={defaults} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Label"), { target: { value: "My Slack" } });
  expect(onChange).toHaveBeenCalledWith({ url: "", label: "My Slack" });
});
