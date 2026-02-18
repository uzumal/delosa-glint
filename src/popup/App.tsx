import React, { useEffect, useState } from "react";
import { Plus, List, ScrollText, HelpCircle } from "lucide-react";
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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const savedState = await loadWizardState();
      const pending = await chrome.storage.local.get("pendingSelection");
      if (savedState || pending.pendingSelection) {
        if (savedState?.editRuleSnapshot) {
          setEditingRule(savedState.editRuleSnapshot);
          setView("edit");
        } else {
          setView("create");
        }
      }
    })();
  }, []);

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule);
    setView("edit");
  };

  const handleWizardDone = (saved?: boolean) => {
    setEditingRule(undefined);
    setView("rules");
    if (saved) {
      setSaveMessage("対象ページを更新すると、監視が開始されます");
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const showWizard = view === "create" || view === "edit";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="../icons/logo.png" alt="Delosa Glint" className="w-5 h-5 rounded" />
          <h1 className="text-lg font-semibold">Delosa Glint</h1>
        </div>
        <div className="flex items-center gap-1">
          {!showWizard && (
            <>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Usage guide"
                onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/onboarding.html") })}
              >
                <HelpCircle className="w-4 h-4" />
              </Button>
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
              onClick={() => handleWizardDone()}
            >
              <List className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {view === "rules" && (
          <>
            {saveMessage && (
              <div className="mb-2 p-2 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                {saveMessage}
              </div>
            )}
            <RuleList onCreateRule={() => setView("create")} onEditRule={handleEditRule} />
          </>
        )}
        {view === "create" && <CreateRuleWizard onDone={handleWizardDone} />}
        {view === "edit" && <CreateRuleWizard onDone={handleWizardDone} editRule={editingRule} />}
        {view === "logs" && <LogList />}
      </div>
    </div>
  );
}
