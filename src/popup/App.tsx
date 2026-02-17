import React, { useEffect, useState } from "react";
import { Webhook, Plus, List, ScrollText } from "lucide-react";
import { Rule } from "@/lib/types";
import { Button } from "@/ui/Button";
import { RuleList } from "@/popup/components/RuleList";
import { LogList } from "@/popup/components/LogList";
import { CreateRuleWizard } from "@/popup/components/wizard/CreateRuleWizard";
import { loadWizardState } from "@/popup/hooks/useWizardPersistence";

type View = "rules" | "create" | "edit" | "logs";

export function App() {
  const [view, setView] = useState<View>("rules");
  const [editingRule, setEditingRule] = useState<Rule | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const savedState = await loadWizardState();
      const pending = await chrome.storage.local.get("pendingSelection");
      if (savedState || pending.pendingSelection) {
        setView("create");
      }
    })();
  }, []);

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule);
    setView("edit");
  };

  const handleWizardDone = () => {
    setEditingRule(undefined);
    setView("rules");
  };

  const showWizard = view === "create" || view === "edit";

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">BrowserHook</h1>
        </div>
        <div className="flex items-center gap-1">
          {!showWizard && (
            <>
              <Button
                variant="ghost"
                size="sm"
                aria-label="View logs"
                onClick={() => setView(view === "logs" ? "rules" : "logs")}
              >
                <ScrollText className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Create rule"
                onClick={() => setView("create")}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </>
          )}
          {showWizard && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="View rules"
              onClick={handleWizardDone}
            >
              <List className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {view === "rules" && <RuleList onCreateRule={() => setView("create")} onEditRule={handleEditRule} />}
      {view === "create" && <CreateRuleWizard onDone={handleWizardDone} />}
      {view === "edit" && <CreateRuleWizard onDone={handleWizardDone} editRule={editingRule} />}
      {view === "logs" && <LogList />}
    </div>
  );
}
