import { SessionProvider } from '@/components/providers/session-provider';

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-background">{children}</div>
    </SessionProvider>
  );
}
