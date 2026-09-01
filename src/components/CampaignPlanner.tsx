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
  const openAIStatusCopy = statusCopy(result.mode, catalogSummary);

  return (
    <>
      <section className="status-band">
        <div>
          <p className="eyebrow">Mode</p>
          <h2>{modeLabel(result.mode)}</h2>
          {openAIStatusCopy ? <p className="status-copy">{openAIStatusCopy}</p> : null}
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

function modeLabel(mode: CampaignResult["mode"]) {
  if (mode === "openai_staged") {
    return "Staged OpenAI pipeline";
  }

  return "Deterministic fallback";
}

function statusCopy(mode: CampaignResult["mode"], catalogSummary: CampaignPlannerProps["catalogSummary"]) {
  if (mode === "openai_staged") {
    return `Extraction, deterministic retrieval, candidate ranking, and execution are split across ${catalogSummary.publisherCount} publishers and ${catalogSummary.personaCount} personas.`;
  }

  return "";
}

function PipelineSummary({ result }: { result: CampaignResult }) {
  const pipeline = result.pipeline;

  if (!pipeline) {
    return null;
  }

  return (
    <div className="pipeline-summary" aria-label="Pipeline summary">
      <span>{pipeline.apiCallCount} API calls</span>
      <span>{pipeline.repairCount} repairs</span>
      <span>{pipeline.fallbackStages.length} fallbacks</span>
    </div>
  );
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
