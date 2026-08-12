import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { WorkflowVisualizer } from '../components/WorkflowVisualizer';
import { DemoModal } from '../components/DemoModal';

export function HeroSection() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
      {/* Background Radial Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-purple-900/30 via-indigo-900/15 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-20 left-1/4 h-80 w-80 rounded-full bg-purple-600/10 blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 right-1/4 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none -z-10" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold shadow-lg shadow-purple-950/40 animate-in fade-in slide-in-from-top-2 duration-300">
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          <span>Real-Time Hackathon & Project Consensus Platform</span>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="space-y-6 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.15]">
            Decide What to Build <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-500 bg-clip-text text-transparent">
              Before Everyone Else.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-300 font-medium leading-relaxed max-w-2xl mx-auto">
            BrainSync helps hackathon teams transform scattered ideas into one winning project in minutes—not hours.
          </p>
        </div>

        {/* CTA Button Group */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            to="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white font-extrabold text-sm shadow-xl shadow-purple-600/30 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
          >
            <span>Create Free Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <button
            onClick={() => setIsDemoOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="p-1 rounded-lg bg-purple-500/20 text-purple-400">
              <Play className="h-3.5 w-3.5 fill-current" />
            </div>
            <span>Watch Product Demo</span>
          </button>
        </div>

        {/* Animated Workflow Visualization Visual */}
        <div className="pt-8 max-w-5xl mx-auto">
          <WorkflowVisualizer />
        </div>
      </div>

      {/* Product Demo Modal */}
      <DemoModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </section>
  );
}
