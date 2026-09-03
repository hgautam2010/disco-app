"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import type { CampaignResult, ExampleAdvertiser } from "@/lib/types";
import { AdvertiserForm } from "./AdvertiserForm";
import { CampaignConfig } from "./CampaignConfig";
import { CreativeVariants } from "./CreativeVariants";
import { ExampleAdvertisers } from "./ExampleAdvertisers";
import { ExcludedPublishers } from "./ExcludedPublishers";
import { PublisherRankings } from "./PublisherRankings";
import { ScoreBreakdown } from "./ScoreBreakdown";

type CampaignPlannerProps = {
  examples: ExampleAdvertiser[];
  catalogSummary: {
    publisherCount: number;
    personaCount: number;
    categories: string[];
  };
};

export function CampaignPlanner({ examples, catalogSummary }: CampaignPlannerProps) {
  const [description, setDescription] = useState(examples[0]?.description ?? "");
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    const cleanDescription = description.trim();

    if (cleanDescription.length < 4 || loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ description: cleanDescription })
      });
      const payload = (await response.json()) as { campaign?: CampaignResult; error?: string };

      if (!response.ok || !payload.campaign) {
        throw new Error(payload.error ?? "Campaign generation failed.");
      }

      setResult(payload.campaign);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Campaign generation failed.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setDescription("");
    setResult(null);
    setError("");
  }

  return (
    <div className="planner-layout">
      <aside className="sidebar-column">
        <AdvertiserForm
          description={description}
          loading={loading}
          onChange={setDescription}
          onReset={reset}
          onSubmit={generate}
        />
        <div className="catalog-strip">
          <span>{catalogSummary.publisherCount} publishers</span>
          <span>{catalogSummary.personaCount} personas</span>
          <span>{catalogSummary.categories.length} categories</span>
        </div>
        <ExampleAdvertisers examples={examples} disabled={loading} onSelect={setDescription} />
      </aside>

      <section className="output-column" aria-live="polite">
        {loading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && !result ? <EmptyState /> : null}
        {result ? <CampaignResultView result={result} catalogSummary={catalogSummary} /> : null}
      </section>
    </div>
  );
}

function CampaignResultView({
  result,
  catalogSummary
}: {
  result: CampaignResult;
  catalogSummary: CampaignPlannerProps["catalogSummary"];
}) {
  return (
    <>
      <section className="status-band">
        <div>
          <p className="eyebrow">Mode</p>
          <h2>Staged OpenAI pipeline</h2>
          <p className="status-copy">{statusCopy(catalogSummary)}</p>
          {result.pipeline ? <PipelineSummary result={result} /> : null}
        </div>
        <CheckCircle2 aria-hidden="true" size={28} />
      </section>

      {result.warnings.length > 0 ? (
        <section className="warning-band">
          <AlertTriangle aria-hidden="true" size={20} />
          <div>
            {result.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="result-section" aria-labelledby="analysis-heading">
        <div className="section-heading">
          <h2 id="analysis-heading">Advertiser analysis</h2>
        </div>
        <div className="analysis-grid">
          <Metric label="Category" value={result.advertiserAnalysis.category} />
          <Metric label="Price tier" value={result.advertiserAnalysis.priceTier} />
          <Metric label="Objective" value={result.advertiserAnalysis.likelyObjective} />
          <Metric label="Confidence" value={`${Math.round(result.advertiserAnalysis.confidence * 100)}%`} />
        </div>
        <div className="tag-list">
          {[...result.advertiserAnalysis.audienceHints, ...result.advertiserAnalysis.productSignals].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="result-section" aria-labelledby="persona-heading">
        <div className="section-heading">
          <h2 id="persona-heading">Selected personas</h2>
        </div>
        <div className="persona-grid">
          {result.selectedPersonas.map((item) => (
            <article className="persona-card" key={item.persona.id}>
              <div className="mini-topline">
                <h3>{item.persona.name}</h3>
                <span>{item.score}</span>
              </div>
              <p>{item.reasons.join(" ")}</p>
              <div className="tag-list compact-tags">
                {item.messagingAngles.map((angle) => (
                  <span key={angle}>{angle}</span>
                ))}
              </div>
              <ScoreBreakdown signals={item.signals} />
            </article>
          ))}
        </div>
      </section>

      <PublisherRankings publishers={result.recommendedPublishers} />
      <ExcludedPublishers publishers={result.excludedPublishers} />
      <CreativeVariants variants={result.creativeVariants} />
      <CampaignConfig config={result.campaignConfig} />
    </>
  );
}

function statusCopy(catalogSummary: CampaignPlannerProps["catalogSummary"]) {
  return `Extraction, shortlist retrieval, publisher ranking, persona selection, and execution run across ${catalogSummary.publisherCount} publishers and ${catalogSummary.personaCount} personas.`;
}

function PipelineSummary({ result }: { result: CampaignResult }) {
  const pipeline = result.pipeline;

  if (!pipeline) {
    return null;
  }

  return (
    <div className="pipeline-summary" aria-label="Pipeline summary">
      <div className="pipeline-chips">
        <span>{pipeline.apiCallCount} API calls</span>
        <span>{pipeline.attemptCount} attempts</span>
        <span>{pipeline.repairCount} repairs</span>
        <span>{formatNumber(pipeline.totalTokenUsage.totalTokens)} tokens</span>
      </div>
      <details className="pipeline-details">
        <summary>Pipeline trace</summary>
        <div className="pipeline-stage-list">
          {pipeline.stages.map((stage) => {
            const warningCount = stage.warnings.length;

            return (
              <div className="pipeline-stage" key={stage.name}>
                <div>
                  <strong>{formatStageName(stage.name)}</strong>
                  <span>{stage.source === "openai" ? stage.model : "code"}</span>
                </div>
                <div className="pipeline-stage-metrics">
                  <span>{stage.apiCalls} calls</span>
                  <span>{stage.attempts} attempts</span>
                  <span>{formatNumber(stage.tokenUsage.totalTokens)} tokens</span>
                  <span>{formatDuration(stage.durationMs)}</span>
                  <span>{stage.repaired ? "repaired" : "valid"}</span>
                </div>
                {warningCount > 0 ? (
                  <details className="pipeline-stage-warnings">
                    <summary>{formatWarningCount(warningCount)}</summary>
                    <ul>
                      {stage.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function formatStageName(name: string) {
  return name.replaceAll("_", " ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

function formatWarningCount(count: number) {
  return `${count} ${count === 1 ? "warning" : "warnings"}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value.replaceAll("_", " ")}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="empty-state">
      <p className="eyebrow">Ready</p>
      <h2>Enter an advertiser pitch</h2>
      <p>The campaign output will appear here.</p>
    </section>
  );
}

function LoadingState() {
  return (
    <section className="empty-state">
      <Loader2 aria-hidden="true" className="spin" size={28} />
      <h2>Generating campaign</h2>
      <p>Scoring publishers and drafting creative.</p>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="warning-band">
      <AlertTriangle aria-hidden="true" size={20} />
      <p>{message}</p>
    </section>
  );
}
