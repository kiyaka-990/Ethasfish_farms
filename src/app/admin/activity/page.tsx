'use client';
import { useEffect, useRef, useState } from 'react';
import { Activity, Bot, User as UserIcon, Cog } from 'lucide-react';

interface LogEntry {
  id: string;
  actorType: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
}

const ICONS: Record<string, any> = { staff: UserIcon, agent: Bot, system: Cog, customer: UserIcon };

// Polls every few seconds for new entries - a pragmatic stand-in for a
// full websocket/SSE push feed (planned for the realtime ERP phase).
export default function AdminActivityPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const latestRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    async function poll() {
      const url = latestRef.current ? `/api/admin/activity?since=${encodeURIComponent(latestRef.current)}` : '/api/admin/activity';
      const res = await fetch(url);
      if (!res.ok || !active) return;
      const data = await res.json();
      if (data.logs?.length) {
        setLogs(prev => latestRef.current ? [...data.logs, ...prev].slice(0, 300) : data.logs);
        latestRef.current = data.logs[0].createdAt;
      }
      setLoading(false);
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => { active = false; clearInterval(id); };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            <Activity className="w-6 h-6 text-[var(--accent)]" /> Activity Log
          </h1>
          <p className="text-sm text-muted mt-1">Every staff action and autonomous agent tool-call, in order. Refreshes automatically.</p>
        </div>
        <span className="badge !text-[10px] inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-soft" /> Live
        </span>
      </div>

      <div className="glass rounded-2xl">
        {loading ? (
          <div className="p-12 text-center text-muted text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-muted text-sm">No activity recorded yet</div>
        ) : (
          <ul className="divide-y divide-[var(--border-color)]">
            {logs.map(l => {
              const Icon = ICONS[l.actorType] || Cog;
              return (
                <li key={l.id} className="flex items-start gap-3 px-5 py-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${l.actorType === 'agent' ? 'bg-[var(--accent-light)]/15' : 'glass-soft'}`}>
                    <Icon className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-primary">
                      <span className="font-medium">{l.actorName}</span> <span className="text-secondary">{l.summary}</span>
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">{new Date(l.createdAt).toLocaleString('en-KE')} &middot; {l.action}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
