'use client';

import { UserProfile, useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import { Terminal, Trash2, Key, Shield, User } from 'lucide-react';

interface Token {
  token: string;
  createdAt: number;
}

export default function SettingsPage() {
  const { user } = useUser();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [activeTab, setActiveTab] = useState<'general' | 'tokens' | 'policies'>('general');

  useEffect(() => {
    if (user) {
      fetch('/api/tokens')
        .then(res => res.json())
        .then(data => setTokens(data.tokens || []))
        .catch(() => {});
    }
  }, [user]);

  const handleRevokeToken = async (tokenToRevoke: string) => {
    try {
      await fetch('/api/tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToRevoke }),
      });
      setTokens(tokens.filter(t => t.token !== tokenToRevoke));
    } catch (error) {
      console.error('Failed to revoke token:', error);
    }
  };

  return (
    <div className="h-full flex flex-col p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white mb-1">Settings</h1>
        <p className="text-sm text-zinc-500">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-zinc-800">
        <Tab 
          active={activeTab === 'general'} 
          onClick={() => setActiveTab('general')}
          icon={<User className="h-4 w-4" />}
        >
          Account
        </Tab>
        <Tab 
          active={activeTab === 'tokens'} 
          onClick={() => setActiveTab('tokens')}
          icon={<Key className="h-4 w-4" />}
        >
          CLI Tokens
        </Tab>
        <Tab 
          active={activeTab === 'policies'} 
          onClick={() => setActiveTab('policies')}
          icon={<Shield className="h-4 w-4" />}
        >
          Policies
        </Tab>
      </div>

      {/* Content */}
      <div className="flex-1">
        {activeTab === 'general' && (
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <UserProfile
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'bg-transparent shadow-none border-0 rounded-none',
                  navbar: 'hidden',
                  pageScrollBox: 'p-6',
                  headerTitle: 'text-sm font-medium text-white',
                  headerSubtitle: 'text-xs text-zinc-500',
                  formFieldInput: 'bg-zinc-900 border-zinc-800 text-white',
                  formButtonPrimary: 'bg-white text-black hover:bg-zinc-200',
                },
              }}
            />
          </div>
        )}

        {activeTab === 'tokens' && (
          <div className="space-y-6">
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              {tokens.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                    <Terminal className="h-6 w-6 text-zinc-500" />
                  </div>
                  <h3 className="text-sm font-medium text-white mb-1">No CLI tokens</h3>
                  <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                    Run <code className="bg-zinc-800 px-2 py-0.5 rounded text-xs font-mono text-zinc-300">havoc login</code> in your terminal to authenticate.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {tokens.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors">
                      <div>
                        <code className="text-sm font-mono text-white">{t.token}</code>
                        <p className="text-xs text-zinc-500 mt-1">
                          Created {new Date(t.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleRevokeToken(t.token)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Revoke token"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'policies' && (
          <div className="space-y-4">
            <PolicyField 
              label="Minimum confidence" 
              description="PRs below this score won't be created automatically"
              type="number"
              defaultValue="70"
              suffix="%"
            />
            
            <PolicyField 
              label="Minimum test pass rate" 
              description="Required percentage of tests passing before PR creation"
              type="number"
              defaultValue="90"
              suffix="%"
            />
            
            <PolicyField 
              label="Protected files" 
              description="Comma-separated patterns that Havoc won't modify"
              type="text"
              defaultValue=".env, .env.*, *.key, *.pem"
              fullWidth
            />

            <PolicyField 
              label="Max files per PR" 
              description="Maximum number of files that can be modified in a single PR"
              type="number"
              defaultValue="25"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Tab({ 
  active, 
  onClick, 
  icon, 
  children 
}: { 
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active 
          ? 'border-white text-white' 
          : 'border-transparent text-zinc-500 hover:text-white'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function PolicyField({ 
  label, 
  description, 
  type, 
  defaultValue,
  suffix,
  fullWidth
}: { 
  label: string;
  description: string;
  type: string;
  defaultValue: string;
  suffix?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-8 p-5 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
      <div className="flex-1">
        <label className="text-sm font-medium text-white block mb-1">{label}</label>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type={type}
          defaultValue={defaultValue}
          className={`bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white text-right focus:outline-none focus:border-zinc-600 transition-colors ${
            fullWidth ? 'w-64' : 'w-24'
          }`}
        />
        {suffix && <span className="text-sm text-zinc-500">{suffix}</span>}
      </div>
    </div>
  );
}
