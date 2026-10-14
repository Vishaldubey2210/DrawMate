import { Report, IReport, ReportCategory, ReportStatus, ReportTargetType } from '../models/Report.js';
import { AuditLog, IAuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { Room } from '../models/Room.js';
import { getIO } from '../realtime/socket.js';

export interface CreateReportParams {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  category: ReportCategory;
  explanation: string;
}

export class ModerationService {
  /**
   * Submits a player, room, or match report
   */
  public static async createReport(
    params: CreateReportParams
  ): Promise<{ success: boolean; message: string; report?: IReport }> {
    if (params.targetType === 'user' && params.reporterId === params.targetId) {
      return { success: false, message: 'You cannot submit a report against yourself.' };
    }

    if (!params.explanation || params.explanation.trim().length < 5) {
      return { success: false, message: 'Please provide a detailed explanation of at least 5 characters.' };
    }

    if (params.explanation.length > 500) {
      return { success: false, message: 'Explanation cannot exceed 500 characters.' };
    }

    // Check for recent duplicate report
    const existing = await Report.findOne({
      reporterId: params.reporterId,
      targetType: params.targetType,
      targetId: params.targetId,
      status: { $in: ['open', 'under_review'] },
    });

    if (existing) {
      return { success: false, message: 'An active report for this incident has already been submitted.' };
    }

    const report = await Report.create({
      reporterId: params.reporterId,
      targetType: params.targetType,
      targetId: params.targetId,
      category: params.category,
      explanation: params.explanation.trim(),
      status: 'open',
    });

    return { success: true, message: 'Report submitted successfully. Our team will review it.', report };
  }

  /**
   * Retrieves reports for administrative review
   */
  public static async getReports(
    status?: ReportStatus,
    page: number = 1,
    limit: number = 20
  ): Promise<{ reports: IReport[]; total: number; page: number; totalPages: number }> {
    const query: any = {};
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      Report.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Report.countDocuments(query),
    ]);

    return {
      reports,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Updates report status with moderator resolution and creates an audit record
   */
  public static async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    moderatorId: string,
    moderatorNotes?: string
  ): Promise<{ success: boolean; message: string; report?: IReport }> {
    const report = await Report.findById(reportId);
    if (!report) {
      return { success: false, message: 'Report not found.' };
    }

    report.status = status;
    report.resolvedBy = moderatorId;
    report.resolvedAt = new Date();
    if (moderatorNotes !== undefined) {
      report.moderatorNotes = moderatorNotes;
    }
    await report.save();

    await AuditLog.create({
      actorId: moderatorId,
      action: 'report_status_update',
      targetType: 'report',
      targetId: reportId,
      reason: moderatorNotes || `Updated status to ${status}`,
      metadata: { newStatus: status },
    });

    return { success: true, message: `Report marked as ${status}.`, report };
  }

  /**
   * Moderation action: forcefully kick a player from an active room
   */
  public static async kickPlayerFromRoom(
    moderatorOrHostId: string,
    roomCode: string,
    targetUserId: string,
    reason: string = 'Violation of community guidelines'
  ): Promise<{ success: boolean; message: string }> {
    const io = getIO();
    if (io) {
      io.to(`user:${targetUserId}`).emit('room:moderation_kick', {
        roomCode,
        reason,
      });

      // Also notify the entire room
      io.to(roomCode).emit('room:player_kicked', {
        userId: targetUserId,
        reason,
      });
    }

    await AuditLog.create({
      actorId: moderatorOrHostId,
      action: 'room_kick',
      targetType: 'room',
      targetId: roomCode,
      reason,
      metadata: { kickedUserId: targetUserId },
    });

    return { success: true, message: 'Player has been ejected from the room.' };
  }

  /**
   * Suspends an account temporarily
   */
  public static async suspendUser(
    moderatorId: string,
    targetUserId: string,
    durationHours: number,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    const user = await User.findById(targetUserId);
    if (!user) {
      return { success: false, message: 'Target user not found.' };
    }

    const suspendedUntil = new Date(Date.now() + durationHours * 3600 * 1000);
    user.suspendedUntil = suspendedUntil;
    await user.save();

    await AuditLog.create({
      actorId: moderatorId,
      action: 'user_suspend',
      targetType: 'user',
      targetId: targetUserId,
      reason,
      metadata: { durationHours, suspendedUntil },
    });

    return { success: true, message: `User suspended until ${suspendedUntil.toISOString()}.` };
  }

  /**
   * Bans an account permanently
   */
  public static async banUser(
    moderatorId: string,
    targetUserId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    const user = await User.findById(targetUserId);
    if (!user) {
      return { success: false, message: 'Target user not found.' };
    }

    user.status = 'suspended';
    await user.save();

    await AuditLog.create({
      actorId: moderatorId,
      action: 'user_ban',
      targetType: 'user',
      targetId: targetUserId,
      reason,
    });

    return { success: true, message: 'User permanently banned.' };
  }

  /**
   * Unbans or removes suspension from an account
   */
  public static async unbanUser(
    moderatorId: string,
    targetUserId: string,
    reason: string = 'Ban lifted'
  ): Promise<{ success: boolean; message: string }> {
    const user = await User.findById(targetUserId);
    if (!user) {
      return { success: false, message: 'Target user not found.' };
    }

    user.status = 'active';
    user.suspendedUntil = undefined;
    await user.save();

    await AuditLog.create({
      actorId: moderatorId,
      action: 'user_unban',
      targetType: 'user',
      targetId: targetUserId,
      reason,
    });

    return { success: true, message: 'User reinstated successfully.' };
  }

  /**
   * Retrieves audit logs for administration
   */
  public static async getAuditLogs(
    page: number = 1,
    limit: number = 25
  ): Promise<{ logs: IAuditLog[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
