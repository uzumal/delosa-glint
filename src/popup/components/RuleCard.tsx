import React from "react";
import { Trash2 } from "lucide-react";
import { Rule } from "@/lib/types";
import { Card } from "@/ui/Card";
import { Toggle } from "@/ui/Toggle";

interface RuleCardProps {
  rule: Rule;
  onToggle: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
}

export function RuleCard({ rule, onToggle, onDelete }: RuleCardProps) {
  return (
    <Card className={rule.enabled ? "" : "opacity-60"}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{rule.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{rule.trigger}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{rule.destination.label}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Toggle label="" checked={rule.enabled} onChange={() => onToggle(rule.id)} />
          <button
            aria-label="Delete rule"
            onClick={() => onDelete(rule.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
