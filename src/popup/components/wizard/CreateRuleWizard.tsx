import React, { useCallback, useEffect, useState } from "react";
import { Rule } from "@/lib/types";
import { StorageHelper } from "@/lib/storage";
import { isInjectableUrl } from "@/lib/url-utils";
import { Button } from "@/ui/Button";
import { StepIndicator } from "@/popup/components/StepIndicator";
import { TriggerStep, TriggerStepData } from "./TriggerStep";
import { SelectorStep, SelectorStepData } from "./SelectorStep";
import { DestinationStep, DestinationStepData } from "./DestinationStep";
import { saveWizardState, loadWizardState, clearWizardState } from "@/popup/hooks/useWizardPersistence";
import { validateRuleName, validateUrlPattern, validateWebhookUrl, validateSelector } from "@/lib/validators";

interface CreateRuleWizardProps {
  onDone: () => void;
}

const STEPS_WITH_SELECTOR = ["Trigger", "Element", "Destination"];
const STEPS_WITHOUT_SELECTOR = ["Trigger", "Destination"];

function needsSelector(trigger: string): boolean {
  return trigger !== "page_visit" && trigger !== "periodic_check";
}

export function CreateRuleWizard({ onDone }: CreateRuleWizardProps) {
  const [step, setStep] = useState(0);
  const [trigger, setTrigger] = useState<TriggerStepData>({
    name: "",
    urlPattern: "",
    trigger: "dom_change",
    intervalMinutes: undefined,
  });
  const [selector, setSelector] = useState<SelectorStepData>({ selector: "" });
  const [destination, setDestination] = useState<DestinationStepData>({ url: "", label: "" });
  const [pickError, setPickError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const showSelector = needsSelector(trigger.trigger);
  const steps = showSelector ? STEPS_WITH_SELECTOR : STEPS_WITHOUT_SELECTOR;
  const lastStep = steps.length - 1;

  // Restore wizard state and pending selection on mount
  useEffect(() => {
    (async () => {
      const savedState = await loadWizardState();
      if (savedState) {
        setStep(savedState.step);
        setTrigger(savedState.trigger);
        setSelector(savedState.selector);
        setDestination(savedState.destination);
      }

      // Check for pending selection from visual picker
      const result = await chrome.storage.local.get("pendingSelection");
      const pending = result.pendingSelection as { selector: string; textPreview?: string; url: string } | undefined;
      if (pending?.selector) {
        setSelector({ selector: pending.selector, textPreview: pending.textPreview });
        await chrome.storage.local.remove("pendingSelection");
      }

      // Clear wizard state now that we've loaded it
      await clearWizardState();
      setLoaded(true);
    })();
  }, []);

  const handlePickElement = useCallback(async () => {
    setPickError(null);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (!isInjectableUrl(tab.url)) {
      setPickError("Cannot pick elements on this page. Navigate to a regular web page first.");
      return;
    }

    // Save wizard state before closing
    await saveWizardState({ step, trigger, selector, destination });

    await chrome.runtime.sendMessage({ type: "INJECT_SELECTOR", payload: { tabId: tab.id } });
    await chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_SELECTOR" });
    window.close();
  }, [step, trigger, selector, destination]);

  const handleNext = () => {
    if (step < lastStep) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleCancel = async () => {
    await clearWizardState();
    onDone();
  };

  const handleSave = async () => {
    const now = new Date().toISOString();
    const rule: Rule = {
      id: crypto.randomUUID(),
      name: trigger.name,
      enabled: true,
      trigger: trigger.trigger,
      urlPattern: trigger.urlPattern,
      selector: showSelector ? selector.selector : undefined,
      intervalMinutes: trigger.intervalMinutes,
      destination: {
        id: crypto.randomUUID(),
        url: destination.url,
        label: destination.label || destination.url,
      },
      createdAt: now,
      updatedAt: now,
    };
    await StorageHelper.saveRule(rule);
    await clearWizardState();
    onDone();
  };

  const isStepValid = (): boolean => {
    if (step === 0) {
      return validateRuleName(trigger.name) === null && validateUrlPattern(trigger.urlPattern) === null;
    }
    if (showSelector && step === 1) {
      return validateSelector(selector.selector) === null;
    }
    const destStep = showSelector ? 2 : 1;
    if (step === destStep) {
      return validateWebhookUrl(destination.url) === null;
    }
    return true;
  };

  const renderStep = () => {
    if (step === 0) {
      return <TriggerStep data={trigger} onChange={setTrigger} />;
    }
    if (showSelector && step === 1) {
      return (
        <SelectorStep
          data={selector}
          onChange={setSelector}
          onPickElement={handlePickElement}
          pickError={pickError}
        />
      );
    }
    return <DestinationStep data={destination} onChange={setDestination} />;
  };

  if (!loaded) return null;

  return (
    <div className="space-y-3">
      <StepIndicator currentStep={step} steps={steps} />
      {renderStep()}
      <div className="flex justify-between pt-2">
        {step > 0 ? (
          <Button variant="secondary" size="sm" onClick={handleBack}>
            Back
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        )}
        {step < lastStep ? (
          <Button size="sm" onClick={handleNext} disabled={!isStepValid()}>
            Next
          </Button>
        ) : (
          <Button size="sm" onClick={handleSave} disabled={!isStepValid()}>
            Save Rule
          </Button>
        )}
      </div>
    </div>
  );
}
