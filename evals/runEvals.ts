import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateDeterministicCampaign } from "../src/lib/campaignEngine";
import { validateCampaignResult } from "../src/lib/schemas";

type EvalCase = {
  id: string;
  input: string;
  expectedTopPublishers: string[];
  expectedPersonas: string[];
  shouldExclude: string[];
};

type EvalResult = {
  id: string;
  score: number;
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
};

const fixturesPath = path.join(process.cwd(), "evals", "fixtures", "advertiser-cases.json");
const reportsPath = path.join(process.cwd(), "evals", "reports");
const cases = JSON.parse(readFileSync(fixturesPath, "utf8")) as EvalCase[];

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
  const result = generateDeterministicCampaign(evalCase.input);
  const topThreePublishers = result.recommendedPublishers.slice(0, 3).map((item) => item.publisher.name);
  const selectedPersonas = result.selectedPersonas.map((item) => item.persona.name);
  const excludedPublishers = result.excludedPublishers.map((item) => item.publisher.name);
  const validationErrors = validateCampaignResult(result);
  const allocationTotal = result.campaignConfig.budget.allocation.reduce(
    (total, item) => total + item.budgetPercent,
    0
  );

  const checks = [
    {
      name: "publisher-fit",
      passed: evalCase.expectedTopPublishers.every((name) => topThreePublishers.includes(name)),
      detail: `Top 3: ${topThreePublishers.join(", ")}`
    },
    {
      name: "persona-fit",
      passed: evalCase.expectedPersonas.every((name) => selectedPersonas.includes(name)),
      detail: `Selected: ${selectedPersonas.join(", ")}`
    },
    {
      name: "exclusion-fit",
      passed: evalCase.shouldExclude.some((name) => excludedPublishers.includes(name)),
      detail: `Excluded: ${excludedPublishers.join(", ")}`
    },
    {
      name: "creative-count",
      passed: result.creativeVariants.length >= 3 && result.creativeVariants.length <= 5,
      detail: `${result.creativeVariants.length} variants`
    },
    {
      name: "budget-total",
      passed: allocationTotal === 100,
      detail: `${allocationTotal}%`
    },
    {
      name: "schema-validation",
      passed: validationErrors.length === 0,
      detail: validationErrors.length === 0 ? "valid" : validationErrors.join(" ")
    }
  ];
  const score = Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);

  return {
    id: evalCase.id,
    score,
    passed: checks.every((check) => check.passed),
    checks
  };
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
