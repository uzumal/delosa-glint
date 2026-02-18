import { saveWizardState, loadWizardState, clearWizardState, WizardState } from "@/popup/hooks/useWizardPersistence";

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockReset();
  (chrome.storage.local.remove as jest.Mock).mockReset();
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);
});

const mockState: WizardState = {
  step: 1,
  trigger: { name: "Price Watch", urlPattern: "https://example.com/*", trigger: "dom_change", intervalMinutes: undefined },
  selector: { selector: "" },
  destination: { type: "generic", url: "", label: "" },
};

test("saveWizardState stores state to chrome.storage.local", async () => {
  await saveWizardState(mockState);
  expect(chrome.storage.local.set).toHaveBeenCalledWith({ pendingWizardState: mockState });
});

test("loadWizardState returns null when nothing stored", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  expect(await loadWizardState()).toBeNull();
});

test("loadWizardState returns saved state", async () => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({ pendingWizardState: mockState });
  expect(await loadWizardState()).toEqual(mockState);
});

test("clearWizardState removes stored state", async () => {
  await clearWizardState();
  expect(chrome.storage.local.remove).toHaveBeenCalledWith("pendingWizardState");
});
