import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, CheckCircle2, XCircle, Clock, Loader2, FileCode, GitBranch } from 'lucide-react';

interface Run {
  id: string;
  repo: string;
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  status: string;
  confidence: number | null;
  prNumber: number | null;
  prUrl: string | null;
  branch: string | null;
  intentCard: string | null;
  plan: any;
  review: any;
  policyResult: any;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

async function fetchRun(id: string): Promise<Run | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api:3001';
  
  try {
    const response = await fetch(`${API_URL}/api/runs/${id}`, {
      headers: {
        'X-User-Id': userId,
      },
      cache: 'no-store',
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch run:', error);
    return null;
  }
}

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await fetchRun(id);

  if (!run) {
    notFound();
  }

  const duration = run.completedAt 
    ? formatDuration(run.startedAt, run.completedAt)
    : null;

  return (
    <div className="h-full overflow-auto p-8">
      {/* Back link */}
      <Link 
        href="/dashboard/runs" 
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to runs
      </Link>
      
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status={run.status} />
            <span className="text-sm text-zinc-500 font-mono">{run.repo}</span>
          </div>
          <h1 className="text-xl font-semibold text-white mb-1">
            #{run.issueNumber}: {run.issueTitle}
          </h1>
          {run.error && (
            <p className="text-sm text-red-400 mt-2">
              Error: {run.error}
            </p>
          )}
        </div>
        
        {run.prUrl && (
          <a
            href={run.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors"
          >
            View PR #{run.prNumber}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="Confidence" 
          value={run.confidence ? `${Math.round(run.confidence * 100)}%` : '—'} 
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard 
          label="Duration" 
          value={duration || 'Running...'} 
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard 
          label="Branch" 
          value={run.branch || '—'} 
          icon={<GitBranch className="h-4 w-4" />}
          mono
        />
        <StatCard 
          label="Started" 
          value={formatDate(run.startedAt)} 
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Issue Body */}
          <Section title="Issue Description">
            <div className="text-sm text-zinc-400 whitespace-pre-wrap">
              {run.issueBody || 'No description provided.'}
            </div>
          </Section>

          {/* Intent Card */}
          {run.intentCard && (
            <Section title="Intent Card">
              <div className="text-sm text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
                {run.intentCard}
              </div>
            </Section>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Policy Result */}
          {run.policyResult && (
            <Section title="Policy Gates">
              <div className="space-y-2">
                <PolicyGate 
                  name="Confidence Score" 
                  passed={run.policyResult.confidence?.passed} 
                  value={run.policyResult.confidence?.value}
                  threshold={run.policyResult.confidence?.threshold}
                />
                <PolicyGate 
                  name="Test Pass Rate" 
                  passed={run.policyResult.tests?.passed} 
                  value={run.policyResult.tests?.value}
                  threshold={run.policyResult.tests?.threshold}
                />
                <PolicyGate 
                  name="Lint Check" 
                  passed={run.policyResult.lint?.passed} 
                  value={run.policyResult.lint?.value}
                />
              </div>
            </Section>
          )}

          {/* Plan */}
          {run.plan && (
            <Section title="Execution Plan">
              <div className="space-y-2">
                {(run.plan.steps || []).map((step: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
                    <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm text-white">{step.description}</p>
                      {step.file && (
                        <p className="text-xs text-zinc-500 font-mono mt-1">{step.file}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Review */}
          {run.review && (
            <Section title="AI Review">
              <div className="text-sm text-zinc-400 whitespace-pre-wrap">
                {run.review.summary || JSON.stringify(run.review, null, 2)}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">{title}</h2>
      <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
        {children}
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon,
  mono 
}: { 
  label: string; 
  value: string;
  icon: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
      <div className="flex items-center gap-2 text-zinc-500 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-lg text-white ${mono ? 'font-mono text-sm' : 'font-medium'} truncate`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    done: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: 'Completed',
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
  };

  const defaultConfig = {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    label: status.charAt(0).toUpperCase() + status.slice(1),
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  const { icon, label, className } = config[status] || defaultConfig;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${className}`}>
      {icon}
      {label}
    </span>
  );
}

function PolicyGate({ 
  name, 
  passed, 
  value, 
  threshold 
}: { 
  name: string;
  passed?: boolean;
  value?: string | number;
  threshold?: string | number;
}) {
  if (passed === undefined) return null;
  
  return (
    <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
      <div className="flex items-center gap-2">
        {passed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400" />
        )}
        <span className="text-sm text-white">{name}</span>
      </div>
      <div className="text-sm font-mono text-zinc-400">
        {value !== undefined && <span>{value}</span>}
        {threshold !== undefined && <span className="text-zinc-600"> / {threshold}</span>}
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
