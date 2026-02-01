import { Search } from 'lucide-react';
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
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-medium mb-1">Runs</h1>
          <p className="text-sm text-muted-foreground">All pipeline executions</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search runs..."
          className="w-full bg-transparent border border-border rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border"
        />
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Repository</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Issue</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Confidence</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">PR</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-secondary/20 transition-colors">
                <td className="p-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="p-3 text-sm font-mono text-muted-foreground">
                  {run.repo}
                </td>
                <td className="p-3">
                  <Link href={`/dashboard/runs/${run.id}`} className="block">
                    <span className="text-sm">#{run.issueNumber}</span>
                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                      {run.issueTitle}
                    </p>
                  </Link>
                </td>
                <td className="p-3">
                  {run.confidence > 0 ? (
                    <span className="text-sm font-mono">{run.confidence}%</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3">
                  {run.prNumber ? (
                    <span className="text-sm font-mono">#{run.prNumber}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 text-sm text-muted-foreground">
                  {formatTime(run.createdAt)}
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
    return <span className="text-xs px-2 py-1 rounded bg-secondary text-foreground">done</span>;
  }
  if (status === 'failed') {
    return <span className="text-xs px-2 py-1 rounded bg-secondary text-muted-foreground">failed</span>;
  }
  return <span className="text-xs px-2 py-1 rounded bg-secondary text-muted-foreground animate-pulse">running</span>;
}

function formatTime(date: Date): string {
  const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
