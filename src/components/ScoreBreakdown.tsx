import type { ScoreSignal } from "@/lib/types";

type ScoreBreakdownProps = {
  signals: ScoreSignal[];
};

export function ScoreBreakdown({ signals }: ScoreBreakdownProps) {
  if (signals.length === 0) {
    return null;
  }

  return (
    <details className="score-details">
      <summary>Score breakdown</summary>
      <ul>
        {signals.map((signal, index) => (
          <li key={`${signal.label}-${index}`}>
            <span>{signal.label}</span>
            <strong>{signal.weight > 0 ? `+${signal.weight}` : signal.weight}</strong>
            <p>{signal.detail}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
