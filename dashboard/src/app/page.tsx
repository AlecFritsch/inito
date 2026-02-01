import Link from 'next/link';
import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex h-14 items-center justify-between px-6">
          <Link href="/" className="text-sm font-medium tracking-tight">
            havoc
          </Link>
          
          <div className="flex items-center gap-6">
            <Link href="https://github.com/usehavoc/havoc" target="_blank" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              GitHub
            </Link>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="text-sm px-4 py-1.5 bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors">
                  Get started
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link 
                href="/dashboard"
                className="text-sm px-4 py-1.5 bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors"
              >
                Dashboard
              </Link>
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground mb-6 tracking-wide uppercase">
            The Trust Layer for AI-Generated Code
          </p>
          
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.1] mb-6">
            Every AI-generated PR deserves an explanation.
          </h1>
          
          <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-xl">
            Havoc transforms GitHub Issues into Pull Requests with complete transparency. 
            See what changed, why it changed, and how confident the AI is.
          </p>
          
          <div className="flex items-center gap-4">
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="px-6 py-2.5 bg-foreground text-background text-sm font-medium rounded-md hover:bg-foreground/90 transition-colors flex items-center gap-2">
                  Start for free
                  <ArrowRight className="h-4 w-4" />
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link 
                href="/dashboard"
                className="px-6 py-2.5 bg-foreground text-background text-sm font-medium rounded-md hover:bg-foreground/90 transition-colors flex items-center gap-2"
              >
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </SignedIn>
            <Link 
              href="https://github.com/usehavoc/havoc"
              target="_blank"
              className="px-6 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
            >
              View source
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm text-muted-foreground mb-12 tracking-wide uppercase">
            How it works
          </h2>
          
          <div className="space-y-12">
            <Step number="01" title="Trigger">
              Label a GitHub issue with <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">havoc</code> or 
              comment <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">/havoc run</code>
            </Step>
            
            <Step number="02" title="Process">
              Havoc analyzes the issue, creates a plan, writes code, runs tests, and reviews itself — 
              all in an isolated container.
            </Step>
            
            <Step number="03" title="Verify">
              Every PR includes an Intent Card explaining what changed and why, 
              plus a confidence score based on tests, lint, and complexity.
            </Step>
            
            <Step number="04" title="Ship">
              If policy gates pass, a PR is created automatically. 
              If not, you get a detailed report on what failed.
            </Step>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm text-muted-foreground mb-12 tracking-wide uppercase">
            Features
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Feature title="Intent Card">
              Complete explanation of every change: files modified, rationale, risks identified.
            </Feature>
            <Feature title="Confidence Score">
              0-100% score based on test pass rate, lint status, complexity, and self-review.
            </Feature>
            <Feature title="Policy Gates">
              Configurable thresholds. PRs below your standards are blocked automatically.
            </Feature>
            <Feature title="Self-Review">
              AI critiques its own code before submission. Catches issues humans might miss.
            </Feature>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-medium mb-4">
            Ready to trust AI-generated code?
          </h2>
          <p className="text-muted-foreground mb-8">
            Free for open source. Pro plans for teams.
          </p>
          <SignedOut>
            <SignUpButton mode="modal">
              <button className="px-6 py-2.5 bg-foreground text-background text-sm font-medium rounded-md hover:bg-foreground/90 transition-colors">
                Get started
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link 
              href="/dashboard"
              className="inline-block px-6 py-2.5 bg-foreground text-background text-sm font-medium rounded-md hover:bg-foreground/90 transition-colors"
            >
              Open Dashboard
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>havoc</span>
          <span>usehavoc.dev</span>
        </div>
      </footer>
    </div>
  );
}

function Step({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[60px_1fr] gap-4">
      <span className="text-sm text-muted-foreground font-mono">{number}</span>
      <div>
        <h3 className="font-medium mb-2">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
