export class ScoringService {
  public static readonly BASE_CORRECT_SCORE = 100;
  public static readonly MAX_SPEED_BONUS = 100;
  public static readonly DRAWER_BONUS = 50;

  /**
   * Calculates points awarded to a player for a correct guess based on time remaining
   */
  public static calculateGuesserScore(timeRemainingSeconds: number, totalDurationSeconds: number): number {
    const clampedRemaining = Math.max(0, Math.min(timeRemainingSeconds, totalDurationSeconds));
    const safeTotal = Math.max(1, totalDurationSeconds);

    const speedFraction = clampedRemaining / safeTotal;
    const speedBonus = Math.round(speedFraction * this.MAX_SPEED_BONUS);

    return this.BASE_CORRECT_SCORE + speedBonus;
  }

  /**
   * Calculates points awarded to the drawer when players guess correctly
   */
  public static calculateDrawerBonus(): number {
    return this.DRAWER_BONUS;
  }
}
