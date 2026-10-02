import React from 'react';
import { Globe, Cpu, CheckSquare, ArrowRight } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Enter your URL',
      desc: 'Provide the website you want to check. Apex domains, subdomains, and staging environments are supported.',
      icon: Globe,
    },
    {
      num: '02',
      title: 'Run one scan',
      desc: 'The platform analyzes the website across multiple technical areas with automated checks and signal verification.',
      icon: Cpu,
    },
    {
      num: '03',
      title: 'Get a clear readiness report',
      desc: 'See what needs attention, why it matters, and what to fix before launch with clear prioritization.',
      icon: CheckSquare,
    },
  ];

  return (
    <section
      id="how-it-works"
      className="mt-20 sm:mt-28 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24"
      aria-label="How Website Readiness Checker Works"
    >
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-xs font-mono font-medium uppercase tracking-widest text-cyan-400">
          Workflow
        </span>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
          How It Works
        </h2>
        <p className="mt-3 text-sm text-neutral-400">
          A streamlined 3-step workflow engineered for founders, engineering leads, and QA teams.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="relative rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-7 flex flex-col justify-between hover:border-neutral-700 transition-colors"
            >
              {/* Step indicator header */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <span className="font-mono text-2xl font-extrabold text-neutral-600">
                    {step.num}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-neutral-100 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  {step.desc}
                </p>
              </div>

              {idx < 2 && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-neutral-600">
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
