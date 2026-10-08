import { CircleDot, RefreshCw, FolderKanban, Map, Inbox } from 'lucide-react';

import { Reveal } from '@/components/marketing/reveal';

const features = [
   {
      icon: CircleDot,
      title: 'Issue tracking',
      description:
         'Create, triage, and prioritize issues with a keyboard-first workflow built for velocity.',
   },
   {
      icon: RefreshCw,
      title: 'Cycles',
      description:
         'Plan focused sprints with automatic scope rollover so nothing falls through the cracks.',
   },
   {
      icon: FolderKanban,
      title: 'Projects',
      description:
         'Group related issues into projects and track health, targets, and progress at a glance.',
   },
   {
      icon: Map,
      title: 'Initiatives',
      description:
         'Roll up projects across teams into a strategic roadmap for leadership visibility.',
   },
   {
      icon: Inbox,
      title: 'Unified inbox',
      description:
         'Mentions, assignments, and status changes land in one place so nothing gets missed.',
   },
];

export function FeaturesSection() {
   return (
      <section id="features" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
         <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
               Everything your team needs to ship
            </h2>
            <p className="mt-4 text-muted-foreground">
               One workspace for planning, tracking, and shipping work — from a single issue to a
               multi-quarter initiative.
            </p>
         </Reveal>

         <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
               <Reveal key={feature.title} delay={(index % 3) * 0.08}>
                  <div className="h-full rounded-xl border border-border/60 bg-card/60 p-6 transition-colors hover:border-border">
                     <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-tr from-orange-600/15 to-amber-500/15 text-orange-500">
                        <feature.icon className="size-5" />
                     </div>
                     <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                     <p className="mt-1.5 text-sm text-muted-foreground">{feature.description}</p>
                  </div>
               </Reveal>
            ))}
         </div>
      </section>
   );
}
