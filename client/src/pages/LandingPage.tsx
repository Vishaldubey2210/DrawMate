import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar.js';
import { Footer } from '../components/layout/Footer.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Paintbrush,
  Users,
  Trophy,
  Zap,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ArrowRight,
  Send,
  CheckCircle,
  HelpCircle,
  Lock,
  Clock,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: 'What is DrawMate?',
      a: 'DrawMate is an online multiplayer social gaming platform where players take turns drawing a chosen word while others race to guess it in real time through interactive chat.',
    },
    {
      q: 'Can I play with my friends privately?',
      a: 'Yes! DrawMate is architected to support both public matchmaking lobbies and private invite-only rooms with custom round timers, custom words, and max player settings.',
    },
    {
      q: 'How does real-time multiplayer work?',
      a: 'DrawMate features an authoritative real-time WebSocket game engine with ultra-low latency canvas stroke synchronization, live round timers, masked letter hints, and automated score calculation.',
    },
    {
      q: 'Is DrawMate free to play?',
      a: 'Yes, DrawMate is free for all players with no hidden fees or pay-to-win mechanics.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 selection:bg-indigo-500 selection:text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
        {/* Background glow orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-500/10 dark:bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[350px] h-[350px] bg-violet-500/10 dark:bg-violet-600/15 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Headlines & CTA */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>Next-Gen Multiplayer Pictionary Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-slate-950 dark:text-white">
                Draw fast.{' '}
                <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400">
                  Guess faster.
                </span>{' '}
                Win together.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Join friends or players worldwide in real-time drawing matches. Pick your secret word, unleash your creativity on the canvas, and climb global leaderboards.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <Button
                  size="lg"
                  rightIcon={<ArrowRight className="w-5 h-5" />}
                  onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}
                  className="w-full sm:w-auto shadow-lg shadow-indigo-600/25"
                >
                  {isAuthenticated ? 'Enter Dashboard' : 'Play Free Now'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    const el = document.getElementById('how-to-play');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full sm:w-auto"
                >
                  How to Play
                </Button>
              </div>

              {/* Social proof trust bar */}
              <div className="pt-4 flex items-center justify-center lg:justify-start gap-6 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>No downloads required</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Play in any browser</span>
                </div>
              </div>
            </div>

            {/* Right Column: Original Interactive Game Visual Preview */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl p-1 bg-gradient-to-tr from-indigo-500/20 via-violet-500/20 to-amber-500/20 shadow-2xl">
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
                  {/* Mock Game Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Room: #Chill-Sketchers
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" size="sm">
                        Round 2 / 3
                      </Badge>
                      <Badge variant="brand" size="sm" className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        <span>42s</span>
                      </Badge>
                    </div>
                  </div>

                  {/* Secret word hint mockup */}
                  <div className="text-center py-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-[11px] font-mono tracking-widest text-slate-500 dark:text-slate-400">
                      WORD HINT: <strong className="text-indigo-600 dark:text-indigo-400 text-sm tracking-widest font-extrabold">E L E P _ _ _ T</strong> (9 letters)
                    </p>
                  </div>

                  {/* Interactive mock drawing canvas */}
                  <div className="relative aspect-video bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-center overflow-hidden">
                    {/* Mock sketch artwork */}
                    <svg
                      viewBox="0 0 400 220"
                      className="w-full h-full p-4 drop-shadow-sm"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Stylized elephant outline sketch */}
                      <path
                        d="M120 150 C120 100, 160 80, 220 80 C280 80, 310 110, 310 150 C310 170, 280 180, 260 180"
                        stroke="#6366F1"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M160 80 C150 50, 130 50, 120 80 C110 110, 90 140, 100 160 C105 170, 120 170, 125 155"
                        stroke="#6366F1"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                      <circle cx="150" cy="95" r="4" fill="#6366F1" />
                      <path
                        d="M130 135 C115 130, 95 140, 85 160"
                        stroke="#8B5CF6"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                      {/* Drawing pen cursor */}
                      <g transform="translate(85, 155)">
                        <path d="M0 0 L15 -25 L25 -15 L10 10 Z" fill="#F59E0B" />
                        <circle cx="0" cy="0" r="2" fill="#D97706" />
                      </g>
                    </svg>

                    {/* Drawer badge */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-white text-[10px] font-medium flex items-center gap-1.5">
                      <Paintbrush className="w-3 h-3 text-amber-400" />
                      <span>Maya is drawing...</span>
                    </div>
                  </div>

                  {/* Guess chat stream mock */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">Leo:</span>
                      <span className="text-slate-600 dark:text-slate-300">Is it a rhino?</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Sarah guessed the word correctly! (+280 pts)</span>
                      </span>
                    </div>
                  </div>

                  {/* Chat input mock */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      disabled
                      placeholder="Type your guess here..."
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-500"
                    />
                    <button
                      disabled
                      className="p-2 rounded-lg bg-indigo-600 text-white opacity-80"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-20 bg-white dark:bg-[#0E1322] border-y border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <Badge variant="brand">Platform Capabilities</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Engineered for social competition
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Explore the rich features designed to give you fluid multiplayer drawing, instant guess validation, and competitive replayability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors space-y-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Multiplayer Lobbies</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Create public or private rooms with room codes. Invite your squad or match with artists globally.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors space-y-3">
              <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <Paintbrush className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Real-Time Stroke Sync</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Zero-lag vector synchronization over WebSockets with custom brush sizes, color palettes, undo, and fill.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Intelligent Guess Engine</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Instant word matching, fuzzy spelling tolerance, automatic hint reveal over round timers, and fast chat.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Trophy className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Player Stats & Profiles</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Track your win rate, games played, total points, and unlock unique avatar presets as you climb the ranks.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors space-y-3">
              <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Configurable Room Rules</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Customize draw time (15s to 240s), round count (2 to 10), word count choices, and private passwords.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors space-y-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-950 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Safe & Moderated</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Strict profanity filtering, host votekick/ban moderation tools, and secure session protection.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How to Play Section */}
      <section id="how-to-play" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <Badge variant="warning">Quick Guide</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              How to Play in 5 Easy Steps
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Jump straight into the action in seconds — no complex setup needed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 text-center">
            {[
              { step: '01', title: 'Sign Up', desc: 'Create your DrawMate account and customize your avatar.' },
              { step: '02', title: 'Join a Room', desc: 'Enter a public match or start a private room with friends.' },
              { step: '03', title: 'Pick a Word', desc: 'When it is your turn, pick from 3 to 5 secret word choices.' },
              { step: '04', title: 'Draw & Guess', desc: 'Sketch on the live canvas while others type guesses in chat.' },
              { step: '05', title: 'Earn & Win', desc: 'Score points based on speed and accuracy to top the board!' },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 relative group hover:border-indigo-500 transition-colors"
              >
                <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-extrabold text-sm border border-indigo-200 dark:border-indigo-800">
                  {item.step}
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base">{item.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-white dark:bg-[#0E1322] border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-3">
            <Badge variant="neutral">Support</Badge>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm sm:text-base font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-indigo-500 shrink-0" />
                    <span>{faq.q}</span>
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform duration-200 shrink-0 ${
                      openFaq === idx ? 'rotate-180 text-indigo-500' : 'text-slate-400'
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Conversion Banner Section */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white text-center space-y-6 shadow-2xl">
            <div className="space-y-3 relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Ready to test your drawing skills?
              </h2>
              <p className="text-indigo-100 text-sm sm:text-base">
                Join our community of sketchers today. Sign up in under 30 seconds and set up your customized player profile.
              </p>
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}
                className="w-full sm:w-auto font-bold bg-white text-indigo-900 hover:bg-slate-100"
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Create Free Account'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
