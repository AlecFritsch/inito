import { currentUser } from '@clerk/nextjs/server';
import { ArrowUpRight, Activity, CheckCircle, TrendingUp, GitPullRequest } from 'lucide-react';
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
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight mb-1">
          {user?.firstName ? `Welcome back, ${user.firstName}` : 'Dashboard'}
        </h1>
        <p className="text-sm text-zinc-500">
          Your Havoc pipeline activity at a glance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard 
          label="Total Runs" 
          value={stats.totalRuns} 
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard 
          label="Successful" 
          value={stats.successfulRuns}
          subtext={`${Math.round((stats.successfulRuns / stats.totalRuns) * 100)}% success rate`}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatCard 
          label="Avg Confidence" 
          value={`${stats.avgConfidence}%`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard 
          label="PRs Created" 
          value={stats.prsCreated}
          icon={<GitPullRequest className="h-4 w-4" />}
        />
      </div>

      {/* Recent Runs */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-300">Recent Runs</h2>
          <Link 
            href="/dashboard/runs" 
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        
        <div className="divide-y divide-zinc-800/50">
          {recentRuns.map((run) => (
            <Link
              key={run.id}
              href={`/dashboard/runs/${run.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <StatusIndicator status={run.status} />
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {run.repo}
                    <span className="text-zinc-500 font-normal ml-1">#{run.issueNumber}</span>
                  </p>
                  <p className="text-xs text-zinc-500 truncate max-w-md mt-0.5">
                    {run.issueTitle}
                  </p>
                </div>
              </div>
              <div className="text-right flex items-center gap-6">
                <ConfidenceBadge confidence={run.confidence} />
                <span className="text-xs text-zinc-600 min-w-[32px]">
                  {formatTimeAgo(run.createdAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  subtext,
  icon 
}: { 
  label: string; 
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <span className="text-zinc-600">{icon}</span>
      </div>
      <p className="text-2xl font-semibold text-zinc-100 tracking-tight">{value}</p>
      {subtext && (
        <p className="text-xs text-zinc-600 mt-1">{subtext}</p>
      )}
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  if (status === 'done') {
    return (
      <div className="w-2 h-2 rounded-full bg-emerald-500" />
    );
  }
  if (status === 'failed') {
    return (
      <div className="w-2 h-2 rounded-full bg-red-500/80" />
    );
  }
  return (
    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
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
