import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'College Academic Schedule Planner',
    template: '%s | College Academic Schedule Planner',
  },
  description:
    'Operational planning system for college academic schedules, resources and teaching timetables.',
  applicationName: 'College Academic Schedule Planner',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
