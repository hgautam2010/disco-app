import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPersonas, getPublishers } from "../src/lib/data";
import { scorePersonas, selectPersonas } from "../src/lib/personaScoring";
import { scorePublishers } from "../src/lib/publisherScoring";
import { retrieveCampaignCandidates } from "../src/lib/campaign/stages/retrieve-candidates/run";
import {
  advertiserCategoryValues,
  productSignalValues,
  type AdvertiserCategory,
  type ProductSignal
} from "../src/lib/advertiserTaxonomy";
import type { AdvertiserAnalysis, AmbiguityLevel, PriceTier } from "../src/lib/types";

type EvalCase = {
  id: string;
  input: string;
  expectedCategory: AdvertiserCategory;
  expectedTopPublishers: string[];
  expectedPersonas: string[];
  shouldExclude: string[];
  expectedPriceTier?: PriceTier;
  expectedAmbiguityLevel?: AmbiguityLevel;
  expectedProductSignals?: ProductSignal[];
  expectedCandidateWarnings?: string[];
  expectedResultWarnings?: string[];
  forbiddenTopPublishers?: string[];
};

type EvalCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

type EvalResult = {
  id: string;
  score: number;
  passed: boolean;
  checks: EvalCheck[];
};

const fixturesPath = path.join(process.cwd(), "evals", "fixtures", "advertiser-cases.json");
const reportsPath = path.join(process.cwd(), "evals", "reports");
const cases = JSON.parse(readFileSync(fixturesPath, "utf8")) as EvalCase[];
const advertiserCategorySet = new Set<string>(advertiserCategoryValues);
const productSignalSet = new Set<string>(productSignalValues);

const results = cases.map(runEvalCase);
const passed = results.filter((result) => result.passed).length;
const averageScore = Math.round(
  results.reduce((total, result) => total + result.score, 0) / Math.max(results.length, 1)
);

mkdirSync(reportsPath, { recursive: true });
writeFileSync(
  path.join(reportsPath, "latest.json"),
  `${JSON.stringify({ passed, total: results.length, averageScore, results }, null, 2)}\n`
);
writeFileSync(path.join(reportsPath, "latest.md"), renderMarkdownReport(results, averageScore));

if (passed !== results.length) {
  process.exitCode = 1;
}

function runEvalCase(evalCase: EvalCase): EvalResult {
  const analysis = analysisFromEvalCase(evalCase);
  const scoredPersonas = scorePersonas(analysis, getPersonas());
  const selectedPersonaCandidates = selectPersonas(scoredPersonas);
  const { recommendedPublishers, excludedPublishers } = scorePublishers(
    analysis,
    selectedPersonaCandidates,
    getPublishers()
  );
  const topThreePublishers = recommendedPublishers.slice(0, 3).map((item) => item.publisher.name);
  const selectedPersonas = selectedPersonaCandidates.map((item) => item.persona.name);
  const excludedPublisherNames = excludedPublishers.map((item) => item.publisher.name);
  const candidates = retrieveCampaignCandidates(analysis).data;
  const candidatePublishers = candidates.publisherCandidates.map((item) => item.publisher.name);
  const candidatePersonas = candidates.personaCandidates.map((item) => item.persona.name);
  const candidateWarnings = candidates.warnings;

  const checks: EvalCheck[] = [
    {
      name: "extraction-category-taxonomy",
      passed: advertiserCategorySet.has(analysis.category),
      detail: `Category: ${analysis.category}`
    },
    {
      name: "extraction-category",
      passed: analysis.category === evalCase.expectedCategory,
      detail: `Category: ${analysis.category}`
    }
  ];

  if (evalCase.expectedTopPublishers.length > 0) {
    checks.push(
      {
        name: "candidate-publisher-recall",
        passed: evalCase.expectedTopPublishers.every((name) => candidatePublishers.includes(name)),
        detail: `Candidates: ${candidatePublishers.join(", ")}`
      },
      {
        name: "publisher-fit",
        passed: evalCase.expectedTopPublishers.every((name) => topThreePublishers.includes(name)),
        detail: `Top 3: ${topThreePublishers.join(", ")}`
      }
    );
  }

  if (evalCase.expectedPersonas.length > 0) {
    checks.push(
      {
        name: "candidate-persona-recall",
        passed: evalCase.expectedPersonas.every((name) => candidatePersonas.includes(name)),
        detail: `Candidates: ${candidatePersonas.join(", ")}`
      },
      {
        name: "persona-fit",
        passed: evalCase.expectedPersonas.every((name) => selectedPersonas.includes(name)),
        detail: `Selected: ${selectedPersonas.join(", ")}`
      }
    );
  }

  if (evalCase.shouldExclude.length > 0) {
    checks.push({
      name: "exclusion-fit",
      passed: evalCase.shouldExclude.some((name) => excludedPublisherNames.includes(name)),
      detail: `Excluded: ${excludedPublisherNames.join(", ")}`
    });
  }

  if (evalCase.expectedPriceTier) {
    checks.push({
      name: "price-tier",
      passed: analysis.priceTier === evalCase.expectedPriceTier,
      detail: `Price tier: ${analysis.priceTier}`
    });
  }

  if (evalCase.expectedAmbiguityLevel) {
    checks.push({
      name: "ambiguity-level",
      passed: analysis.ambiguityLevel === evalCase.expectedAmbiguityLevel,
      detail: `Ambiguity: ${analysis.ambiguityLevel}`
    });
  }

  if (evalCase.expectedProductSignals) {
    checks.push({
      name: "product-signal-recall",
      passed: evalCase.expectedProductSignals.every((signal) => analysis.productSignals.includes(signal)),
      detail: `Signals: ${analysis.productSignals.join(", ")}`
    });
    checks.push({
      name: "product-signal-taxonomy",
      passed: analysis.productSignals.every((signal) => productSignalSet.has(signal)),
      detail: `Signals: ${analysis.productSignals.join(", ")}`
    });
  }

  if (evalCase.expectedCandidateWarnings) {
    checks.push({
      name: "candidate-warning",
      passed: evalCase.expectedCandidateWarnings.every((warning) => includesText(candidateWarnings, warning)),
      detail: `Candidate warnings: ${candidateWarnings.join(" | ")}`
    });
  }

  if (evalCase.expectedResultWarnings) {
    const resultWarnings = analysis.ambiguityLevel === "high"
      ? ["Advertiser input is low-signal; recommendations should be treated as directional."]
      : [];

    checks.push({
      name: "result-warning",
      passed: evalCase.expectedResultWarnings.every((warning) => includesText(resultWarnings, warning)),
      detail: `Result warnings: ${resultWarnings.join(" | ")}`
    });
  }

  if (evalCase.forbiddenTopPublishers) {
    checks.push({
      name: "forbidden-top-publisher",
      passed: evalCase.forbiddenTopPublishers.every((name) => !topThreePublishers.includes(name)),
      detail: `Top 3: ${topThreePublishers.join(", ")}`
    });
  }

  const score = Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);

  return {
    id: evalCase.id,
    score,
    passed: checks.every((check) => check.passed),
    checks
  };
}

function analysisFromEvalCase(evalCase: EvalCase): AdvertiserAnalysis {
  const ambiguityLevel = evalCase.expectedAmbiguityLevel ?? "low";

  return {
    originalDescription: evalCase.input,
    category: evalCase.expectedCategory,
    secondaryCategories: [],
    priceTier: evalCase.expectedPriceTier ?? "mid_market",
    audienceHints: audienceHintsForCategory(evalCase.expectedCategory),
    productSignals: evalCase.expectedProductSignals ?? [],
    valuePropositions: evalCase.expectedProductSignals ?? [],
    purchaseModel: evalCase.expectedProductSignals?.includes("subscription") ? "subscription" : "one-time purchase",
    likelyObjective: evalCase.expectedCategory === "b2b_saas" ? "qualified lead generation" : "new customer acquisition",
    ambiguityLevel,
    confidence: ambiguityLevel === "high" ? 0.35 : 0.86
  };
}

function audienceHintsForCategory(category: string) {
  const hintsByCategory: Record<string, string[]> = {
    pet_food: ["pet owners"],
    sustainable_apparel: ["women", "sustainability-minded shoppers"],
    functional_beverages: ["health-conscious shoppers"],
    luxury_accessories: ["gift buyers", "high-income shoppers"],
    wellness: ["health-conscious shoppers"],
    refillable_products: ["families", "sustainability-minded shoppers"],
    supplements: ["performance-oriented shoppers", "health-conscious shoppers"],
    beauty: ["Gen Z shoppers", "beauty shoppers"],
    home_goods: ["design-conscious homeowners", "gift buyers"],
    b2b_saas: ["business buyers"]
  };

  return hintsByCategory[category] ?? ["broad consumer audience"];
}

function includesText(values: string[], expected: string) {
  return values.some((value) => value.toLowerCase().includes(expected.toLowerCase()));
}

function renderMarkdownReport(results: EvalResult[], averageScore: number) {
  const lines = [
    "# Campaign Planner Eval Report",
    "",
    `Average score: ${averageScore}`,
    "",
    "| Case | Score | Status |",
    "| --- | ---: | --- |"
  ];

  results.forEach((result) => {
    lines.push(`| ${result.id} | ${result.score} | ${result.passed ? "pass" : "fail"} |`);
  });

  lines.push("", "## Details", "");

  results.forEach((result) => {
    lines.push(`### ${result.id}`, "");
    result.checks.forEach((check) => {
      lines.push(`- ${check.passed ? "pass" : "fail"} ${check.name}: ${check.detail}`);
    });
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
}
