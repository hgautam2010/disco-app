import type { ScoreSignal } from "../../types";

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

export function normalizedScore(value: number) {
  return clampScore(value) / 100;
}

export function nonEmptyArray(values: string[] | undefined, defaultValue: string) {
  const cleanValues = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return cleanValues.length > 0 ? Array.from(new Set(cleanValues)) : [defaultValue];
}

export function nonEmptySignals(signals: ScoreSignal[] | undefined, label: string, score: number) {
  return signals && signals.length > 0
    ? signals
    : [
        {
          label,
          detail: "Model-generated fit signal from staged campaign pipeline.",
          weight: clampScore(score)
        }
      ];
}

export function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function fillUniqueFromCandidates<T>({
  target,
  candidates,
  getId,
  min,
  max,
  warnings,
  warning
}: {
  target: T[];
  candidates: T[];
  getId: (item: T) => string;
  min: number;
  max: number;
  warnings: Set<string>;
  warning: string;
}) {
  const seen = new Set(target.map(getId));
  let addedCandidate = false;

  for (const item of candidates) {
    if (target.length >= min || target.length >= max) {
      break;
    }

    const id = getId(item);
    if (!seen.has(id)) {
      target.push(item);
      seen.add(id);
      addedCandidate = true;
    }
  }

  if (addedCandidate || target.length < min) {
    warnings.add(warning);
  }
}
