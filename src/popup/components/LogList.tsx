import React from "react";
import { CheckCircle, XCircle, Trash2 } from "lucide-react";
import { useLogs } from "@/popup/hooks/useLogs";
import { LogEntry } from "@/lib/types";
import { Card } from "@/ui/Card";
import { Button } from "@/ui/Button";

export function LogList() {
  const { logs, loading, clearLogs } = useLogs();

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-6">Loading...</p>;
  }

  if (logs.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500 text-center py-6">
          No logs yet. Logs will appear here when webhooks are triggered.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={clearLogs}>
          <Trash2 className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>
      {logs.map((log) => (
        <LogItem key={log.id} log={log} />
      ))}
    </div>
  );
}

function LogItem({ log }: { log: LogEntry }) {
  const isSuccess = log.status === "success";
  const time = new Date(log.timestamp).toLocaleTimeString();

  return (
    <Card className="!p-3">
      <div className="flex items-start gap-2">
        {isSuccess ? (
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate">{log.ruleName}</span>
            <span className="text-xs text-gray-400 shrink-0 ml-2">{time}</span>
          </div>
          <p className="text-xs text-gray-500">{log.event}</p>
          {log.statusCode && (
            <span
              className={`text-xs ${isSuccess ? "text-green-600" : "text-red-600"}`}
            >
              {log.statusCode}
            </span>
          )}
          {log.error && <p className="text-xs text-red-500 mt-0.5 truncate">{log.error}</p>}
        </div>
      </div>
    </Card>
  );
}
