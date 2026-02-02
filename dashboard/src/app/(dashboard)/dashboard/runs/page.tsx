import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { CheckCircle2, XCircle, Clock, Loader2, ExternalLink, Search } from 'lucide-react';

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
    const response = await fetch(`${API_URL}/api/runs?limit=100`, {
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

export default async function RunsPage() {
  const runs = await fetchRuns();

  return (
    <div className="h-full flex flex-col p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white mb-1">Runs</h1>
          <p className="text-sm text-zinc-500">All pipeline executions</p>
        </div>
        <div className="text-sm text-zinc-500">
          {runs.length} total
        </div>
      </div>

      {/* Search - TODO: make functional */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
        <input
          type="text"
          placeholder="Search runs by repository or issue..."
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
        />
      </div>

      {/* Table */}
      {runs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/30">
                  <th className="text-left p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Repository</th>
                  <th className="text-left p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Issue</th>
                  <th className="text-left p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Confidence</th>
                  <th className="text-left p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">PR</th>
                  <th className="text-left p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Started</th>
                  <th className="text-left p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {runs.map((run) => (
                  <tr 
                    key={run.id} 
                    className="hover:bg-zinc-900/40 transition-colors group"
                  >
                    <td className="p-4">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-mono text-zinc-400">{run.repo}</span>
                    </td>
                    <td className="p-4">
                      <Link 
                        href={`/dashboard/runs/${run.id}`}
                        className="group/link"
                      >
                        <span className="text-sm text-white group-hover/link:underline">
                          #{run.issueNumber}
                        </span>
                        <p className="text-sm text-zinc-500 truncate max-w-md">
                          {run.issueTitle}
                        </p>
                      </Link>
                    </td>
                    <td className="p-4">
                      {run.confidence ? (
                        <ConfidenceBadge value={Math.round(run.confidence * 100)} />
                      ) : (
                        <span className="text-sm text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      {run.prNumber && run.prUrl ? (
                        <a 
                          href={run.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          #{run.prNumber}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-zinc-400">
                        {formatDate(run.startedAt)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-zinc-500">
                        {run.completedAt 
                          ? formatDuration(run.startedAt, run.completedAt)
                          : '—'
                        }
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    done: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: 'Done',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    failed: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      label: 'Failed',
      className: 'bg-red-500/10 text-red-400 border-red-500/20',
    },
    pending: {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: 'Pending',
      className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    },
    analyzing: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: 'Analyzing',
      className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    planning: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: 'Planning',
      className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    editing: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: 'Editing',
      className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    testing: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: 'Testing',
      className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    },
    reviewing: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: 'Reviewing',
      className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    },
    publishing: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: 'Publishing',
      className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    },
  };

  const { icon, label, className } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${className}`}>
      {icon}
      {label}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 80 
    ? 'text-emerald-400' 
    : value >= 60 
    ? 'text-amber-400' 
    : 'text-red-400';

  return (
    <span className={`text-sm font-mono ${color}`}>
      {value}%
    </span>
  );
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate.getTime() - startDate.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
