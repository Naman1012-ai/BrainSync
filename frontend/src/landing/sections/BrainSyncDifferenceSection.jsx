import React from 'react';
import { MessageSquare, Zap, FileText, GitBranch, ArrowRight, Sparkles } from 'lucide-react';

const PIPELINE_NODES = [
  {
    tool: 'Discord',
    action: 'COMMUNICATES',
    role: 'Real-time team chat & voice sync',
    icon: MessageSquare,
    color: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10',
  },
  {
    tool: 'BrainSync',
    action: 'DECIDES',
    role: 'Ideation, voting & AI technical blueprint',
    icon: Zap,
    highlight: true,
    color: 'border-purple-500/50 text-purple-300 bg-purple-600 shadow-xl shadow-purple-500/30',
  },
  {
    tool: 'Notion',
    action: 'DOCUMENTS',
    role: 'Wiki docs & long-term knowledge base',
    icon: FileText,
    color: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  },
  {
    tool: 'GitHub',
    action: 'BUILDS',
    role: 'Source code, PRs & CI/CD deployment',
    icon: GitBranch,
    color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  },
];

export function BrainSyncDifferenceSection() {
  return (
    <section className="py-24 bg-slate-950 border-b border-slate-800/80 relative overflow-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[30rem] w-[30rem] rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>The Missing Link in Your Toolchain</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            BrainSync Doesn&apos;t Replace Your Tools. <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-500 bg-clip-text text-transparent">
              It Decides What Deserves To Be Built.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-slate-300 font-medium">
            BrainSync bridges the critical gap between team communication and source code execution.
          </p>
        </div>

        {/* Signature Pipeline Visual */}
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {PIPELINE_NODES.map((node, idx) => {
              const IconComp = node.icon;
              return (
                <React.Fragment key={node.tool}>
                  <div
                    className={`p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-4 relative ${
                      node.highlight
                        ? 'bg-gradient-to-b from-purple-950/90 to-slate-950 border-purple-500/60 shadow-2xl shadow-purple-950/60 ring-1 ring-purple-500/30 scale-105'
                        : 'bg-slate-950/90 border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-xl border ${node.color} ${node.highlight ? 'text-white' : ''}`}>
                        <IconComp className="h-5 w-5" />
                      </div>
                      <span
                        className={`text-[10px] font-mono font-extrabold px-2.5 py-1 rounded-md border ${
                          node.highlight
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {node.action}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xl font-extrabold text-white">{node.tool}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed font-medium mt-1">
                        {node.role}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Explanation Banner */}
          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800/80 text-center max-w-2xl mx-auto space-y-2">
            <p className="text-sm text-slate-200 font-semibold">
              <strong className="text-indigo-400">Discord</strong> communicates &bull; <strong className="text-purple-400">BrainSync</strong> decides &bull; <strong className="text-amber-400">Notion</strong> documents &bull; <strong className="text-emerald-400">GitHub</strong> builds.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
