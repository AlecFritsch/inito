import { Plus, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const repos = [
  {
    id: 'repo_1',
    fullName: 'acme/web-app',
    isActive: true,
    runsCount: 28,
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'repo_2',
    fullName: 'acme/api-server',
    isActive: true,
    runsCount: 15,
    lastRun: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: 'repo_3',
    fullName: 'acme/mobile-app',
    isActive: false,
    runsCount: 4,
    lastRun: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
];

export default function ReposPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-medium mb-1">Repositories</h1>
          <p className="text-sm text-muted-foreground">Connected GitHub repositories</p>
        </div>
        <Link
          href="https://github.com/apps/havoc-app/installations/new"
          target="_blank"
          className="px-4 py-2 bg-foreground text-background text-sm rounded-md hover:bg-foreground/90 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add repo
        </Link>
      </div>

      <div className="space-y-3">
        {repos.map((repo) => (
          <div
            key={repo.id}
            className="flex items-center justify-between p-4 border border-border rounded-md hover:bg-secondary/20 transition-colors"
          >
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="font-mono text-sm">{repo.fullName}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${repo.isActive ? 'bg-secondary text-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  {repo.isActive ? 'active' : 'paused'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {repo.runsCount} runs • Last run {formatTimeAgo(repo.lastRun)}
              </p>
            </div>
            
            <Link
              href={`https://github.com/${repo.fullName}`}
              target="_blank"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              GitHub <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>

      {repos.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-md">
          <p className="text-sm text-muted-foreground mb-4">No repositories connected</p>
          <Link
            href="https://github.com/apps/havoc-app/installations/new"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm rounded-md"
          >
            <Plus className="h-4 w-4" />
            Install GitHub App
          </Link>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
