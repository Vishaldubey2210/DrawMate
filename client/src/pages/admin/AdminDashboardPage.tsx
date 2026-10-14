import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Badge } from '../../components/ui/Badge.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { Skeleton, SkeletonCard, SkeletonTableRow } from '../../components/ui/Skeleton.js';
import {
  getReports,
  updateReportStatus,
  performModerationAction,
  getAuditLogs,
  getAdminUsers,
} from '../../services/moderationService.js';
import {
  getOperationalMetrics,
  getIncidentDiagnostics,
  getAdminFeedbacks,
  updateFeedbackStatus,
  getPublicFeatureFlags,
  updateFeatureFlags,
  FeedbackItem,
  BetaFeatureFlags,
} from '../../services/observabilityService.js';
import { ReportItem, AuditLogItem, User } from '../../types/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  ShieldAlert,
  Users,
  FileText,
  Search,
  Check,
  X,
  AlertTriangle,
  Ban,
  Clock,
  RotateCcw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity,
  MessageSquare,
  Sliders,
  RefreshCw,
  Server,
  Zap,
  CheckCircle2,
  Layers,
  Cpu,
  Database,
  Radio,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'audit' | 'metrics' | 'feedback' | 'features'>('reports');

  // Reports state
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsStatusFilter, setReportsStatusFilter] = useState<string>('open');
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReportToResolve, setSelectedReportToResolve] = useState<ReportItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Users state
  const [userQuery, setUserQuery] = useState('');
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Moderation Action Dialog
  const [actionModalUser, setActionModalUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'ban' | 'unban'>('suspend');
  const [suspendHours, setSuspendHours] = useState(24);
  const [actionReason, setActionReason] = useState('');
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Metrics state
  const [metrics, setMetrics] = useState<any>(null);
  const [incidents, setIncidents] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Feedback state
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>('all');
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [feedbacksTotal, setFeedbacksTotal] = useState(0);

  // Feature Flags state
  const [featureFlags, setFeatureFlags] = useState<BetaFeatureFlags | null>(null);
  const [flagsLoading, setFlagsLoading] = useState(false);

  const fetchReports = async () => {
    try {
      setReportsLoading(true);
      const data = await getReports(reportsStatusFilter || undefined);
      setReports(data.reports);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch reports.');
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const data = await getAdminUsers(userQuery);
      setAdminUsers(data.users);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch users.');
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const data = await getAuditLogs();
      setAuditLogs(data.logs);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch audit logs.');
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      setMetricsLoading(true);
      const [m, inc] = await Promise.all([
        getOperationalMetrics(),
        getIncidentDiagnostics(),
      ]);
      setMetrics(m);
      setIncidents(inc);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch operational metrics.');
    } finally {
      setMetricsLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      setFeedbacksLoading(true);
      const data = await getAdminFeedbacks(feedbackStatusFilter !== 'all' ? feedbackStatusFilter : undefined);
      setFeedbacks(data.feedbacks);
      setFeedbacksTotal(data.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch player feedback.');
    } finally {
      setFeedbacksLoading(false);
    }
  };

  const fetchFeatureFlags = async () => {
    try {
      setFlagsLoading(true);
      const flags = await getPublicFeatureFlags();
      setFeatureFlags(flags);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch feature flags.');
    } finally {
      setFlagsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'metrics') fetchMetrics();
    if (activeTab === 'feedback') fetchFeedbacks();
    if (activeTab === 'features') fetchFeatureFlags();
  }, [activeTab, reportsStatusFilter, feedbackStatusFilter]);

  const handleResolveReport = async (status: 'resolved' | 'dismissed') => {
    if (!selectedReportToResolve) return;
    try {
      const res = await updateReportStatus(
        selectedReportToResolve._id,
        status,
        resolutionNotes
      );
      if (res.success) {
        toast.success(res.message);
        setSelectedReportToResolve(null);
        setResolutionNotes('');
        fetchReports();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update report.');
    }
  };

  const handleUpdateFeedbackStatus = async (id: string, status: 'reviewed' | 'resolved') => {
    try {
      const res = await updateFeedbackStatus(id, status);
      if (res.success) {
        toast.success(`Feedback updated to ${status}.`);
        fetchFeedbacks();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update feedback status.');
    }
  };

  const handleToggleFlag = async (key: keyof BetaFeatureFlags, currentValue: boolean) => {
    try {
      const updated = await updateFeatureFlags({ [key]: !currentValue });
      setFeatureFlags(updated);
      toast.success(`Flag ${key} updated to ${!currentValue}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update feature flag.');
    }
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModalUser) return;

    try {
      setIsPerformingAction(true);
      const res = await performModerationAction({
        action: actionType,
        targetUserId: actionModalUser._id,
        durationHours: actionType === 'suspend' ? suspendHours : undefined,
        reason: actionReason || `Admin action: ${actionType}`,
      });

      if (res.success) {
        toast.success(res.message);
        setActionModalUser(null);
        setActionReason('');
        fetchUsers();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error executing moderation action.');
    } finally {
      setIsPerformingAction(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Admin & Observability Portal"
        subtitle="Server-enforced community protection, operational monitoring, and beta rollouts."
        badge={
          <Badge variant="danger" size="sm">
            <Shield className="w-3 h-3 mr-1" />
            {user?.role?.toUpperCase() || 'MODERATOR'}
          </Badge>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Reports Queue</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Lookup</span>
        </button>

        <button
          onClick={() => setActiveTab('feedback')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'feedback'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Beta Feedback</span>
        </button>

        {user?.role === 'admin' && (
          <>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'metrics'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Operational Health</span>
            </button>

            <button
              onClick={() => setActiveTab('features')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'features'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Beta Feature Flags</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Audit Trail</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: REPORTS QUEUE */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {['open', 'under_review', 'resolved', 'dismissed'].map((st) => (
              <button
                key={st}
                onClick={() => setReportsStatusFilter(st)}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold capitalize transition-colors cursor-pointer ${
                  reportsStatusFilter === st
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {reportsLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 text-center">
              <EmptyState
                icon={Check}
                title="Zero Pending Reports"
                description={`No reports found matching status "${reportsStatusFilter}".`}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report._id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-500">
                        {report.category}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Target: {report.targetType} ({report.targetId})
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      "{report.explanation}"
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Reported {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {report.status === 'open' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedReportToResolve(report)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                      >
                        Resolve Report
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER LOOKUP */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                placeholder="Search players by username, display name or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D121F] text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={fetchUsers}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
            >
              Search
            </button>
          </div>

          {usersLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : adminUsers.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 text-center">
              <EmptyState
                icon={Users}
                title="No Users Found"
                description="Search for accounts by username or email to inspect status and apply moderation."
              />
            </div>
          ) : (
            <div className="space-y-3">
              {adminUsers.map((u) => (
                <div
                  key={u._id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Avatar avatarId={u.avatar} size="md" />
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        {u.displayName}
                        <span className="text-xs text-slate-400 font-normal">@{u.username}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            u.role === 'admin'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {u.role?.toUpperCase() || 'USER'}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Status: <span className="font-semibold text-slate-700 dark:text-slate-300">{u.status}</span>
                        {u.status === 'suspended' && u.suspendedUntil && (
                          <span className="text-rose-500 ml-1">
                            (Until {new Date(u.suspendedUntil).toLocaleDateString()})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActionModalUser(u)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                  >
                    Moderate
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OPERATIONAL HEALTH & OBSERVABILITY */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">System Telemetry & Health</h3>
              <p className="text-xs text-slate-500">Live indicators of multiplayer latency, uptime, and AI providers</p>
            </div>
            <button
              onClick={fetchMetrics}
              disabled={metricsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {metricsLoading && !metrics ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : metrics ? (
            <div className="space-y-6">
              {/* Top KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-500" /> Active Sockets
                  </span>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    {metrics.multiplayer.activeSockets}
                  </p>
                  <p className="text-[10px] text-slate-500">Total handshakes: {metrics.multiplayer.totalConnections}</p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Match Completion
                  </span>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {metrics.multiplayer.matchCompletionRatePercent}%
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {metrics.multiplayer.matchesCompleted} done / {metrics.multiplayer.matchesCancelled} cancelled
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-amber-500" /> AI Success Rate
                  </span>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    {metrics.aiServices.genAiSuccessRatePercent}%
                  </p>
                  <p className="text-[10px] text-slate-500">Fallbacks used: {metrics.aiServices.genAiFallbacks}</p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-cyan-500" /> Database Health
                  </span>
                  <p className="text-2xl font-black text-slate-900 dark:text-white capitalize">
                    {metrics.system.dbConnectionState}
                  </p>
                  <p className="text-[10px] text-slate-500">Uptime: {Math.floor(metrics.uptimeSeconds / 60)} mins</p>
                </div>
              </div>

              {/* Reliability & Latency Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    HTTP Request Latency Profile
                  </h4>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span className="text-[10px] text-slate-400 block">Avg</span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {metrics.application.apiLatency.avgMs}ms
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span className="text-[10px] text-slate-400 block">p50</span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {metrics.application.apiLatency.p50Ms}ms
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span className="text-[10px] text-slate-400 block">p95</span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {metrics.application.apiLatency.p95Ms}ms
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <span className="text-[10px] text-slate-400 block">Max</span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {metrics.application.apiLatency.maxMs}ms
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 pt-1">
                    <span>Total HTTP Requests: {metrics.application.totalRequests}</span>
                    <span>5xx Errors: {metrics.application.requestsByStatus['5xx']}</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Multiplayer Reliability
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Reconnection Recovery Rate</span>
                      <span className="font-bold text-emerald-500">{metrics.multiplayer.reconnectionSuccessRatePercent}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Rooms Created vs Joined</span>
                      <span className="font-bold">{metrics.multiplayer.roomsCreated} / {metrics.multiplayer.roomsJoined}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Unexpected Disconnects</span>
                      <span className="font-bold text-amber-500">{metrics.multiplayer.unexpectedDisconnections}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Node Memory RSS</span>
                      <span className="font-bold">{metrics.system.memoryUsageMb.rss} MB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Incident Diagnostics Log */}
              {incidents && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Recent Critical Incidents ({incidents.incidents?.length || 0})
                    </h4>
                    <span className="text-[10px] text-slate-400">Ring buffer of last 50 exceptions</span>
                  </div>
                  {incidents.incidents?.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">Zero runtime incidents recorded.</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {incidents.incidents.map((inc: any) => (
                        <div
                          key={inc.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              {inc.category}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{inc.message}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{new Date(inc.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 4: BETA FEEDBACK QUEUE */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {['all', 'new', 'reviewed', 'resolved'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFeedbackStatusFilter(st)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold capitalize transition-colors cursor-pointer ${
                    feedbackStatusFilter === st
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <button
              onClick={fetchFeedbacks}
              className="text-xs px-3 py-1.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer"
            >
              Refresh ({feedbacksTotal})
            </button>
          </div>

          {feedbacksLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 text-center">
              <EmptyState
                icon={MessageSquare}
                title="Zero Feedback Submissions"
                description={`No player feedback found for filter "${feedbackStatusFilter}".`}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map((fb) => (
                <div
                  key={fb._id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {fb.category.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        By: {fb.username || 'Anonymous'}
                      </span>
                      {fb.roomCode && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          Room: {fb.roomCode}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      "{fb.description}"
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Submitted {new Date(fb.createdAt).toLocaleString()} • Status: <span className="font-bold uppercase">{fb.status}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {fb.status === 'new' && (
                      <button
                        onClick={() => handleUpdateFeedbackStatus(fb._id, 'reviewed')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors cursor-pointer"
                      >
                        Mark Reviewed
                      </button>
                    )}
                    {fb.status !== 'resolved' && (
                      <button
                        onClick={() => handleUpdateFeedbackStatus(fb._id, 'resolved')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: BETA FEATURE FLAGS */}
      {activeTab === 'features' && user?.role === 'admin' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Controlled Rollout Feature Flags</h3>
              <p className="text-xs text-slate-500">Server-enforced runtime switches to safely stage beta features</p>
            </div>
            <button
              onClick={fetchFeatureFlags}
              className="text-xs px-3 py-1.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer"
            >
              Refresh Flags
            </button>
          </div>

          {flagsLoading || !featureFlags ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(featureFlags) as Array<keyof BetaFeatureFlags>).map((flagKey) => {
                const isEnabled = featureFlags[flagKey];
                return (
                  <div
                    key={flagKey}
                    className="p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shadow-sm"
                  >
                    <div>
                      <h4 className="font-bold text-xs font-mono text-slate-900 dark:text-white">
                        {flagKey}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isEnabled ? 'Enabled for active players' : 'Disabled / Rolled back on server'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleFlag(flagKey, isEnabled)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isEnabled
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/30'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                      }`}
                    >
                      {isEnabled ? 'ACTIVE' : 'DISABLED'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeTab === 'audit' && user?.role === 'admin' && (
        <div className="space-y-4">
          {auditLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 text-center">
              <EmptyState
                icon={FileText}
                title="Zero Audit Events"
                description="Administrative actions and security interventions will be permanently logged here."
              />
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log._id}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {log.action.toUpperCase()}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600 dark:text-slate-300">{log.targetType}: {log.targetId}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resolve Report Modal */}
      {selectedReportToResolve && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Resolve Report</h3>
            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Resolution rationale..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedReportToResolve(null)}
                className="px-3 py-1.5 text-xs text-slate-500 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolveReport('dismissed')}
                className="px-3 py-1.5 text-xs font-bold bg-slate-200 dark:bg-slate-700 rounded-xl cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={() => handleResolveReport('resolved')}
                className="px-3.5 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-xl cursor-pointer"
              >
                Confirm Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderation Action Modal */}
      {actionModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Moderate User: {actionModalUser.displayName}
            </h3>
            <form onSubmit={handleExecuteAction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">Action Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                >
                  <option value="suspend">Temporary Suspension</option>
                  <option value="ban">Permanent Account Ban</option>
                  <option value="unban">Reinstate / Unban Account</option>
                </select>
              </div>

              {actionType === 'suspend' && (
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">Duration</label>
                  <select
                    value={suspendHours}
                    onChange={(e) => setSuspendHours(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  >
                    <option value={1}>1 Hour</option>
                    <option value={6}>6 Hours</option>
                    <option value={24}>24 Hours</option>
                    <option value={72}>72 Hours</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">Reason</label>
                <input
                  type="text"
                  required
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Rationale for audit log..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModalUser(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPerformingAction || !actionReason.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  {isPerformingAction ? 'Applying...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
