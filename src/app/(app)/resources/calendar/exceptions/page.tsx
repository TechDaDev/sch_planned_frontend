import type { Metadata } from 'next';

import { CalendarExceptionsScreen } from '@/components/resources/screens/calendar-exceptions-screen';

export const metadata: Metadata = {
  title: 'Calendar Exceptions',
};

export default function CalendarExceptionsPage() {
  return <CalendarExceptionsScreen />;
}
