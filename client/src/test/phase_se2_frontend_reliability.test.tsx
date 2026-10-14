import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { extractErrorMessage } from '../services/api.js';
import { ProtectedRoute, RoleGuard } from '../routes/AppRoutes.js';
import { DrawingToolbar } from '../features/drawing/DrawingToolbar.js';
import { Modal } from '../components/ui/Modal.js';
import { NotificationBell } from '../components/notifications/NotificationBell.js';
import * as authContext from '../context/AuthContext.js';
import * as toastContext from '../context/ToastContext.js';
import * as socketService from '../services/socket.js';
import * as notificationService from '../services/notificationService.js';

describe('Phase SE-2: Frontend Architecture & API Reliability', () => {
  describe('FE-03 / SE2-03: API Error Normalization & Message Extraction', () => {
    it('extracts top-level error string correctly', () => {
      const err = { response: { data: { error: 'Invalid room passkey' } } };
      expect(extractErrorMessage(err)).toBe('Invalid room passkey');
    });

    it('extracts top-level message string correctly', () => {
      const err = { response: { data: { message: 'Player already registered' } } };
      expect(extractErrorMessage(err)).toBe('Player already registered');
    });

    it('extracts Zod validation error details array of objects', () => {
      const err = {
        response: {
          data: {
            error: 'Validation failed',
            details: [{ path: ['password'], message: 'Password must be at least 8 characters' }],
          },
        },
      };
      expect(extractErrorMessage(err)).toBe('Password must be at least 8 characters');
    });

    it('extracts validation error details array of strings', () => {
      const err = {
        response: {
          data: {
            details: ['Username contains prohibited characters'],
          },
        },
      };
      expect(extractErrorMessage(err)).toBe('Username contains prohibited characters');
    });

    it('extracts nested error object message safely without [object Object]', () => {
      const err = {
        response: {
          data: {
            error: { message: 'Database connection timeout', code: 'ETIMEDOUT' },
          },
        },
      };
      const result = extractErrorMessage(err);
      expect(result).toBe('Database connection timeout');
      expect(result).not.toContain('[object Object]');
    });

    it('falls back to standard Error message when response data is absent', () => {
      const err = new Error('Network timeout after 15000ms');
      expect(extractErrorMessage(err)).toBe('Network timeout after 15000ms');
    });

    it('provides safe generic fallback when error payload is empty', () => {
      const err = {};
      expect(extractErrorMessage(err)).toBe('An unexpected network error occurred');
    });
  });

  describe('FE-02 / SE2-02: Route Guards (ProtectedRoute & RoleGuard)', () => {
    it('renders loading state when auth state is resolving', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        updateUser: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProtectedRoute>
            <div>Dashboard Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByText(/loading drawmate session\.\.\./i)).toBeInTheDocument();
      expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
    });

    it('redirects unauthenticated users to /login', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        updateUser: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Dashboard Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
    });

    it('redirects non-admin users away from admin dashboard', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: { id: 'u1', username: 'bob', email: 'b@example.com', role: 'user', isOnboarded: true } as any,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        updateUser: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <RoleGuard allowedRoles={['admin', 'moderator']}>
                  <div>Admin Secret Controls</div>
                </RoleGuard>
              }
            />
            <Route path="/dashboard" element={<div>User Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('User Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Admin Secret Controls')).not.toBeInTheDocument();
    });

    it('allows admin users access to admin routes', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: { id: 'u2', username: 'admin_alice', email: 'alice@example.com', role: 'admin', isOnboarded: true } as any,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        updateUser: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <RoleGuard allowedRoles={['admin', 'moderator']}>
            <div>Admin Secret Controls</div>
          </RoleGuard>
        </MemoryRouter>
      );

      expect(screen.getByText('Admin Secret Controls')).toBeInTheDocument();
    });
  });

  describe('FE-05 / SE2-05: Redo Stack State Synchronization in DrawingToolbar', () => {
    it('disables Redo button when canRedo is false', () => {
      render(
        <DrawingToolbar
          isDrawer={true}
          activeTool="brush"
          activeColor="#000000"
          activeWidth={0.006}
          strokeCount={2}
          onSelectTool={vi.fn()}
          onSelectColor={vi.fn()}
          onSelectWidth={vi.fn()}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          canRedo={false}
          onClear={vi.fn()}
        />
      );

      const redoBtn = screen.getByRole('button', { name: /redo/i });
      expect(redoBtn).toBeDisabled();
    });

    it('enables Redo button when canRedo is true and triggers onRedo callback', () => {
      const handleRedo = vi.fn();
      render(
        <DrawingToolbar
          isDrawer={true}
          activeTool="brush"
          activeColor="#000000"
          activeWidth={0.006}
          strokeCount={1}
          onSelectTool={vi.fn()}
          onSelectColor={vi.fn()}
          onSelectWidth={vi.fn()}
          onUndo={vi.fn()}
          onRedo={handleRedo}
          canRedo={true}
          onClear={vi.fn()}
        />
      );

      const redoBtn = screen.getByRole('button', { name: /redo/i });
      expect(redoBtn).not.toBeDisabled();
      fireEvent.click(redoBtn);
      expect(handleRedo).toHaveBeenCalledTimes(1);
    });
  });

  describe('FE-07 / SE2-08: Modal Accessibility & Screen-Reader Dialog Attributes', () => {
    it('renders with role="dialog", aria-modal="true", and aria-label matching title', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Create Custom Room">
          <div>Room Settings Form</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-label', 'Create Custom Room');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('renders close button with explicit aria-label="Close dialog"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Settings">
          <div>Settings Content</div>
        </Modal>
      );

      const closeBtn = screen.getByRole('button', { name: /close dialog/i });
      expect(closeBtn).toBeInTheDocument();
      expect(closeBtn).toHaveAttribute('aria-label', 'Close dialog');
    });
  });

  describe('FE-01 / SE2-01: Live NotificationBell Lifecycle & Event Subscriptions', () => {
    beforeEach(() => {
      vi.spyOn(toastContext, 'useToast').mockReturnValue({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('subscribes to notification:new on mount and removes listener on unmount', async () => {
      const mockSocket = {
        on: vi.fn(),
        off: vi.fn(),
      };
      vi.spyOn(socketService, 'getSocket').mockReturnValue(mockSocket as any);
      vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
        notifications: [],
        unreadCount: 0,
        total: 0,
        page: 1,
        totalPages: 0,
      });

      const { unmount } = render(<NotificationBell />);

      expect(mockSocket.on).toHaveBeenCalledWith('notification:new', expect.any(Function));

      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith('notification:new', expect.any(Function));
    });

    it('updates unread count when notification:new event fires', async () => {
      let notificationListener: (item: any) => void = () => {};
      const mockSocket = {
        on: vi.fn((event, cb) => {
          if (event === 'notification:new') notificationListener = cb;
        }),
        off: vi.fn(),
      };
      vi.spyOn(socketService, 'getSocket').mockReturnValue(mockSocket as any);
      vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
        notifications: [],
        unreadCount: 0,
        total: 0,
        page: 1,
        totalPages: 0,
      });

      render(<NotificationBell />);

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });

      // Simulate incoming live notification
      act(() => {
        notificationListener({
          _id: 'n1',
          type: 'achievement_unlocked',
          title: 'Masterpiece Created',
          message: 'You scored 100 on your drawing!',
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });
  });
});
