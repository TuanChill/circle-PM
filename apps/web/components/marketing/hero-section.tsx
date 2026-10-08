'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, Circle, CircleDot, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Reveal } from '@/components/marketing/reveal';
import { ROUTES } from '@/constants/routes';

const previewIssues = [
   {
      icon: CheckCircle2,
      iconClass: 'text-violet-500',
      title: 'Design onboarding wizard',
      team: 'DES-12',
      priority: 'Urgent',
   },
   {
      icon: CircleDot,
      iconClass: 'text-amber-500',
      title: 'Set up cycle rollover logic',
      team: 'ENG-84',
      priority: 'High',
   },
   {
      icon: Circle,
      iconClass: 'text-muted-foreground',
      title: 'Draft Q2 initiative roadmap',
      team: 'PM-03',
      priority: 'Medium',
   },
];

const issueListVariants = {
   hidden: {},
   visible: { transition: { staggerChildren: 0.08, delayChildren: 0.35 } },
};

const issueRowVariants = {
   hidden: { opacity: 0, x: -8 },
   visible: { opacity: 1, x: 0, transition: { duration: 0.35 } },
};

export function HeroSection() {
   return (
      <section className="relative overflow-hidden px-4 pt-20 pb-24 sm:px-6 sm:pt-28">
         <div
            className="motion-safe:animate-pulse pointer-events-none absolute -top-40 left-1/2 h-[350px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl [animation-duration:8s]"
            aria-hidden
         />

         <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
            <Reveal delay={0.08}>
               <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                  Project management, built for speed.
               </h1>
            </Reveal>

            <Reveal delay={0.16}>
               <p className="mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
                  The modern issue tracker for high-performing engineering teams — plan cycles,
                  track initiatives, and ship faster without leaving the keyboard.
               </p>
            </Reveal>

            <Reveal delay={0.24}>
               <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" asChild>
                     <Link href={ROUTES.AUTH.SIGNUP}>
                        Get started free
                        <ArrowRight className="size-4" />
                     </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                     <Link href={ROUTES.AUTH.LOGIN}>Sign in</Link>
                  </Button>
               </div>
            </Reveal>
         </div>

         <Reveal delay={0.3} y={24} className="relative mx-auto mt-16 max-w-4xl">
            <div className="rounded-2xl border border-border/60 bg-card/60 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
               <div className="rounded-xl border border-border/60 bg-container overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                     <span className="size-2.5 rounded-full bg-red-500/70" />
                     <span className="size-2.5 rounded-full bg-amber-500/70" />
                     <span className="size-2.5 rounded-full bg-emerald-500/70" />
                     <span className="ml-3 text-xs font-medium text-muted-foreground">
                        Engineering &middot; Active Cycle
                     </span>
                  </div>
                  <motion.ul
                     className="divide-y divide-border/60"
                     initial="hidden"
                     whileInView="visible"
                     viewport={{ once: true, margin: '-80px' }}
                     variants={issueListVariants}
                  >
                     {previewIssues.map((issue) => (
                        <motion.li
                           key={issue.team}
                           variants={issueRowVariants}
                           className="flex items-center gap-3 px-4 py-3 text-sm"
                        >
                           <issue.icon className={`size-4 shrink-0 ${issue.iconClass}`} />
                           <span className="font-mono text-xs text-muted-foreground">
                              {issue.team}
                           </span>
                           <span className="flex-1 truncate text-left">{issue.title}</span>
                           <Badge variant="secondary" className="text-[10px]">
                              {issue.priority}
                           </Badge>
                        </motion.li>
                     ))}
                  </motion.ul>
               </div>
            </div>
         </Reveal>
      </section>
   );
}
