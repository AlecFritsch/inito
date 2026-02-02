'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import { 
  Terminal, Trash2, Key, Shield, User, Mail, 
  Github, Save, Copy, Check, LogOut, ExternalLink 
} from 'lucide-react';

interface Token {
  token: string;
  createdAt: number;
}

export default function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [activeTab, setActiveTab] = useState<'account' | 'tokens' | 'policies'>('account');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Policy states
  const [minConfidence, setMinConfidence] = useState(70);
  const [minTestPassRate, setMinTestPassRate] = useState(90);
  const [protectedFiles, setProtectedFiles] = useState('.env, .env.*, *.key, *.pem');
  const [maxFiles, setMaxFiles] = useState(25);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSavePolicies = async () => {
    setSaving(true);
    // Simulate save - in real app would call API
    await new Promise(resolve => setTimeout(resolve, 500));
    setSaving(false);
  };

  return (
    <div className="h-full flex flex-col p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white mb-1">Settings</h1>
        <p className="text-sm text-zinc-500">Manage your account, tokens, and default policies</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-8 border-b border-zinc-800/50">
        <Tab 
          active={activeTab === 'account'} 
          onClick={() => setActiveTab('account')}
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
      <div className="flex-1 overflow-auto">
        
        {/* Account Tab */}
        {activeTab === 'account' && user && (
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-start gap-5">
                <img 
                  src={user.imageUrl} 
                  alt={user.fullName || 'User'} 
                  className="w-16 h-16 rounded-full border-2 border-zinc-700"
                />
                <div className="flex-1">
                  <h2 className="text-lg font-medium text-white">{user.fullName || 'User'}</h2>
                  <p className="text-sm text-zinc-500 flex items-center gap-2 mt-1">
                    <Mail className="h-3.5 w-3.5" />
                    {user.primaryEmailAddress?.emailAddress}
                  </p>
                  {user.externalAccounts?.[0]?.username && (
                    <p className="text-sm text-zinc-500 flex items-center gap-2 mt-1">
                      <Github className="h-3.5 w-3.5" />
                      {user.externalAccounts[0].username}
                    </p>
                  )}
                </div>
                <a 
                  href="https://accounts.usehavoc.com/user"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  Edit Profile
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Plan Info */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white mb-1">Current Plan</h3>
                  <p className="text-2xl font-semibold text-white">Free</p>
                  <p className="text-sm text-zinc-500 mt-1">Unlimited public repos • 50 runs/month</p>
                </div>
                <button className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-all">
                  Upgrade to Pro
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="border border-red-900/50 rounded-xl p-6 bg-red-950/20">
              <h3 className="text-sm font-medium text-red-400 mb-3">Danger Zone</h3>
              <button 
                onClick={() => signOut()}
                className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Tokens Tab */}
        {activeTab === 'tokens' && (
          <div className="space-y-6">
            {/* Info Box */}
            <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl p-4">
              <p className="text-sm text-blue-300">
                CLI tokens allow you to authenticate the Havoc CLI. Generate a token by running{' '}
                <code className="bg-blue-900/50 px-1.5 py-0.5 rounded text-xs font-mono">havoc login</code>{' '}
                in your terminal.
              </p>
            </div>

            {/* Tokens List */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              {tokens.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                    <Terminal className="h-7 w-7 text-zinc-500" />
                  </div>
                  <h3 className="text-base font-medium text-white mb-2">No CLI tokens</h3>
                  <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-4">
                    Run the command below in your terminal to create a token.
                  </p>
                  <div className="inline-flex items-center gap-2 bg-zinc-800 px-4 py-2 rounded-lg">
                    <code className="text-sm font-mono text-zinc-300">havoc login</code>
                    <button 
                      onClick={() => copyToClipboard('havoc login')}
                      className="p-1 hover:bg-zinc-700 rounded transition-colors"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-zinc-500" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  <div className="px-4 py-3 bg-zinc-900/80">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Active Tokens</p>
                  </div>
                  {tokens.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <Key className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                          <code className="text-sm font-mono text-white">{t.token.slice(0, 20)}...</code>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Created {new Date(t.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRevokeToken(t.token)}
                        className="px-3 py-1.5 text-xs text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Policies Tab */}
        {activeTab === 'policies' && (
          <div className="space-y-6">
            {/* Info Box */}
            <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-4">
              <p className="text-sm text-amber-300">
                These are your default policy settings. Individual repositories can override these with a{' '}
                <code className="bg-amber-900/50 px-1.5 py-0.5 rounded text-xs font-mono">.havoc.yaml</code>{' '}
                file.
              </p>
            </div>

            {/* Policy Fields */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              <PolicyField
                label="Minimum Confidence Score"
                description="PRs below this score won't be created automatically"
                value={minConfidence}
                onChange={(v) => setMinConfidence(Number(v))}
                type="number"
                suffix="%"
                min={0}
                max={100}
              />
              <PolicyField
                label="Minimum Test Pass Rate"
                description="Required percentage of tests passing before PR creation"
                value={minTestPassRate}
                onChange={(v) => setMinTestPassRate(Number(v))}
                type="number"
                suffix="%"
                min={0}
                max={100}
              />
              <PolicyField
                label="Max Files per PR"
                description="Maximum number of files that can be modified in a single PR"
                value={maxFiles}
                onChange={(v) => setMaxFiles(Number(v))}
                type="number"
                min={1}
                max={100}
              />
              <div className="p-5">
                <label className="text-sm font-medium text-white block mb-1">Protected Files</label>
                <p className="text-xs text-zinc-500 mb-3">Glob patterns for files Havoc should never modify</p>
                <input
                  type="text"
                  value={protectedFiles}
                  onChange={(e) => setProtectedFiles(e.target.value)}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-zinc-500 transition-colors"
                  placeholder=".env, *.key, *.pem"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button 
                onClick={handleSavePolicies}
                disabled={saving}
                className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
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
      className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active 
          ? 'border-white text-white' 
          : 'border-transparent text-zinc-500 hover:text-zinc-300'
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
  value,
  onChange,
  type,
  suffix,
  min,
  max
}: { 
  label: string;
  description: string;
  value: number;
  onChange: (value: string) => void;
  type: string;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-8 p-5">
      <div className="flex-1">
        <label className="text-sm font-medium text-white block mb-0.5">{label}</label>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          className="w-20 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-zinc-500 transition-colors"
        />
        {suffix && <span className="text-sm text-zinc-500 w-4">{suffix}</span>}
      </div>
    </div>
  );
}
