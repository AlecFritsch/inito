import { currentUser } from '@clerk/nextjs/server';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const user = await currentUser();
  
  const stats = {
    totalRuns: 47,
    successfulRuns: 42,
    avgConfidence: 84,
    prsCreated: 38,
  };

  const recentRuns = [
    {
      id: 'run_1',
      repo: 'acme/web-app',
      issueNumber: 142,
      issueTitle: 'Fix login button not responding on mobile',
      status: 'done',
      confidence: 87,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: 'run_2',
      repo: 'acme/api-server',
      issueNumber: 89,
      issueTitle: 'Add rate limiting to API endpoints',
      status: 'done',
      confidence: 92,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    },
    {
      id: 'run_3',
      repo: 'acme/web-app',
      issueNumber: 143,
      issueTitle: 'Extract validation logic into middleware',
      status: 'failed',
      confidence: 45,
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    },
  ];

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-10">
        <h1 className="text-lg font-medium mb-1">
          {user?.firstName ? `Welcome, ${user.firstName}` : 'Overview'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your Havoc pipeline activity
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-12">
        <Stat label="Total runs" value={stats.totalRuns} />
        <Stat label="Successful" value={stats.successfulRuns} />
        <Stat label="Avg confidence" value={`${stats.avgConfidence}%`} />
        <Stat label="PRs created" value={stats.prsCreated} />
      </div>

      {/* Recent Runs */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm text-muted-foreground uppercase tracking-wide">Recent runs</h2>
        <Link href="/dashboard/runs" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          View all <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      
      <div className="border border-border rounded-lg divide-y divide-border">
        {recentRuns.map((run) => (
          <Link
            key={run.id}
            href={`/dashboard/runs/${run.id}`}
            className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <StatusDot status={run.status} />
              <div>
                <p className="text-sm font-medium">
                  {run.repo} <span className="text-muted-foreground">#{run.issueNumber}</span>
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-md">
                  {run.issueTitle}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono">{run.confidence}%</p>
              <p className="text-xs text-muted-foreground">
                {formatTimeAgo(run.createdAt)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-2xl font-medium mb-1">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'done' ? 'bg-foreground' : status === 'failed' ? 'bg-muted-foreground' : 'bg-muted-foreground animate-pulse';
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
