export class HintService {
  /**
   * Computes the scheduled timestamps (in ms offsets from round start) for progressive hints
   */
  public static calculateHintOffsets(totalDurationSeconds: number, hintCount: number): number[] {
    if (hintCount <= 0 || totalDurationSeconds <= 0) return [];

    const offsets: number[] = [];
    const intervalFraction = 1 / (hintCount + 1);

    for (let i = 1; i <= hintCount; i++) {
      const offsetMs = Math.round(totalDurationSeconds * (i * intervalFraction) * 1000);
      offsets.push(offsetMs);
    }

    return offsets;
  }

  /**
   * Identifies the next unrevealed character index to expose as a hint
   */
  public static revealNextCharacter(word: string, revealedIndices: number[]): number | null {
    const chars = Array.from(word);
    const eligibleIndices: number[] = [];

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      if (char !== ' ' && char !== '-' && char !== "'" && !revealedIndices.includes(i)) {
        eligibleIndices.push(i);
      }
    }

    if (eligibleIndices.length === 0) return null;

    // Pick random eligible index
    const randomIndex = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
    return randomIndex;
  }
}
