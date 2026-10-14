import mongoose from 'mongoose';

export interface LatencyStats {
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

export interface OperationalMetricsSnapshot {
  timestamp: string;
  uptimeSeconds: number;
  system: {
    nodeEnv: string;
    nodeVersion: string;
    memoryUsageMb: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    dbConnectionState: string;
  };
  application: {
    totalRequests: number;
    requestsByStatus: {
      '2xx': number;
      '3xx': number;
      '4xx': number;
      '5xx': number;
    };
    apiLatency: LatencyStats;
    authFailures: number;
  };
  multiplayer: {
    activeSockets: number;
    totalConnections: number;
    totalDisconnections: number;
    unexpectedDisconnections: number;
    reconnectAttempts: number;
    reconnectSuccesses: number;
    reconnectionSuccessRatePercent: number;
    roomsCreated: number;
    roomsJoined: number;
    roomCreationFailures: number;
    roomJoinFailures: number;
    matchesStarted: number;
    matchesCompleted: number;
    matchesCancelled: number;
    matchCompletionRatePercent: number;
    matchPersistenceFailures: number;
    unauthorizedEventRejections: number;
    duplicateScoreRejections: number;
  };
  aiServices: {
    genAiRequests: number;
    genAiFailures: number;
    genAiFallbacks: number;
    genAiSuccessRatePercent: number;
    sketchInferenceRequests: number;
    sketchInferenceFailures: number;
    sketchInferenceLatency: LatencyStats;
    moderationChecks: number;
    moderationFailures: number;
  };
}

class OperationalMetricsService {
  private startTime = Date.now();

  // Application
  private totalRequests = 0;
  private status2xx = 0;
  private status3xx = 0;
  private status4xx = 0;
  private status5xx = 0;
  private apiLatencies: number[] = [];
  private authFailures = 0;

  // Multiplayer
  private activeSockets = 0;
  private totalConnections = 0;
  private totalDisconnections = 0;
  private unexpectedDisconnections = 0;
  private reconnectAttempts = 0;
  private reconnectSuccesses = 0;
  private roomsCreated = 0;
  private roomsJoined = 0;
  private roomCreationFailures = 0;
  private roomJoinFailures = 0;
  private matchesStarted = 0;
  private matchesCompleted = 0;
  private matchesCancelled = 0;
  private matchPersistenceFailures = 0;
  private unauthorizedEventRejections = 0;
  private duplicateScoreRejections = 0;

  // AI Services
  private genAiRequests = 0;
  private genAiFailures = 0;
  private genAiFallbacks = 0;
  private sketchInferenceRequests = 0;
  private sketchInferenceFailures = 0;
  private sketchLatencies: number[] = [];
  private moderationChecks = 0;
  private moderationFailures = 0;

  // Record HTTP request
  public recordHttpRequest(status: number, durationMs: number): void {
    this.totalRequests++;
    if (status >= 500) this.status5xx++;
    else if (status >= 400) this.status4xx++;
    else if (status >= 300) this.status3xx++;
    else this.status2xx++;

    this.apiLatencies.push(durationMs);
    if (this.apiLatencies.length > 500) {
      this.apiLatencies.shift();
    }
  }

  public recordAuthFailure(): void {
    this.authFailures++;
  }

  // Record Sockets
  public recordSocketConnect(): void {
    this.activeSockets++;
    this.totalConnections++;
  }

  public recordSocketDisconnect(reason: string): void {
    this.activeSockets = Math.max(0, this.activeSockets - 1);
    this.totalDisconnections++;
    if (reason !== 'client namespace disconnect' && reason !== 'server namespace disconnect') {
      this.unexpectedDisconnections++;
    }
  }

  public recordReconnectAttempt(success: boolean): void {
    this.reconnectAttempts++;
    if (success) this.reconnectSuccesses++;
  }

  // Record Rooms
  public recordRoomCreated(success: boolean): void {
    if (success) this.roomsCreated++;
    else this.roomCreationFailures++;
  }

  public recordRoomJoined(success: boolean): void {
    if (success) this.roomsJoined++;
    else this.roomJoinFailures++;
  }

  // Record Matches
  public recordMatchStarted(): void {
    this.matchesStarted++;
  }

  public recordMatchCompleted(): void {
    this.matchesCompleted++;
  }

  public recordMatchCancelled(): void {
    this.matchesCancelled++;
  }

  public recordMatchPersistenceFailure(): void {
    this.matchPersistenceFailures++;
  }

  public recordUnauthorizedEventRejection(): void {
    this.unauthorizedEventRejections++;
  }

  public recordDuplicateScoreRejection(): void {
    this.duplicateScoreRejections++;
  }

  // Record AI
  public recordGenAiRequest(success: boolean, fallbackUsed = false): void {
    this.genAiRequests++;
    if (!success) this.genAiFailures++;
    if (fallbackUsed) this.genAiFallbacks++;
  }

  public recordSketchInference(durationMs: number, success: boolean): void {
    this.sketchInferenceRequests++;
    if (!success) {
      this.sketchInferenceFailures++;
    }
    this.sketchLatencies.push(durationMs);
    if (this.sketchLatencies.length > 300) {
      this.sketchLatencies.shift();
    }
  }

  public recordModerationCheck(success: boolean): void {
    this.moderationChecks++;
    if (!success) this.moderationFailures++;
  }

  private computeLatencyStats(samples: number[]): LatencyStats {
    if (samples.length === 0) {
      return { count: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0 };
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const avg = Number((sum / sorted.length).toFixed(2));
    const p50 = Number(sorted[Math.floor(sorted.length * 0.5)].toFixed(2));
    const p95 = Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(2));
    const max = Number(sorted[sorted.length - 1].toFixed(2));

    return {
      count: samples.length,
      avgMs: avg,
      p50Ms: p50,
      p95Ms: p95,
      maxMs: max,
    };
  }

  public getSnapshot(): OperationalMetricsSnapshot {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const memory = process.memoryUsage();

    const dbStateMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    const dbState = dbStateMap[mongoose.connection.readyState] || 'unknown';

    const reconnectRate =
      this.reconnectAttempts > 0
        ? Number(((this.reconnectSuccesses / this.reconnectAttempts) * 100).toFixed(1))
        : 100;

    const totalConcludedMatches = this.matchesCompleted + this.matchesCancelled;
    const matchCompletionRate =
      totalConcludedMatches > 0
        ? Number(((this.matchesCompleted / totalConcludedMatches) * 100).toFixed(1))
        : 100;

    const genAiSuccessRate =
      this.genAiRequests > 0
        ? Number((((this.genAiRequests - this.genAiFailures) / this.genAiRequests) * 100).toFixed(1))
        : 100;

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      system: {
        nodeEnv: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        memoryUsageMb: {
          rss: Math.round(memory.rss / 1024 / 1024),
          heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
          external: Math.round(memory.external / 1024 / 1024),
        },
        dbConnectionState: dbState,
      },
      application: {
        totalRequests: this.totalRequests,
        requestsByStatus: {
          '2xx': this.status2xx,
          '3xx': this.status3xx,
          '4xx': this.status4xx,
          '5xx': this.status5xx,
        },
        apiLatency: this.computeLatencyStats(this.apiLatencies),
        authFailures: this.authFailures,
      },
      multiplayer: {
        activeSockets: this.activeSockets,
        totalConnections: this.totalConnections,
        totalDisconnections: this.totalDisconnections,
        unexpectedDisconnections: this.unexpectedDisconnections,
        reconnectAttempts: this.reconnectAttempts,
        reconnectSuccesses: this.reconnectSuccesses,
        reconnectionSuccessRatePercent: reconnectRate,
        roomsCreated: this.roomsCreated,
        roomsJoined: this.roomsJoined,
        roomCreationFailures: this.roomCreationFailures,
        roomJoinFailures: this.roomJoinFailures,
        matchesStarted: this.matchesStarted,
        matchesCompleted: this.matchesCompleted,
        matchesCancelled: this.matchesCancelled,
        matchCompletionRatePercent: matchCompletionRate,
        matchPersistenceFailures: this.matchPersistenceFailures,
        unauthorizedEventRejections: this.unauthorizedEventRejections,
        duplicateScoreRejections: this.duplicateScoreRejections,
      },
      aiServices: {
        genAiRequests: this.genAiRequests,
        genAiFailures: this.genAiFailures,
        genAiFallbacks: this.genAiFallbacks,
        genAiSuccessRatePercent: genAiSuccessRate,
        sketchInferenceRequests: this.sketchInferenceRequests,
        sketchInferenceFailures: this.sketchInferenceFailures,
        sketchInferenceLatency: this.computeLatencyStats(this.sketchLatencies),
        moderationChecks: this.moderationChecks,
        moderationFailures: this.moderationFailures,
      },
    };
  }

  public reset(): void {
    this.totalRequests = 0;
    this.status2xx = 0;
    this.status3xx = 0;
    this.status4xx = 0;
    this.status5xx = 0;
    this.apiLatencies = [];
    this.authFailures = 0;
    this.totalConnections = 0;
    this.totalDisconnections = 0;
    this.unexpectedDisconnections = 0;
    this.reconnectAttempts = 0;
    this.reconnectSuccesses = 0;
    this.roomsCreated = 0;
    this.roomsJoined = 0;
    this.roomCreationFailures = 0;
    this.roomJoinFailures = 0;
    this.matchesStarted = 0;
    this.matchesCompleted = 0;
    this.matchesCancelled = 0;
    this.matchPersistenceFailures = 0;
    this.unauthorizedEventRejections = 0;
    this.duplicateScoreRejections = 0;
    this.genAiRequests = 0;
    this.genAiFailures = 0;
    this.genAiFallbacks = 0;
    this.sketchInferenceRequests = 0;
    this.sketchInferenceFailures = 0;
    this.sketchLatencies = [];
    this.moderationChecks = 0;
    this.moderationFailures = 0;
  }
}

export const operationalMetrics = new OperationalMetricsService();
