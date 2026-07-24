import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Sparkles } from 'lucide-react';

const COMPREHENSIVE_FAQS = [
  {
    q: 'What is BrainSync?',
    a: 'BrainSync is a real-time collaborative ideation platform designed specifically for hackathon teams and builder groups to move from scattered brainstorms to a selected MVP proposal and AI technical blueprint in minutes.',
  },
  {
    q: 'How is BrainSync different from Discord?',
    a: 'Discord is best for real-time team chat and voice calls. BrainSync is a structured decision engine—proposals, suggestions, and votes are kept in clean dedicated channels so decisions never get lost in chat streams.',
  },
  {
    q: 'Can I still use Notion alongside BrainSync?',
    a: 'Yes! BrainSync decides what deserves to be built during the critical first hour, while Notion remains excellent for long-term documentation and knowledge wikis.',
  },
  {
    q: 'Can I export my projects and blueprints?',
    a: 'Yes. All project proposals, AI technical blueprints, REST endpoints, database schemas, and Kanban task boards can be exported anytime in Markdown or JSON format.',
  },
  {
    q: 'Is BrainSync free for hackathons and students?',
    a: 'BrainSync is 100% free for hackathon participants, student teams, and open-source contributors. You can create unlimited workspaces and proposals.',
  },
  {
    q: 'How does the AI Technical Blueprint Generator work?',
    a: 'Once your workspace lead locks the winning MVP proposal, BrainSync analyzes the problem statement, proposed tech stack, and solution architecture to automatically generate system specs, database models, API endpoints, and Kanban task cards.',
  },
  {
    q: 'Can my entire team collaborate in real time?',
    a: 'Yes! BrainSync utilizes Firebase Realtime Database to deliver sub-second state synchronization across all workspace members for proposals, upvotes, and comments.',
  },
];

export function ComprehensiveFaqSection() {
  const [openIdx, setOpenIdx] = useState(0);

  const toggleFaq = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq-comprehensive" className="py-24 bg-slate-950/95 border-b border-slate-800/80 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Frequently Asked Questions</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Everything You Need To Know
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Clear answers to help your team get started quickly.
          </p>
        </div>

        <div className="space-y-4">
          {COMPREHENSIVE_FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={faq.q}
                className="rounded-2xl bg-slate-900/80 border border-slate-800/80 overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none focus:bg-slate-800/50"
                  aria-expanded={isOpen}
                >
                  <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                    {faq.q}
                  </h3>
                  <div
                    className={`p-1.5 rounded-lg bg-slate-800 text-slate-300 transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 bg-purple-600/20 text-purple-300' : ''
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm text-slate-300 leading-relaxed font-medium border-t border-slate-800/50 animate-in fade-in duration-200">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
