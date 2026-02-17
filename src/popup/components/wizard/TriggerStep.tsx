import React from "react";
import { TriggerType } from "@/lib/types";

export interface TriggerStepData {
  name: string;
  urlPattern: string;
  trigger: TriggerType;
  intervalMinutes?: number;
}

interface TriggerStepProps {
  data: TriggerStepData;
  onChange: (data: TriggerStepData) => void;
}

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: "dom_change", label: "DOM Change" },
  { value: "page_visit", label: "Page Visit" },
  { value: "click", label: "Click" },
  { value: "form_submit", label: "Form Submit" },
  { value: "periodic_check", label: "Periodic Check" },
];

export function TriggerStep({ data, onChange }: TriggerStepProps) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="rule-name" className="block text-xs font-medium text-gray-700 mb-1">
          Rule name
        </label>
        <input
          id="rule-name"
          type="text"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="e.g. Price Watcher"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="url-pattern" className="block text-xs font-medium text-gray-700 mb-1">
          URL pattern
        </label>
        <input
          id="url-pattern"
          type="text"
          value={data.urlPattern}
          onChange={(e) => onChange({ ...data, urlPattern: e.target.value })}
          placeholder="e.g. https://example.com/*"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-gray-700 mb-1">Trigger type</legend>
        <div className="space-y-1">
          {TRIGGER_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="trigger"
                value={opt.value}
                checked={data.trigger === opt.value}
                onChange={() => onChange({ ...data, trigger: opt.value })}
                className="text-blue-600"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {data.trigger === "periodic_check" && (
        <div>
          <label htmlFor="interval" className="block text-xs font-medium text-gray-700 mb-1">
            Check interval (minutes)
          </label>
          <input
            id="interval"
            type="number"
            min={1}
            value={data.intervalMinutes ?? ""}
            onChange={(e) =>
              onChange({ ...data, intervalMinutes: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="60"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
