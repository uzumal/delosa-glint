import React, { useState } from "react";
import { Webhook, Plus, List } from "lucide-react";
import { Button } from "@/ui/Button";
import { RuleList } from "@/popup/components/RuleList";
import { CreateRuleWizard } from "@/popup/components/wizard/CreateRuleWizard";

type View = "rules" | "create";

export function App() {
  const [view, setView] = useState<View>("rules");

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">BrowserHook</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label={view === "rules" ? "Create rule" : "View rules"}
          onClick={() => setView(view === "rules" ? "create" : "rules")}
        >
          {view === "rules" ? <Plus className="w-4 h-4" /> : <List className="w-4 h-4" />}
        </Button>
      </header>

      {view === "rules" ? (
        <RuleList onCreateRule={() => setView("create")} />
      ) : (
        <CreateRuleWizard onDone={() => setView("rules")} />
      )}
    </div>
  );
}
