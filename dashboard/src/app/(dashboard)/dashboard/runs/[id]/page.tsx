import { ArrowLeft, ArrowUpRight, Check, X } from 'lucide-react';
import Link from 'next/link';

const runData = {
  id: 'run_1',
  repo: 'acme/web-app',
  issueNumber: 142,
  issueTitle: 'Fix login button not responding on mobile',
  issueBody: 'When clicking the login button on mobile devices, nothing happens.',
  status: 'done',
  confidence: 87,
  prUrl: 'https://github.com/acme/web-app/pull/145',
  prNumber: 145,
  branch: 'havoc/fix-142',
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  duration: '12m 34s',
  intentCard: `## Issue Summary
Fix login button not responding on mobile devices. Bug isolated to mobile viewport (<768px).

## Approach
1. Investigated click handler on LoginButton
2. Fixed z-index stacking issue
3. Added touch event handling
4. Added mobile test coverage

## Risk Assessment
- Low: Change isolated to one component
- Medium: Touch events may behave differently on older iOS`,
  policyGates: [
    { name: 'Confidence', passed: true, value: '87%', threshold: '70%' },
    { name: 'Test pass rate', passed: true, value: '100%', threshold: '90%' },
    { name: 'Lint', passed: true, value: '0 errors', threshold: '0' },
    { name: 'Critical issues', passed: true, value: '0', threshold: '0' },
  ],
  filesChanged: [
    { file: 'src/components/LoginButton.tsx', action: 'modified', diff: '+15 -3' },
    { file: 'src/components/LoginButton.css', action: 'modified', diff: '+8 -2' },
    { file: 'tests/LoginButton.mobile.test.tsx', action: 'created', diff: '+45' },
  ],
};

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = runData;

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/runs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3 w-3" />
          Back
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {run.repo} • {run.status === 'done' ? 'Completed' : run.status}
            </p>
            <h1 className="text-lg font-medium">
              #{run.issueNumber}: {run.issueTitle}
            </h1>
          </div>
          
          {run.prUrl && (
            <Link
              href={run.prUrl}
              target="_blank"
              className="px-4 py-2 bg-foreground text-background text-sm rounded-md hover:bg-foreground/90 transition-colors flex items-center gap-2"
            >
              View PR #{run.prNumber}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-6 mb-10 pb-10 border-b border-border">
        <Stat label="Confidence" value={`${run.confidence}%`} />
        <Stat label="Duration" value={run.duration} />
        <Stat label="Files changed" value={run.filesChanged.length} />
        <Stat label="Branch" value={run.branch} mono />
      </div>

      {/* Policy Gates */}
      <section className="mb-10">
        <h2 className="text-sm text-muted-foreground uppercase tracking-wide mb-4">Policy Gates</h2>
        <div className="grid grid-cols-2 gap-3">
          {run.policyGates.map((gate, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-border rounded-md">
              <div className="flex items-center gap-2">
                {gate.passed ? (
                  <Check className="h-4 w-4 text-foreground" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">{gate.name}</span>
              </div>
              <span className="text-sm font-mono text-muted-foreground">{gate.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Files Changed */}
      <section className="mb-10">
        <h2 className="text-sm text-muted-foreground uppercase tracking-wide mb-4">Files Changed</h2>
        <div className="border border-border rounded-md divide-y divide-border">
          {run.filesChanged.map((file, i) => (
            <div key={i} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                  {file.action}
                </span>
                <span className="text-sm font-mono">{file.file}</span>
              </div>
              <span className="text-sm font-mono text-muted-foreground">{file.diff}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Intent Card */}
      <section>
        <h2 className="text-sm text-muted-foreground uppercase tracking-wide mb-4">Intent Card</h2>
        <div className="border border-border rounded-md p-6">
          <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed">
            {run.intentCard}
          </pre>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div>
      <p className={`text-lg font-medium mb-1 ${mono ? 'font-mono text-sm' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
