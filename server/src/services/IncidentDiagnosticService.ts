export interface IncidentReport {
  id: string;
  fingerprint: string;
  timestamp: string;
  category: 'database' | 'realtime' | 'auth' | 'ai_service' | 'internal';
  message: string;
  details?: any;
}

class IncidentDiagnosticService {
  private recentIncidents: IncidentReport[] = [];
  private readonly maxCapacity = 100;

  public recordIncident(
    category: 'database' | 'realtime' | 'auth' | 'ai_service' | 'internal',
    message: string,
    details?: any
  ): void {
    const fingerprint = `${category}:${message.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_')}`;
    const id = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Redact details
    let safeDetails: any = undefined;
    if (details && typeof details === 'object') {
      safeDetails = { ...details };
      delete safeDetails.password;
      delete safeDetails.token;
      delete safeDetails.cookie;
      delete safeDetails.secret;
    }

    const incident: IncidentReport = {
      id,
      fingerprint,
      timestamp: new Date().toISOString(),
      category,
      message,
      details: safeDetails,
    };

    this.recentIncidents.unshift(incident);
    if (this.recentIncidents.length > this.maxCapacity) {
      this.recentIncidents.pop();
    }
  }

  public getRecentIncidents(limit = 30): IncidentReport[] {
    return this.recentIncidents.slice(0, limit);
  }

  public getIncidentSummary(): {
    totalRecorded: number;
    byCategory: Record<string, number>;
  } {
    const byCategory: Record<string, number> = {
      database: 0,
      realtime: 0,
      auth: 0,
      ai_service: 0,
      internal: 0,
    };

    for (const inc of this.recentIncidents) {
      byCategory[inc.category] = (byCategory[inc.category] || 0) + 1;
    }

    return {
      totalRecorded: this.recentIncidents.length,
      byCategory,
    };
  }

  public clear(): void {
    this.recentIncidents = [];
  }
}

export const incidentDiagnosticService = new IncidentDiagnosticService();
