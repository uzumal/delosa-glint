import React, { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Card } from "@/ui/Card";
import { Toggle } from "@/ui/Toggle";
import { Button } from "@/ui/Button";
import { StorageHelper } from "@/lib/storage";
import { ExtensionSettings } from "@/lib/types";

export function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>({
    enableNotifications: true,
    maxLogEntries: 500,
  });

  useEffect(() => {
    StorageHelper.getSettings().then(setSettings);
  }, []);

  const handleToggleNotifications = async () => {
    const updated = { enableNotifications: !settings.enableNotifications };
    await StorageHelper.saveSettings(updated);
    setSettings((prev) => ({ ...prev, ...updated }));
  };

  const handleClearLogs = async () => {
    await StorageHelper.clearLogs();
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-semibold">Delosa Glint Settings</h1>
      </div>

      <div className="space-y-4">
        <Card>
          <h2 className="font-medium mb-3">Notifications</h2>
          <Toggle
            label="Enable webhook notifications"
            checked={settings.enableNotifications}
            onChange={handleToggleNotifications}
          />
        </Card>

        <Card>
          <h2 className="font-medium mb-3">Data</h2>
          <Button variant="secondary" size="sm" onClick={handleClearLogs}>
            Clear All Logs
          </Button>
        </Card>
      </div>
    </div>
  );
}
