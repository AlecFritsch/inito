import { currentUser, auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

interface Run {
  id: string;
  repo: string;
  issueNumber: number;
  issueTitle: string;
  status: string;
  confidence: number | null;
  prNumber: number | null;
  prUrl: string | null;
  startedAt: string;
  completedAt: string | null;
}

async function fetchRuns(): Promise<Run[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api:3001';
  
  try {
    const response = await fetch(`${API_URL}/api/runs?limit=10`, {
      headers: {
        'X-User-Id': userId,
      },
      cache: 'no-store',
    });
    
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch runs:', error);
    return [];
  }
}

async function fetchStats(runs: Run[]) {
  const total = runs.length;
  const successful = runs.filter(r => r.status === 'done').length;
  const avgConfidence = runs.filter(r => r.confidence).length > 0
    ? Math.round(runs.filter(r => r.confidence).reduce((acc, r) => acc + (r.confidence || 0), 0) / runs.filter(r => r.confidence).length)
    : 0;
  const prsCreated = runs.filter(r => r.prNumber).length;
  
  return { total, successful, avgConfidence, prsCreated };
}

export default async function DashboardPage() {
  const user = await currentUser();
  const runs = await fetchRuns();
  const stats = await fetchStats(runs);

  return (
    <div className="h-full flex flex-col p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white mb-1">
          {user?.firstName ? `Welcome back, ${user.firstName}` : 'Dashboard'}
        </h1>
        <p className="text-sm text-zinc-500">
          Monitor your Havoc pipeline activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Runs" value={stats.total} />
        <StatCard label="Successful" value={stats.successful} accent="emerald" />
        <StatCard label="Avg Confidence" value={stats.avgConfidence > 0 ? `${stats.avgConfidence}%` : '—'} />
        <StatCard label="PRs Created" value={stats.prsCreated} />
      </div>

      {/* Recent Runs */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400">Recent Runs</h2>
          <Link 
            href="/dashboard/runs" 
            className="text-sm text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
          >
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {runs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex-1 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="divide-y divide-zinc-800">
              {runs.slice(0, 8).map((run) => (
                <Link
                  key={run.id}
                  href={`/dashboard/runs/${run.id}`}
                  className="flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <StatusIcon status={run.status} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {run.repo}
                        </span>
                        <span className="text-sm text-zinc-600">
                          #{run.issueNumber}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500 truncate max-w-lg">
                        {run.issueTitle}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 shrink-0">
                    {run.confidence && (
                      <div className="text-right">
                        <span className="text-sm font-mono text-white">{Math.round(run.confidence * 100)}%</span>
                        <p className="text-xs text-zinc-600">confidence</p>
                      </div>
                    )}
                    {run.prNumber && (
                      <div className="text-right">
                        <span className="text-sm font-mono text-emerald-400">PR #{run.prNumber}</span>
                      </div>
                    )}
                    <div className="text-right w-24">
                      <span className="text-sm text-zinc-500">{formatTime(run.startedAt)}</span>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  accent 
}: { 
  label: string; 
  value: string | number;
  accent?: 'emerald' | 'amber' | 'red';
}) {
  const valueColor = accent === 'emerald' 
    ? 'text-emerald-400' 
    : accent === 'amber'
    ? 'text-amber-400'
    : accent === 'red'
    ? 'text-red-400'
    : 'text-white';

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-zinc-500 shrink-0" />;
    default:
      return <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />;
  }
}

function EmptyState() {
  return (
    <div className="flex-1 border border-zinc-800 rounded-lg flex items-center justify-center">
      <div className="text-center py-16">
        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
          <Clock className="h-6 w-6 text-zinc-500" />
        </div>
        <h3 className="text-sm font-medium text-white mb-1">No runs yet</h3>
        <p className="text-sm text-zinc-500 max-w-xs">
          Runs will appear here when Havoc processes issues from your connected repositories.
        </p>
      </div>
    </div>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
