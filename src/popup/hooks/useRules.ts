import { useCallback, useEffect, useState } from "react";
import { Rule } from "@/lib/types";
import { StorageHelper } from "@/lib/storage";

export function useRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const stored = await StorageHelper.getRules();
    setRules(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveRule = useCallback(
    async (rule: Rule) => {
      await StorageHelper.saveRule(rule);
      await refresh();
    },
    [refresh],
  );

  const deleteRule = useCallback(
    async (ruleId: string) => {
      await StorageHelper.deleteRule(ruleId);
      await refresh();
    },
    [refresh],
  );

  const toggleRule = useCallback(
    async (ruleId: string) => {
      const rule = rules.find((r) => r.id === ruleId);
      if (!rule) return;
      await StorageHelper.saveRule({ ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() });
      await refresh();
    },
    [rules, refresh],
  );

  return { rules, loading, saveRule, deleteRule, toggleRule, refresh };
}
