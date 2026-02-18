import React, { useState } from "react";
import { DestinationType } from "@/lib/types";
import { validateWebhookUrl } from "@/lib/validators";

export interface DestinationStepData {
  type: DestinationType;
  url: string;
  label: string;
}

interface DestinationStepProps {
  data: DestinationStepData;
  onChange: (data: DestinationStepData) => void;
}

export function DestinationStep({ data, onChange }: DestinationStepProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const urlError = touched.url ? validateWebhookUrl(data.url) : null;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="payload-format" className="block text-xs font-medium text-gray-700 mb-1">
          Payload Format
        </label>
        <select
          id="payload-format"
          value={data.type}
          onChange={(e) => onChange({ ...data, type: e.target.value as DestinationType })}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
        >
          <option value="generic">Generic (Raw JSON)</option>
          <option value="text">Text Message (Slack, Webex, Google Chat)</option>
        </select>
      </div>

      <div>
        <label htmlFor="webhook-url" className="block text-xs font-medium text-gray-700 mb-1">
          Webhook URL
        </label>
        <input
          id="webhook-url"
          type="url"
          value={data.url}
          onChange={(e) => onChange({ ...data, url: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, url: true }))}
          placeholder={data.type === "text" ? "https://hooks.slack.com/services/..." : "https://example.com/webhook"}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {urlError && <p className="text-xs text-red-500 mt-0.5">{urlError}</p>}
      </div>

      <div>
        <label htmlFor="dest-label" className="block text-xs font-medium text-gray-700 mb-1">
          Label
        </label>
        <input
          id="dest-label"
          type="text"
          value={data.label}
          onChange={(e) => onChange({ ...data, label: e.target.value })}
          placeholder="e.g. My Slack Channel"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
