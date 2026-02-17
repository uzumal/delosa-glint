import React, { useEffect, useState } from "react";
import { Rule } from "@/lib/types";
import { StorageHelper } from "@/lib/storage";
import { Button } from "@/ui/Button";
import { StepIndicator } from "@/popup/components/StepIndicator";
import { TriggerStep, TriggerStepData } from "./TriggerStep";
import { SelectorStep, SelectorStepData } from "./SelectorStep";
import { DestinationStep, DestinationStepData } from "./DestinationStep";

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

  const showSelector = needsSelector(trigger.trigger);
  const steps = showSelector ? STEPS_WITH_SELECTOR : STEPS_WITHOUT_SELECTOR;
  const lastStep = steps.length - 1;

  // Check for pending selection from visual picker
  useEffect(() => {
    chrome.storage.local.get("pendingSelection").then((result) => {
      const pending = result.pendingSelection as { selector: string; url: string } | undefined;
      if (pending?.selector) {
        setSelector({ selector: pending.selector });
        chrome.storage.local.remove("pendingSelection");
      }
    });
  }, []);

  const handleNext = () => {
    if (step < lastStep) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
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
    onDone();
  };

  const isStepValid = (): boolean => {
    if (step === 0) return trigger.name.trim() !== "" && trigger.urlPattern.trim() !== "";
    if (showSelector && step === 1) return selector.selector.trim() !== "";
    const destStep = showSelector ? 2 : 1;
    if (step === destStep) return destination.url.trim() !== "";
    return true;
  };

  const renderStep = () => {
    if (step === 0) {
      return <TriggerStep data={trigger} onChange={setTrigger} />;
    }
    if (showSelector && step === 1) {
      return <SelectorStep data={selector} onChange={setSelector} />;
    }
    return <DestinationStep data={destination} onChange={setDestination} />;
  };

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
          <Button variant="secondary" size="sm" onClick={onDone}>
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
