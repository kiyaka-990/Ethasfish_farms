'use client';
import { useEffect, useState } from 'react';
import { Loader2, Bot, Wrench, Zap, Activity } from 'lucide-react';

interface AgentRun {
  id: string;
  agentKey: string;
  sessionId: string | null;
  input: string | null;
  output: string | null;
  status: string;
  toolCalls: string | null;
  model: string | null;
  tokensUsed: number | null;
  createdAt: string;
}

export default function AdminAgentsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [summary, setSummary] = useState({ totalRuns: 0, totalTokens: 0 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/agents').then(r => r.json()).then(d => {
      setRuns(d.runs || []);
      setSummary(d.summary || { totalRuns: 0, totalTokens: 0 });
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <Bot className="w-6 h-6 text-[var(--accent)]" /> AI Agents
        </h1>
        <p className="text-sm text-muted mt-1">Every run of the autonomous sales agent (Fin) — what customers asked, what tools it used, and what it answered.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-strong rounded-2xl p-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-soft)]/30 to-[var(--accent)]/10 flex items-center justify-center mb-3">
            <Activity className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Total Runs</p>
          <p className="font-display text-xl font-bold text-primary mt-1">{summary.totalRuns}</p>
        </div>
        <div className="glass-strong rounded-2xl p-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-soft)]/30 to-[var(--accent)]/10 flex items-center justify-center mb-3">
            <Zap className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Tokens Used</p>
          <p className="font-display text-xl font-bold text-primary mt-1">{summary.totalTokens.toLocaleString()}</p>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : runs.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center text-muted text-sm">
          No agent runs yet — this fills up once customers chat and the AI Gateway responds (it falls back to the rule-based bot with no entry here if no credits are loaded).
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(r => {
            const tools: Array<{ tool: string; args: any }> = r.toolCalls ? JSON.parse(r.toolCalls) : [];
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="glass rounded-2xl overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : r.id)} className="w-full text-left p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-primary truncate">{r.input || '(no input)'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-muted">{new Date(r.createdAt).toLocaleString()}</span>
                      {r.model && <span className="badge !text-[10px] !py-0.5">{r.model.split('/').pop()}</span>}
                      {tools.length > 0 && (
                        <span className="text-[10px] text-[var(--accent)] inline-flex items-center gap-1">
                          <Wrench className="w-3 h-3" /> {tools.map(t => t.tool).join(', ')}
                        </span>
                      )}
                      {r.tokensUsed != null && <span className="text-[10px] text-muted">{r.tokensUsed} tokens</span>}
                    </div>
                  </div>
                  <span className={`badge !text-[10px] !py-0.5 shrink-0 ${r.status === 'completed' ? '' : '!text-red-500'}`}>{r.status}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-0 space-y-3 border-t border-[var(--border-color)]">
                    <div className="pt-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Customer said</p>
                      <p className="text-sm text-secondary glass-soft rounded-xl p-3">{r.input || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Fin replied</p>
                      <p className="text-sm text-secondary glass-soft rounded-xl p-3 whitespace-pre-wrap">{r.output || '—'}</p>
                    </div>
                    {tools.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Tool calls</p>
                        <pre className="text-[11px] text-secondary glass-soft rounded-xl p-3 overflow-x-auto">{JSON.stringify(tools, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
