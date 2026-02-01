import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'bg-card border border-border shadow-none',
            headerTitle: 'text-lg font-medium',
            headerSubtitle: 'text-sm text-muted-foreground',
            socialButtonsBlockButton: 'bg-muted border-border hover:bg-muted-foreground/10',
            formButtonPrimary: 'bg-foreground hover:bg-foreground/90',
            formFieldInput: 'bg-transparent border-border',
            footerActionLink: 'text-foreground hover:text-foreground/80',
          },
        }}
      />
    </div>
  );
}
