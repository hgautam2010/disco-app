"use client";

import { AlertTriangle, CheckCircle2, Copy, Loader2, Maximize2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { CampaignResult, CampaignStageRequestConfig, ExampleAdvertiser } from "@/lib/types";
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

type TraceJsonPanelData = {
  stageName: string;
  title: string;
  value: unknown;
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
  return `Extraction, full catalogue loading, publisher ranking, persona selection, and execution run across ${catalogSummary.publisherCount} publishers and ${catalogSummary.personaCount} personas.`;
}

function PipelineSummary({ result }: { result: CampaignResult }) {
  const pipeline = result.pipeline;
  const [selectedJsonPanel, setSelectedJsonPanel] = useState<TraceJsonPanelData | null>(null);

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
            const stageName = formatStageName(stage.name);

            return (
              <div className="pipeline-stage" key={stage.name}>
                <div>
                  <strong>{stageName}</strong>
                  <span>{stage.source === "openai" ? stage.model : "code"}</span>
                </div>
                <div className="pipeline-stage-metrics">
                  <span>{stage.apiCalls} calls</span>
                  <span>{stage.attempts} attempts</span>
                  <span>{formatNumber(stage.tokenUsage.totalTokens)} tokens</span>
                  <span>{formatDuration(stage.durationMs)}</span>
                  <span>{stage.repaired ? "repaired" : "valid"}</span>
                  <TraceRuntimeConfig config={stage.requestConfig} />
                </div>
                <details className="pipeline-stage-io">
                  <summary>Trace data</summary>
                  <div className="pipeline-io-grid">
                    <TraceJsonPanel
                      stageName={stageName}
                      title={stage.source === "openai" ? "Prompt input" : "Stage input"}
                      value={stage.promptInput}
                      onOpen={setSelectedJsonPanel}
                    />
                    {stage.source === "openai" ? (
                      <TraceJsonPanel
                        stageName={stageName}
                        title="Model output"
                        value={stage.modelOutput}
                        onOpen={setSelectedJsonPanel}
                      />
                    ) : null}
                    <TraceJsonPanel
                      stageName={stageName}
                      title="Stage output"
                      value={stage.stageOutput}
                      onOpen={setSelectedJsonPanel}
                    />
                  </div>
                </details>
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
      {selectedJsonPanel ? (
        <TraceJsonModal panel={selectedJsonPanel} onClose={() => setSelectedJsonPanel(null)} />
      ) : null}
    </div>
  );
}

function TraceRuntimeConfig({ config }: { config?: CampaignStageRequestConfig }) {
  if (!config) {
    return null;
  }

  return (
    <>
      {config.reasoningEffort ? <span>effort {config.reasoningEffort}</span> : null}
      {typeof config.maxOutputTokens === "number" ? (
        <span>max {formatNumber(config.maxOutputTokens)} output</span>
      ) : null}
      {config.serviceTier ? <span>{formatServiceTier(config)}</span> : null}
    </>
  );
}

function formatServiceTier(config: CampaignStageRequestConfig) {
  const requestedTier = config.serviceTier ?? "auto";
  const actualTier = config.actualServiceTier;

  if (actualTier && actualTier !== requestedTier) {
    return `tier ${actualTier} (${requestedTier} requested)`;
  }

  return `tier ${actualTier ?? requestedTier}`;
}

function TraceJsonPanel({
  stageName,
  title,
  value,
  onOpen
}: TraceJsonPanelData & {
  onOpen: (panel: TraceJsonPanelData) => void;
}) {
  return (
    <div className="pipeline-io-panel">
      <div className="pipeline-io-panel-heading">
        <h4>{title}</h4>
        <button
          type="button"
          className="json-view-button"
          onClick={() => onOpen({ stageName, title, value })}
          aria-label={`View ${stageName} ${title} JSON`}
          title={`View ${title} JSON`}
        >
          <Maximize2 aria-hidden="true" size={14} />
          <span>View JSON</span>
        </button>
      </div>
      <pre>{formatTraceJson(value)}</pre>
    </div>
  );
}

function TraceJsonModal({ panel, onClose }: { panel: TraceJsonPanelData; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const json = formatTraceJson(panel.value);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="json-modal-backdrop" onClick={onClose}>
      <section
        className="json-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="json-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="json-modal-header">
          <div>
            <p className="eyebrow">{panel.stageName}</p>
            <h2 id="json-modal-title">{panel.title}</h2>
          </div>
          <div className="json-modal-actions">
            <button type="button" className="json-modal-button" onClick={copyJson}>
              <Copy aria-hidden="true" size={16} />
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
            <button type="button" className="json-modal-close" onClick={onClose} aria-label="Close JSON modal">
              <X aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
        <pre className="highlighted-json">{highlightJson(json)}</pre>
      </section>
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

function formatTraceJson(value: unknown) {
  return JSON.stringify(value, null, 2) ?? "null";
}

function highlightJson(json: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern = /("(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(json))) {
    if (match.index > lastIndex) {
      nodes.push(json.slice(lastIndex, match.index));
    }

    const token = match[0];
    const className = json.slice(match.index + token.length).match(/^\s*:/)
      ? "json-token-key"
      : jsonTokenClassName(token);

    nodes.push(
      <span className={className} key={`${match.index}-${nodes.length}`}>
        {token}
      </span>
    );
    lastIndex = match.index + token.length;
  }

  if (lastIndex < json.length) {
    nodes.push(json.slice(lastIndex));
  }

  return nodes;
}

function jsonTokenClassName(token: string) {
  if (token.startsWith('"')) {
    return "json-token-string";
  }

  if (token === "true" || token === "false") {
    return "json-token-boolean";
  }

  if (token === "null") {
    return "json-token-null";
  }

  return "json-token-number";
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
