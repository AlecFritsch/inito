import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { Plus, ExternalLink, GitBranch, Activity } from 'lucide-react';

interface Repository {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  isActive: boolean;
  installationId: number | null;
  createdAt: string;
}

async function fetchRepos(): Promise<Repository[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api:3001';
  
  try {
    const response = await fetch(`${API_URL}/api/repos`, {
      headers: {
        'X-User-Id': userId,
      },
      cache: 'no-store',
    });
    
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch repos:', error);
    return [];
  }
}

export default async function ReposPage() {
  const repos = await fetchRepos();

  return (
    <div className="h-full flex flex-col p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white mb-1">Repositories</h1>
          <p className="text-sm text-zinc-500">Connected GitHub repositories</p>
        </div>
        <a
          href="https://github.com/apps/havoc-app/installations/new"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Repository
        </a>
      </div>

      {/* Repos Grid */}
      {repos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 transition-colors bg-zinc-900/30"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <GitBranch className="h-5 w-5 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{repo.name}</h3>
                    <p className="text-xs text-zinc-500">{repo.owner}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  repo.isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                }`}>
                  {repo.isActive ? 'Active' : 'Paused'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3" />
                    Connected {formatDate(repo.createdAt)}
                  </span>
                </div>
                <a
                  href={`https://github.com/${repo.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 border border-zinc-800 border-dashed rounded-lg flex items-center justify-center">
      <div className="text-center py-16">
        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
          <GitBranch className="h-6 w-6 text-zinc-500" />
        </div>
        <h3 className="text-sm font-medium text-white mb-1">No repositories connected</h3>
        <p className="text-sm text-zinc-500 max-w-xs mb-6">
          Install the Havoc GitHub App on your repositories to get started.
        </p>
        <a
          href="https://github.com/apps/havoc-app/installations/new"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Install GitHub App
        </a>
      </div>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
