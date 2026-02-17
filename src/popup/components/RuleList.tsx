import React from "react";
import { useRules } from "@/popup/hooks/useRules";
import { RuleCard } from "@/popup/components/RuleCard";
import { Card } from "@/ui/Card";

interface RuleListProps {
  onCreateRule: () => void;
}

export function RuleList({ onCreateRule }: RuleListProps) {
  const { rules, loading, toggleRule, deleteRule } = useRules();

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-6">Loading...</p>;
  }

  if (rules.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500 text-center py-6">
          No rules yet. Click + to create your first webhook rule.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} onToggle={toggleRule} onDelete={deleteRule} />
      ))}
    </div>
  );
}
