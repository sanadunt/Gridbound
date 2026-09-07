export const RESULT_INPUT_DELAY_MS = 1000;
export type ResultGateGeneration = number;

/** A result presentation owns one generation of the input lock. */
export class ResultGate {
  private unlockAt = Infinity;
  private generation: ResultGateGeneration = 0;

  open(now: number): ResultGateGeneration {
    const generation = ++this.generation;
    const unlockAt = Number.isFinite(now) ? now + RESULT_INPUT_DELAY_MS : Infinity;
    this.unlockAt = Number.isFinite(unlockAt) && unlockAt > now ? unlockAt : Infinity;
    return generation;
  }

  close() {
    ++this.generation;
    this.unlockAt = Infinity;
  }

  allows(now: number, generation?: ResultGateGeneration) {
    return Number.isFinite(now)
      && Number.isFinite(this.unlockAt)
      && (generation === undefined || generation === this.generation)
      && now >= this.unlockAt;
  }
}
