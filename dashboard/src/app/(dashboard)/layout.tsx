'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Play, GitBranch, Settings } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-zinc-800/50 flex flex-col bg-zinc-950">
        <div className="h-14 flex items-center px-5 border-b border-zinc-800/50">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight text-white">
            havoc
          </Link>
        </div>
        
        <nav className="flex-1 p-3 space-y-1">
          <NavItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
            Overview
          </NavItem>
          <NavItem href="/dashboard/runs" icon={<Play className="h-4 w-4" />}>
            Runs
          </NavItem>
          <NavItem href="/dashboard/repos" icon={<GitBranch className="h-4 w-4" />}>
            Repositories
          </NavItem>
          <NavItem href="/dashboard/settings" icon={<Settings className="h-4 w-4" />}>
            Settings
          </NavItem>
        </nav>

        <div className="p-4 border-t border-zinc-800/50">
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'h-8 w-8',
                },
              }}
            />
            <span className="text-xs text-zinc-500">Account</span>
          </div>
        </div>
      </aside>

      {/* Main content - fullscreen */}
      <main className="flex-1 overflow-auto bg-black">
        {children}
      </main>
    </div>
  );
}

function NavItem({ 
  href, 
  icon, 
  children 
}: { 
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive 
          ? 'bg-zinc-800 text-white' 
          : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
