import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Github, Heart, Twitter, Linkedin, MessageSquare, Shield, Globe } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <Link
              to="/"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 group w-fit"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white font-bold shadow-md shadow-purple-500/20">
                <Zap className="h-5 w-5 fill-current" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Brain<span className="text-purple-400">Sync</span>
              </span>
            </Link>

            <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-sm">
              Real-Time AI-Powered Collaborative Ideation & Project Consensus Platform. Transform scattered ideas into winning hackathon MVPs in minutes.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-purple-500/40 transition-all"
                aria-label="GitHub Repository"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-purple-500/40 transition-all"
                aria-label="Twitter Profile"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-purple-500/40 transition-all"
                aria-label="LinkedIn Profile"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3 text-xs">
            <p className="font-mono font-bold text-white uppercase tracking-wider">Product</p>
            <ul className="space-y-2 font-medium">
              <li><a href="#features" className="hover:text-white transition-colors">Ideation Board</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Community Voting</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">AI Blueprint Engine</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Kanban Task Board</a></li>
              <li><Link to="/explore" className="hover:text-white transition-colors">Public Ideas Feed</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3 text-xs">
            <p className="font-mono font-bold text-white uppercase tracking-wider">Resources</p>
            <ul className="space-y-2 font-medium">
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
              <li><a href="#use-cases" className="hover:text-white transition-colors">Use Cases</a></li>
              <li><a href="#roadmap" className="hover:text-white transition-colors">Product Roadmap</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing Structure</a></li>
              <li><a href="#faq-comprehensive" className="hover:text-white transition-colors">FAQ & Support</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3 text-xs">
            <p className="font-mono font-bold text-white uppercase tracking-wider">Legal & Trust</p>
            <ul className="space-y-2 font-medium">
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact Engineering
                </Link>
              </li>
              <li>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> All Systems Normal
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium gap-4">
          <div>
            &copy; {new Date().getFullYear()} BrainSync Platform. All rights reserved.
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-purple-300">
              Version v1.0.0
            </span>
            <span className="flex items-center gap-1">
              Crafted with <Heart className="h-3 w-3 text-rose-500 fill-current" /> for Builders
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
