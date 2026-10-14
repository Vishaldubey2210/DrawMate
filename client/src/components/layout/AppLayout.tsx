import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { AppLogo } from '../ui/AppLogo.js';
import { Avatar } from '../ui/Avatar.js';
import { ThemeToggle } from '../ui/ThemeToggle.js';
import { Badge } from '../ui/Badge.js';
import { ConfirmDialog } from '../ui/ConfirmDialog.js';
import {
  LayoutDashboard,
  Gamepad2,
  Trophy,
  Users,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  BookOpen,
  History,
  Brain,
  Shield,
  MessageSquare,
} from 'lucide-react';
import { FeedbackModal } from '../feedback/FeedbackModal.js';
import { NotificationBell } from '../notifications/NotificationBell.js';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      toast.success('Signed out safely.');
      navigate('/login');
    } catch {
      toast.error('Failed to log out.');
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmOpen(false);
    }
  };

  interface NavItem {
    name: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }

  const navItems: NavItem[] = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    {
      name: 'Game Rooms',
      path: '/rooms',
      icon: Gamepad2,
    },
    {
      name: 'Word Packs',
      path: '/word-packs',
      icon: BookOpen,
    },
    {
      name: 'Match History',
      path: '/history',
      icon: History,
    },
    {
      name: 'Leaderboards',
      path: '/leaderboards',
      icon: Trophy,
    },
    {
      name: 'Friends',
      path: '/friends',
      icon: Users,
    },
    {
      name: 'AI Practice',
      path: '/practice',
      icon: Brain,
      badge: 'AI',
    },
    { name: 'Profile', path: '/profile', icon: User },
    { name: 'Settings', path: '/settings', icon: Settings },
    ...(user?.role === 'admin' || user?.role === 'moderator'
      ? [{ name: 'Admin Console', path: '/admin', icon: Shield, badge: 'Staff' }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0D121F] shrink-0 sticky top-0 h-screen justify-between p-4">
        <div className="space-y-6">
          <div className="px-2 pt-2">
            <AppLogo linkTo="/dashboard" />
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Player Mini Card & Quick Logout */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
          <NavLink
            to="/profile"
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          >
            <Avatar avatarId={user?.avatar} size="sm" />
            <div className="truncate flex-1">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {user?.displayName}
              </p>
              <p className="text-[11px] text-slate-400 truncate">@{user?.username}</p>
            </div>
          </NavLink>
          <button
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <span className="text-xs font-medium text-slate-400">Platform / </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
                {location.pathname.replace('/', '') || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-800/60"
              title="Submit Beta Bug or Feedback"
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Beta Feedback</span>
            </button>

            <ThemeToggle compact />

            {/* Real-Time Notification Bell */}
            <NotificationBell />

            {/* Account Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Avatar avatarId={user?.avatar} size="sm" />
                <span className="hidden md:block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {user?.displayName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-2 z-40 space-y-1 text-xs"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {user?.displayName}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">@{user?.username}</p>
                  </div>
                  <NavLink
                    to="/profile"
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>View Profile</span>
                  </NavLink>
                  <NavLink
                    to="/settings"
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Account Settings</span>
                  </NavLink>
                  {(user?.role === 'admin' || user?.role === 'moderator') && (
                    <NavLink
                      to="/admin"
                      className="flex items-center gap-2.5 px-4 py-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium"
                    >
                      <Shield className="w-4 h-4 text-indigo-500" />
                      <span>Admin Console</span>
                    </NavLink>
                  )}
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setIsLogoutConfirmOpen(true)}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Routed Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-xs bg-white dark:bg-[#0D121F] h-full p-5 flex flex-col justify-between shadow-2xl z-10 border-r border-slate-200 dark:border-slate-800">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2">
                <AppLogo />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsLogoutConfirmOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Sign Out of DrawMate?"
        message="Are you sure you want to end your current session? You can sign back in anytime."
        confirmText="Sign Out"
        isLoading={isLoggingOut}
      />

      {/* Beta Feedback & Bug Reporting Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />
    </div>
  );
};
