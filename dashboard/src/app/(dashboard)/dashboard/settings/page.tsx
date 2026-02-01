'use client';

import { UserProfile, useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import { Terminal, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useUser();
  const [tokens, setTokens] = useState<Array<{ token: string; createdAt: number }>>([]);

  useEffect(() => {
    if (user) {
      fetch('/api/tokens')
        .then(res => res.json())
        .then(data => setTokens(data.tokens || []))
        .catch(() => {});
    }
  }, [user]);

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-lg font-medium mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and policies</p>
      </div>

      {/* CLI Tokens */}
      <section className="mb-10">
        <h2 className="text-sm text-muted-foreground uppercase tracking-wide mb-4">CLI Tokens</h2>
        
        <div className="border border-border rounded-md divide-y divide-border">
          {tokens.length === 0 ? (
            <div className="p-6 text-center">
              <Terminal className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-2">No CLI tokens</p>
              <p className="text-xs text-muted-foreground">
                Run <code className="bg-muted px-1.5 py-0.5 rounded font-mono">havoc login</code> to connect
              </p>
            </div>
          ) : (
            tokens.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div>
                  <code className="text-sm font-mono">{t.token}</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button 
                  className="p-2 text-muted-foreground hover:text-foreground"
                  title="Revoke token"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Default Policies */}
      <section className="mb-10">
        <h2 className="text-sm text-muted-foreground uppercase tracking-wide mb-4">Default Policies</h2>
        
        <div className="space-y-4">
          <Field 
            label="Minimum confidence" 
            description="PRs below this score won't be created"
            type="number"
            defaultValue="70"
            suffix="%"
          />
          
          <Field 
            label="Minimum test pass rate" 
            description="Required percentage of tests passing"
            type="number"
            defaultValue="90"
            suffix="%"
          />
          
          <Field 
            label="Protected files" 
            description="Comma-separated patterns that Havoc won't modify"
            type="text"
            defaultValue=".env, .env.*, *.key, *.pem"
          />
        </div>
      </section>

      {/* Account */}
      <section>
        <h2 className="text-sm text-muted-foreground uppercase tracking-wide mb-4">Account</h2>
        
        <div className="border border-border rounded-md overflow-hidden">
          <UserProfile
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'bg-transparent shadow-none border-0 rounded-none',
                navbar: 'hidden',
                pageScrollBox: 'p-4',
                headerTitle: 'text-sm font-medium',
                headerSubtitle: 'text-xs text-muted-foreground',
              },
            }}
          />
        </div>
      </section>
    </div>
  );
}

function Field({ 
  label, 
  description, 
  type, 
  defaultValue,
  suffix
}: { 
  label: string;
  description: string;
  type: string;
  defaultValue: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-8 p-4 border border-border rounded-md">
      <div className="flex-1">
        <label className="text-sm font-medium block mb-1">{label}</label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type={type}
          defaultValue={defaultValue}
          className="w-24 bg-transparent border border-border rounded px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-border"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
