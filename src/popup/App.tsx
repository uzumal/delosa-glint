import React, { useState } from "react";
import { Webhook, Plus, List, ScrollText } from "lucide-react";
import { Button } from "@/ui/Button";
import { RuleList } from "@/popup/components/RuleList";
import { LogList } from "@/popup/components/LogList";
import { CreateRuleWizard } from "@/popup/components/wizard/CreateRuleWizard";

type View = "rules" | "create" | "logs";

export function App() {
  const [view, setView] = useState<View>("rules");

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">BrowserHook</h1>
        </div>
        <div className="flex items-center gap-1">
          {view !== "create" && (
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
          {view === "create" && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="View rules"
              onClick={() => setView("rules")}
            >
              <List className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {view === "rules" && <RuleList onCreateRule={() => setView("create")} />}
      {view === "create" && <CreateRuleWizard onDone={() => setView("rules")} />}
      {view === "logs" && <LogList />}
    </div>
  );
}
