import { SlidersHorizontal, Target } from "lucide-react";
import type { CampaignConfig as CampaignConfigType } from "@/lib/types";

type CampaignConfigProps = {
  config: CampaignConfigType;
};

export function CampaignConfig({ config }: CampaignConfigProps) {
  return (
    <section className="result-section" aria-labelledby="config-heading">
      <div className="section-heading">
        <SlidersHorizontal aria-hidden="true" size={20} />
        <h2 id="config-heading">Campaign config</h2>
      </div>

      <div className="config-grid">
        <article className="config-panel">
          <div className="section-heading compact-heading">
            <Target aria-hidden="true" size={18} />
            <h3>Launch shape</h3>
          </div>
          <dl className="config-list">
            <div>
              <dt>Objective</dt>
              <dd>{config.objective}</dd>
            </div>
            <div>
              <dt>Budget</dt>
              <dd>
                ${config.budget.totalUsd.toLocaleString()} total | ${config.budget.dailyUsd.toLocaleString()} daily
              </dd>
            </div>
            <div>
              <dt>Bid strategy</dt>
              <dd>{config.bidStrategy.type}</dd>
            </div>
          </dl>
          <p className="rationale-copy">{config.bidStrategy.rationale}</p>
        </article>

        <article className="config-panel">
          <h3>Budget allocation</h3>
          <div className="allocation-list">
            {config.budget.allocation.map((allocation) => (
              <div key={allocation.publisherId}>
                <span>{allocation.publisherName}</span>
                <strong>{allocation.budgetPercent}%</strong>
                <small>${allocation.bidCpmUsd.toFixed(2)} CPM</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <pre className="json-panel">{JSON.stringify(config, null, 2)}</pre>
    </section>
  );
}
