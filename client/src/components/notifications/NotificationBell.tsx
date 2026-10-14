import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Loader2, Trophy, UserPlus, Gamepad2, ShieldAlert } from 'lucide-react';
import { NotificationItem } from '../../types/index.js';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/notificationService.js';
import { getSocket } from '../../services/socket.js';
import { useToast } from '../../context/ToastContext.js';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const isMountedRef = useRef(true);

  const fetchList = async () => {
    try {
      setIsLoading(true);
      const data = await getNotifications(1, 15);
      if (isMountedRef.current) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Gracefully ignore fetch failure on bell mount
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchList();

    const socket = getSocket();
    const handleNewNotification = (item: NotificationItem) => {
      if (isMountedRef.current) {
        setNotifications((prev) => [item, ...prev]);
        setUnreadCount((prev) => prev + 1);
        toast.info(`${item.title}: ${item.message}`);
      }
    };

    if (socket) {
      socket.on('notification:new', handleNewNotification);
    }

    return () => {
      isMountedRef.current = false;
      if (socket) {
        socket.off('notification:new', handleNewNotification);
      }
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkOne = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id || n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignored
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Failed to update notifications.');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'achievement_unlocked':
        return <Trophy className="w-4 h-4 text-amber-500" />;
      case 'friend_request':
      case 'friend_accepted':
        return <UserPlus className="w-4 h-4 text-emerald-500" />;
      case 'game_invite':
        return <Gamepad2 className="w-4 h-4 text-indigo-500" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-violet-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchList();
        }}
        aria-label="View notifications"
        className="relative p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D121F] shadow-2xl py-3 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading && notifications.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mb-1 text-indigo-500" />
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <p>No notifications yet.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Game invites & rewards appear here.</p>
              </div>
            ) : (
              notifications.map((item) => {
                const id = item._id || item.id || '';
                return (
                  <div
                    key={id}
                    onClick={() => !item.isRead && handleMarkOne(id)}
                    className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                      item.isRead
                        ? 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 opacity-75'
                        : 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {item.title}
                        </p>
                        {!item.isRead && (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed mt-0.5">
                        {item.message}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
