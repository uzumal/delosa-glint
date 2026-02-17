import { TriggerStepData } from "@/popup/components/wizard/TriggerStep";
import { SelectorStepData } from "@/popup/components/wizard/SelectorStep";
import { DestinationStepData } from "@/popup/components/wizard/DestinationStep";

export interface WizardState {
  step: number;
  trigger: TriggerStepData;
  selector: SelectorStepData;
  destination: DestinationStepData;
}

export async function saveWizardState(state: WizardState): Promise<void> {
  await chrome.storage.local.set({ pendingWizardState: state });
}

export async function loadWizardState(): Promise<WizardState | null> {
  const result = await chrome.storage.local.get("pendingWizardState");
  return (result.pendingWizardState as WizardState | undefined) ?? null;
}

export async function clearWizardState(): Promise<void> {
  await chrome.storage.local.remove("pendingWizardState");
}
