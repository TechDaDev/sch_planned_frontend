import Link from 'next/link';
import * as React from 'react';

import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';

export interface AcademicModuleLink {
  href: string;
  label: string;
  description: string;
}

export interface AcademicModuleGroupProps {
  title: string;
  links: readonly AcademicModuleLink[];
}

/**
 * Landing-page group of academic destinations.
 *
 * Contains no counts: nothing on the overview page is fetched, so nothing is
 * presented as if it were data.
 */
export function AcademicModuleGroup({ title, links }: AcademicModuleGroupProps) {
  return (
    <section aria-labelledby={`group-${title}`} className="space-y-3">
      <h2 id={`group-${title}`} className="text-base font-semibold">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {links.map((link) => (
          <Card key={link.href}>
            <CardHeader>
              <CardTitle>
                <Link href={link.href} className="hover:underline">
                  {link.label}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-muted-foreground">{link.description}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}
