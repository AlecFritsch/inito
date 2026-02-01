import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { LayoutDashboard, Play, GitBranch, Settings } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border flex flex-col">
        <div className="h-14 flex items-center px-5 border-b border-border">
          <Link href="/dashboard" className="text-sm font-medium tracking-tight">
            havoc
          </Link>
        </div>
        
        <nav className="flex-1 p-3 space-y-0.5">
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

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'h-8 w-8',
                },
              }}
            />
            <span className="text-xs text-muted-foreground">Account</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
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
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
    >
      {icon}
      {children}
    </Link>
  );
}
