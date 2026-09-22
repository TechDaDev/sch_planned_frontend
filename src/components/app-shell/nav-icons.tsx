import {
  BarChart3,
  Boxes,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
  Upload,
  type LucideIcon,
} from 'lucide-react';

import type { NavIconKey } from '@/lib/navigation/navigation';

/** Icon registry so the navigation configuration stays free of JSX imports. */
export const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  academic: GraduationCap,
  resources: Boxes,
  scheduling: CalendarRange,
  reports: BarChart3,
  audit: ScrollText,
  timetable: CalendarDays,
  published: CalendarCheck,
  imports: Upload,
  forbidden: ShieldAlert,
};
