import React from "react";
import { Crosshair } from "lucide-react";
import { Button } from "@/ui/Button";

export interface SelectorStepData {
  selector: string;
}

interface SelectorStepProps {
  data: SelectorStepData;
  onChange: (data: SelectorStepData) => void;
  onPickElement?: () => void;
  pickError?: string | null;
}

export function SelectorStep({ data, onChange, onPickElement, pickError }: SelectorStepProps) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="css-selector" className="block text-xs font-medium text-gray-700 mb-1">
          CSS Selector
        </label>
        <input
          id="css-selector"
          type="text"
          value={data.selector}
          onChange={(e) => onChange({ selector: e.target.value })}
          placeholder="e.g. #price, .product-title"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-500 mb-2">Or pick an element visually:</p>
        <Button variant="secondary" size="sm" onClick={onPickElement}>
          <Crosshair className="w-3.5 h-3.5 mr-1" />
          Pick Element
        </Button>
      </div>

      {pickError && (
        <p className="text-xs text-red-500 text-center">{pickError}</p>
      )}

      {data.selector && (
        <div className="bg-gray-50 rounded p-2">
          <p className="text-xs text-gray-500">Selected:</p>
          <code className="text-xs text-blue-700 break-all">{data.selector}</code>
        </div>
      )}
    </div>
  );
}
