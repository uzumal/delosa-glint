import React from "react";

export interface DestinationStepData {
  url: string;
  label: string;
}

interface DestinationStepProps {
  data: DestinationStepData;
  onChange: (data: DestinationStepData) => void;
}

export function DestinationStep({ data, onChange }: DestinationStepProps) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="webhook-url" className="block text-xs font-medium text-gray-700 mb-1">
          Webhook URL
        </label>
        <input
          id="webhook-url"
          type="url"
          value={data.url}
          onChange={(e) => onChange({ ...data, url: e.target.value })}
          placeholder="https://hooks.slack.com/services/..."
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
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
