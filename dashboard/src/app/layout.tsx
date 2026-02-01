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
          colorBackground: '#050505',
          colorInputBackground: '#0a0a0a',
          colorInputText: '#f5f5f5',
          colorText: '#f5f5f5',
          colorTextSecondary: '#737373',
        },
        elements: {
          formButtonPrimary: 'bg-white text-black hover:bg-white/90',
          card: 'bg-[#050505] border border-[#1a1a1a]',
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
