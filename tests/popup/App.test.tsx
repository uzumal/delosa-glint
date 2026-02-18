import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { App } from "@/popup/App";

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
  (chrome.storage.local.remove as jest.Mock).mockReset();
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);
});

test("renders Delosa Glint header", async () => {
  render(<App />);
  await act(async () => {});
  expect(screen.getByText("Delosa Glint")).toBeTruthy();
});

test("shows rule list by default", async () => {
  render(<App />);
  await act(async () => {});
  expect(screen.getByText(/no rules yet/i)).toBeTruthy();
});

test("switches to create view when + button clicked", async () => {
  render(<App />);
  await act(async () => {});
  fireEvent.click(screen.getByLabelText("Create rule"));
  await act(async () => {});
  expect(screen.getByLabelText("Rule name")).toBeTruthy();
});

test("switches to logs view when log button clicked", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  render(<App />);
  await act(async () => {});
  fireEvent.click(screen.getByLabelText("View logs"));
  await act(async () => {});
  expect(screen.getByText(/no logs yet/i)).toBeTruthy();
});

test("auto-opens wizard when pendingWizardState exists", async () => {
  (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
    if (key === "pendingWizardState") {
      return Promise.resolve({
        pendingWizardState: {
          step: 1,
          trigger: { name: "Test", urlPattern: "*", trigger: "dom_change", intervalMinutes: undefined },
          selector: { selector: "" },
          destination: { url: "", label: "" },
        },
      });
    }
    if (key === "pendingSelection") return Promise.resolve({});
    return Promise.resolve({});
  });

  render(<App />);
  await act(async () => {});

  // Should auto-open the wizard (showing the CSS Selector field)
  expect(screen.getByLabelText("CSS Selector")).toBeTruthy();
});

test("opens wizard in edit mode when rule edit button clicked", async () => {
  const mockRule = {
    id: "r1",
    name: "Price Watch",
    enabled: true,
    trigger: "dom_change" as const,
    urlPattern: "https://example.com/*",
    selector: "#price",
    destination: { id: "d1", url: "https://hook.test", label: "Test Hook" },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
    if (key === "rules") return Promise.resolve({ rules: [mockRule] });
    return Promise.resolve({});
  });

  render(<App />);
  await act(async () => {});

  // Click edit on the rule
  fireEvent.click(screen.getByLabelText("Edit rule"));
  await act(async () => {});

  // Wizard should show pre-filled rule name
  const nameInput = screen.getByLabelText("Rule name") as HTMLInputElement;
  expect(nameInput.value).toBe("Price Watch");
});
