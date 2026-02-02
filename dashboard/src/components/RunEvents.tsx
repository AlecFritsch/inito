'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Terminal, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

type RunEvent = {
  id: string;
  runId: string;
  type: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

const typeConfig: Record<string, { icon: React.ReactNode; className: string }> = {
  status: { icon: <Activity className="h-4 w-4" />, className: 'text-amber-400' },
  task: { icon: <CheckCircle2 className="h-4 w-4" />, className: 'text-emerald-400' },
  command: { icon: <Terminal className="h-4 w-4" />, className: 'text-zinc-400' },
  file: { icon: <Terminal className="h-4 w-4" />, className: 'text-zinc-400' },
  log: { icon: <Activity className="h-4 w-4" />, className: 'text-blue-400' },
  error: { icon: <AlertTriangle className="h-4 w-4" />, className: 'text-red-400' },
};

export default function RunEvents({ runId }: { runId: string }) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await fetch(`/api/runs/${runId}/events`, {
          cache: 'no-store',
        });
        const data = await response.json();
        if (!mounted) return;
        setEvents(Array.isArray(data.events) ? data.events : []);
        setLastUpdated(new Date());
        setLoading(false);
      } catch {
        if (!mounted) return;
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [runId]);

  const ordered = useMemo(() => {
    return [...events].sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
  }, [events]);

  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
          <Activity className="h-3.5 w-3.5" />
          Live Activity
        </div>
        <div className="text-xs text-zinc-600">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : '—'}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activity...
        </div>
      ) : ordered.length === 0 ? (
        <div className="text-sm text-zinc-500">No activity yet.</div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {ordered.map((event) => {
            const config = typeConfig[event.type] || typeConfig.log;
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-md border border-zinc-800/60 bg-zinc-900/40 p-2"
              >
                <div className={`mt-0.5 ${config.className}`}>{config.icon}</div>
                <div className="min-w-0">
                  <div className="text-xs text-zinc-400">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="text-sm text-white break-words">{event.message}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
