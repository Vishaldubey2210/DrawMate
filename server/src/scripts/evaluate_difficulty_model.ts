import mongoose from 'mongoose';
import { RoundTelemetry } from '../models/RoundTelemetry.js';
import { ENV } from '../config/env.js';

interface ModelEvaluationReport {
  datasetSize: number;
  eligibleRounds: number;
  excludedRounds: {
    cancelled: number;
    afkSkip: number;
  };
  metrics: {
    baselineAccuracy: number;
    baselineBrierScore: number;
    meanSolveRate: number;
  };
  readinessCriteria: {
    minimumSampleThresholdMet: boolean;
    requiredSampleCount: number;
    currentSampleCount: number;
    status: 'READY_FOR_ML_TRAINING' | 'INSUFFICIENT_DATA_USE_BAYESIAN_BASELINE';
  };
  recommendations: string[];
}

export async function runDifficultyModelEvaluation(): Promise<ModelEvaluationReport> {
  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected && ENV.MONGODB_URI) {
    await mongoose.connect(ENV.MONGODB_URI);
  }

  // 1. Fetch telemetry
  const allRecords = await RoundTelemetry.find({}).lean();
  const datasetSize = allRecords.length;

  const cancelledCount = allRecords.filter((r) => r.isCancelled).length;
  const afkSkipCount = allRecords.filter((r) => r.isAfkSkip).length;

  // Inclusion criteria: non-cancelled, non-afk-skip
  const eligibleRounds = allRecords.filter((r) => !r.isCancelled && !r.isAfkSkip);

  if (eligibleRounds.length === 0) {
    return {
      datasetSize,
      eligibleRounds: 0,
      excludedRounds: { cancelled: cancelledCount, afkSkip: afkSkipCount },
      metrics: {
        baselineAccuracy: 0,
        baselineBrierScore: 0,
        meanSolveRate: 0.5,
      },
      readinessCriteria: {
        minimumSampleThresholdMet: false,
        requiredSampleCount: 500,
        currentSampleCount: 0,
        status: 'INSUFFICIENT_DATA_USE_BAYESIAN_BASELINE',
      },
      recommendations: [
        'Collect at least 500 completed gameplay rounds before training custom ML models.',
        'Active runtime remains on Stage 1 Bayesian Beta-Binomial smoothing ((solves + 2)/(rounds + 4)).',
      ],
    };
  }

  // 2. Compute baseline statistics
  const solveCount = eligibleRounds.filter((r) => r.solved).length;
  const meanSolveRate = solveCount / eligibleRounds.length;
  const majorityClass = meanSolveRate >= 0.5;
  const baselineAccuracy = majorityClass ? meanSolveRate : 1 - meanSolveRate;

  // Brier score: MSE of probability predictions against binary outcome
  const brierScore =
    eligibleRounds.reduce((acc, r) => {
      const actual = r.solved ? 1 : 0;
      return acc + Math.pow(meanSolveRate - actual, 2);
    }, 0) / eligibleRounds.length;

  const minThreshold = 500;
  const thresholdMet = eligibleRounds.length >= minThreshold;

  return {
    datasetSize,
    eligibleRounds: eligibleRounds.length,
    excludedRounds: {
      cancelled: cancelledCount,
      afkSkip: afkSkipCount,
    },
    metrics: {
      baselineAccuracy: parseFloat(baselineAccuracy.toFixed(4)),
      baselineBrierScore: parseFloat(brierScore.toFixed(4)),
      meanSolveRate: parseFloat(meanSolveRate.toFixed(4)),
    },
    readinessCriteria: {
      minimumSampleThresholdMet: thresholdMet,
      requiredSampleCount: minThreshold,
      currentSampleCount: eligibleRounds.length,
      status: thresholdMet
        ? 'READY_FOR_ML_TRAINING'
        : 'INSUFFICIENT_DATA_USE_BAYESIAN_BASELINE',
    },
    recommendations: thresholdMet
      ? [
          'Sample size threshold satisfied.',
          'Evaluate Logistic Regression with time-split cross validation.',
        ]
      : [
          `Telemetry collection active: ${eligibleRounds.length}/${minThreshold} target samples collected.`,
          'Stage 1 Bayesian Beta-Binomial smoothing is active and serves authoritative weights.',
          'Do not activate Stage 2 ML until threshold is surpassed with multi-client gameplay data.',
        ],
  };
}

// Standalone execution entrypoint
if (process.argv[1]?.endsWith('evaluate_difficulty_model.ts')) {
  runDifficultyModelEvaluation()
    .then((report) => {
      console.log('=== DIFFICULTY MODEL EVALUATION REPORT ===');
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Model evaluation script error:', err);
      process.exit(1);
    });
}
