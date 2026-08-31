import { TrendingUp } from "lucide-react";
import type { ScoredPublisher } from "@/lib/types";
import { ScoreBreakdown } from "./ScoreBreakdown";

type PublisherRankingsProps = {
  publishers: ScoredPublisher[];
};

export function PublisherRankings({ publishers }: PublisherRankingsProps) {
  return (
    <section className="result-section" aria-labelledby="publisher-heading">
      <div className="section-heading">
        <TrendingUp aria-hidden="true" size={20} />
        <h2 id="publisher-heading">Recommended publishers</h2>
      </div>

      <div className="publisher-list">
        {publishers.map((item, index) => (
          <article className="publisher-card" key={item.publisher.id}>
            <div className="card-topline">
              <div>
                <p className="rank-label">#{index + 1}</p>
                <h3>{item.publisher.name}</h3>
              </div>
              <strong>{item.score}</strong>
            </div>
            <div className="score-bar" aria-label={`${item.publisher.name} score ${item.score} out of 100`}>
              <span style={{ width: `${item.score}%` }} />
            </div>
            <p className="meta-line">
              {item.publisher.category} | AOV ${item.publisher.avg_order_value_usd} |{" "}
              {formatImpressions(item.publisher.monthly_impressions)} monthly impressions
            </p>
            <ul className="reason-list">
              {item.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {item.risks.length > 0 ? <p className="risk-copy">Risk: {item.risks.join(" ")}</p> : null}
            <ScoreBreakdown signals={item.signals} />
          </article>
        ))}
      </div>
    </section>
  );
}

function formatImpressions(value: number) {
  if (value >= 1000000) {
    return `${Number((value / 1000000).toFixed(1))}M`;
  }

  return value.toLocaleString();
}
