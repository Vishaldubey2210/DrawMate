import { logger } from '../utils/logger.js';

export interface BetaFeatureFlags {
  imposterModeEnabled: boolean;
  genAiWordPacksEnabled: boolean;
  aiPracticeEnabled: boolean;
  drawingReplayEnabled: boolean;
  customWordPacksEnabled: boolean;
  betaFeedbackEnabled: boolean;
  betaAccessOnly: boolean;
  telemetryEnabled: boolean;
}

const defaultFlags: BetaFeatureFlags = {
  imposterModeEnabled: process.env.FLAG_IMPOSTER_MODE !== 'false',
  genAiWordPacksEnabled: process.env.FLAG_GENAI_WORDPACKS !== 'false',
  aiPracticeEnabled: process.env.FLAG_AI_PRACTICE !== 'false',
  drawingReplayEnabled: process.env.FLAG_DRAWING_REPLAY !== 'false',
  customWordPacksEnabled: process.env.FLAG_CUSTOM_WORDPACKS !== 'false',
  betaFeedbackEnabled: process.env.FLAG_BETA_FEEDBACK !== 'false',
  betaAccessOnly: process.env.FLAG_BETA_ACCESS_ONLY === 'true',
  telemetryEnabled: process.env.FLAG_TELEMETRY !== 'false',
};

class FeatureFlagService {
  private flags: BetaFeatureFlags = { ...defaultFlags };

  public getFlags(): Readonly<BetaFeatureFlags> {
    return { ...this.flags };
  }

  public isEnabled(flagName: keyof BetaFeatureFlags): boolean {
    return Boolean(this.flags[flagName]);
  }

  public updateFlags(partial: Partial<BetaFeatureFlags>, updatedBy = 'system'): BetaFeatureFlags {
    this.flags = {
      ...this.flags,
      ...partial,
    };
    logger.info(
      `Feature flags updated by ${updatedBy}: ${JSON.stringify(partial)}`,
      undefined,
      'FeatureFlags'
    );
    return this.getFlags();
  }

  public resetToDefaults(): void {
    this.flags = { ...defaultFlags };
  }
}

export const featureFlagService = new FeatureFlagService();
