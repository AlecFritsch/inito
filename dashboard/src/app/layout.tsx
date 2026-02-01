import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import './globals.css';

export const metadata: Metadata = {
  title: 'Havoc',
  description: 'The Trust Layer for AI-Generated Code',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#fff',
          colorBackground: '#18181b',
          colorInputBackground: '#27272a',
          colorInputText: '#fafafa',
          colorText: '#fafafa',
          colorTextSecondary: '#a1a1aa',
          borderRadius: '0.5rem',
        },
        elements: {
          formButtonPrimary: 'bg-white text-black hover:bg-white/90',
          card: 'bg-[#18181b] border border-[#3f3f46] shadow-2xl',
          headerTitle: 'text-white',
          headerSubtitle: 'text-zinc-400',
          socialButtonsBlockButton: 'bg-[#27272a] border-[#3f3f46] hover:bg-[#3f3f46]',
          formFieldInput: 'bg-[#27272a] border-[#3f3f46]',
          footerActionLink: 'text-white hover:text-zinc-300',
        },
      }}
    >
      <html lang="en" className="dark">
        <body className="antialiased font-sans">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
