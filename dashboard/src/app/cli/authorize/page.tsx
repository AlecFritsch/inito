'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function CLIAuthorizePage() {
  const { user, isLoaded } = useUser();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setStatus('loading');
    setError('');

    try {
      const response = await fetch('/api/cli/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode: code }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setError(result.error || 'Invalid or expired code');
      }
    } catch {
      setStatus('error');
      setError('Something went wrong');
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-lg font-medium mb-2">Sign in required</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Sign in to authorize the Havoc CLI
          </p>
          <Link
            href="/sign-in?redirect_url=/cli/authorize"
            className="inline-block px-6 py-2 bg-foreground text-background text-sm rounded-md"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-foreground/10 flex items-center justify-center mx-auto mb-4">
            <Check className="h-6 w-6 text-foreground" />
          </div>
          <h1 className="text-lg font-medium mb-2">CLI Authorized</h1>
          <p className="text-sm text-muted-foreground mb-6">
            You can close this window and return to your terminal.
          </p>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-lg font-medium mb-2">Authorize Havoc CLI</h1>
          <p className="text-sm text-muted-foreground">
            Enter the code shown in your terminal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="w-full bg-transparent border border-border rounded-md px-4 py-3 text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-border"
              maxLength={9}
              autoFocus
            />
          </div>

          {status === 'error' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={code.length < 9 || status === 'loading'}
            className="w-full px-4 py-3 bg-foreground text-background text-sm font-medium rounded-md hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'Authorizing...' : 'Authorize'}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Logged in as {user.primaryEmailAddress?.emailAddress}
        </p>
      </div>
    </div>
  );
}
