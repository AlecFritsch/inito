import { Search, Filter } from 'lucide-react';
import Link from 'next/link';

const runs = [
  {
    id: 'run_1',
    repo: 'acme/web-app',
    issueNumber: 142,
    issueTitle: 'Fix login button not responding on mobile',
    status: 'done' as const,
    confidence: 87,
    prNumber: 145,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'run_2',
    repo: 'acme/api-server',
    issueNumber: 89,
    issueTitle: 'Add rate limiting to API endpoints',
    status: 'done' as const,
    confidence: 92,
    prNumber: 90,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: 'run_3',
    repo: 'acme/web-app',
    issueNumber: 143,
    issueTitle: 'Extract validation logic into middleware',
    status: 'failed' as const,
    confidence: 45,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
  },
  {
    id: 'run_4',
    repo: 'acme/mobile-app',
    issueNumber: 56,
    issueTitle: 'Implement dark mode toggle',
    status: 'running' as const,
    confidence: 0,
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
  },
  {
    id: 'run_5',
    repo: 'acme/web-app',
    issueNumber: 140,
    issueTitle: 'Fix typo in error messages',
    status: 'done' as const,
    confidence: 98,
    prNumber: 141,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
];

export default function RunsPage() {
  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight mb-1">Runs</h1>
        <p className="text-sm text-zinc-500">All pipeline executions across your repositories</p>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search runs..."
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 focus:border-zinc-700 transition-colors"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors">
          <Filter className="h-4 w-4" />
          Filter
        </button>
      </div>

      {/* Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-5 py-3.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Repository</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Issue</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Confidence</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">PR</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-5 py-4">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm font-mono text-zinc-400">{run.repo}</span>
                </td>
                <td className="px-5 py-4">
                  <Link href={`/dashboard/runs/${run.id}`} className="block group">
                    <span className="text-sm text-zinc-200 group-hover:text-white transition-colors">
                      #{run.issueNumber}
                    </span>
                    <p className="text-xs text-zinc-500 truncate max-w-xs mt-0.5">
                      {run.issueTitle}
                    </p>
                  </Link>
                </td>
                <td className="px-5 py-4">
                  {run.confidence > 0 ? (
                    <ConfidenceBadge confidence={run.confidence} />
                  ) : (
                    <span className="text-sm text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {run.prNumber ? (
                    <span className="text-sm font-mono text-zinc-400">#{run.prNumber}</span>
                  ) : (
                    <span className="text-sm text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-zinc-500">{formatTime(run.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Done
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-red-500/10 text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      Running
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  let colorClass = 'text-zinc-400 bg-zinc-800';
  if (confidence >= 80) {
    colorClass = 'text-emerald-400 bg-emerald-500/10';
  } else if (confidence >= 60) {
    colorClass = 'text-amber-400 bg-amber-500/10';
  } else {
    colorClass = 'text-red-400 bg-red-500/10';
  }
  
  return (
    <span className={`text-xs font-mono px-2 py-1 rounded-md ${colorClass}`}>
      {confidence}%
    </span>
  );
}

function formatTime(date: Date): string {
  const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
