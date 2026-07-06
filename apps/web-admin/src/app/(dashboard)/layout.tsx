import type { ReactNode } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
