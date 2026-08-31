import type { AdvertiserAnalysis, AmbiguityLevel, PriceTier } from "./types";

type Rule = {
  category: string;
  keywords: string[];
};

const categoryRules: Rule[] = [
  {
    category: "pet_food",
    keywords: ["dog", "dogs", "cat", "cats", "pet", "pets", "puppy", "kitten", "vet", "joint", "treats"]
  },
  {
    category: "sustainable_apparel",
    keywords: ["activewear", "apparel", "clothing", "leggings", "recycled", "ocean plastic", "sustainable", "shoes"]
  },
  {
    category: "functional_beverages",
    keywords: ["drink", "beverage", "sparkling", "adaptogens", "cocktail", "hangover", "soda", "non-alcoholic"]
  },
  {
    category: "home_goods",
    keywords: ["candles", "candle", "bedding", "linen", "home", "soy wax", "fragrance", "kitchen", "cookware"]
  },
  {
    category: "refillable_products",
    keywords: ["refillable", "cleaning", "single-use", "plastic bottles", "concentrated", "non-toxic"]
  },
  {
    category: "supplements",
    keywords: ["protein", "creatine", "pre-workout", "supplement", "supplements", "workout"]
  },
  {
    category: "luxury_accessories",
    keywords: ["handbag", "handbags", "leather", "italian", "handcrafted", "florence", "custom-fit"]
  },
  {
    category: "beauty",
    keywords: ["skincare", "haircare", "makeup", "beauty", "personalized"]
  },
  {
    category: "b2b_saas",
    keywords: ["b2b", "saas", "dental", "workflow", "patient", "software", "automate"]
  },
  {
    category: "wellness",
    keywords: ["wellness", "feel better", "health", "self-care", "sleep", "meditation"]
  }
];

const signalRules: Rule[] = [
  {
    category: "subscription",
    keywords: ["subscription", "monthly", "subscribe", "first three months", "box"]
  },
  {
    category: "premium",
    keywords: ["premium", "craft", "craftsmanship", "handcrafted", "small-batch", "vet-formulated", "portugal"]
  },
  {
    category: "sustainability",
    keywords: ["sustainable", "recycled", "plastic", "refillable", "ethical", "single-use"]
  },
  {
    category: "science-backed",
    keywords: ["science", "evidence", "formulated", "vet", "joint", "creatine", "adaptogens"]
  },
  {
    category: "gifting",
    keywords: ["gift", "gifts", "holiday", "presentation", "last-minute"]
  },
  {
    category: "convenience",
    keywords: ["easy", "automate", "convenience", "subscription", "delivery", "quick", "refillable"]
  },
  {
    category: "value",
    keywords: ["half the cost", "price", "cheap", "affordable", "deal", "value", "compete on price"]
  },
  {
    category: "performance",
    keywords: ["performance", "technical", "patrollers", "serious", "workout", "pre-workout"]
  }
];

const vaguePhrases = ["we help people feel better", "new kind of thing", "idk", "just try it"];

export function analyzeAdvertiserDescription(description: string): AdvertiserAnalysis {
  const normalized = normalizeText(description);
  const categoryScores = categoryRules
    .map((rule) => ({
      category: rule.category,
      score: countKeywordMatches(normalized, rule.keywords)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const category = categoryScores[0]?.category ?? "unknown";
  const secondaryCategories = categoryScores.slice(1, 4).map((item) => item.category);
  const productSignals = signalRules
    .filter((rule) => countKeywordMatches(normalized, rule.keywords) > 0)
    .map((rule) => rule.category);

  const audienceHints = extractAudienceHints(normalized);
  const valuePropositions = extractValuePropositions(normalized, productSignals);
  const ambiguityLevel = determineAmbiguity(description, categoryScores.length, productSignals.length);
  const confidence = confidenceFor(ambiguityLevel, categoryScores[0]?.score ?? 0, productSignals.length);

  return {
    originalDescription: description.trim(),
    category,
    secondaryCategories,
    priceTier: inferPriceTier(normalized),
    audienceHints,
    productSignals,
    valuePropositions,
    purchaseModel: inferPurchaseModel(normalized),
    likelyObjective: inferObjective(normalized, category),
    ambiguityLevel,
    confidence
  };
}

export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function tokenize(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function countKeywordMatches(text: string, keywords: string[]) {
  return keywords.reduce((total, keyword) => (text.includes(keyword) ? total + 1 : total), 0);
}

function extractAudienceHints(text: string) {
  const hints: string[] = [];

  if (text.includes("senior dogs") || text.includes("pet") || text.includes("dog") || text.includes("cat")) {
    hints.push("pet owners");
  }

  if (text.includes("women") || text.includes("moms")) {
    hints.push("women");
  }

  if (text.includes("parent") || text.includes("moms") || text.includes("kids")) {
    hints.push("parents");
  }

  if (text.includes("health") || text.includes("wellness") || text.includes("joint") || text.includes("adaptogens")) {
    hints.push("health-conscious shoppers");
  }

  if (text.includes("sustainable") || text.includes("recycled") || text.includes("refillable")) {
    hints.push("sustainability-minded shoppers");
  }

  if (text.includes("serious") || text.includes("performance") || text.includes("workout") || text.includes("fitness")) {
    hints.push("performance-oriented shoppers");
  }

  if (text.includes("gift") || text.includes("handcrafted") || text.includes("small-batch")) {
    hints.push("gift buyers");
  }

  return uniqueOrFallback(hints, "broad consumer audience");
}

function extractValuePropositions(text: string, signals: string[]) {
  const values: string[] = [];

  if (signals.includes("sustainability")) {
    values.push("specific sustainability benefit");
  }

  if (signals.includes("science-backed")) {
    values.push("evidence-oriented product promise");
  }

  if (signals.includes("subscription")) {
    values.push("repeat purchase convenience");
  }

  if (signals.includes("gifting")) {
    values.push("giftable presentation");
  }

  if (signals.includes("value")) {
    values.push("clear savings versus premium alternatives");
  }

  if (text.includes("premium") || text.includes("handcrafted") || text.includes("italian")) {
    values.push("premium quality positioning");
  }

  return uniqueOrFallback(values, "needs sharper value proposition");
}

function inferPriceTier(text: string): PriceTier {
  const explicitPrice = text.match(/\$([0-9][0-9,]*)/);
  const price = explicitPrice ? Number(explicitPrice[1].replaceAll(",", "")) : null;

  if (price !== null && price >= 700) {
    return "luxury";
  }

  if (price !== null && price >= 150) {
    return "premium";
  }

  if (text.includes("luxury") || text.includes("italian") || text.includes("$1,200")) {
    return "luxury";
  }

  if (text.includes("premium") || text.includes("lululemon") || text.includes("$650")) {
    return "premium";
  }

  if (text.includes("half the cost") || text.includes("compete on price") || text.includes("affordable")) {
    return "value";
  }

  if (text.includes("budget") || text.includes("cheap")) {
    return "budget";
  }

  return "mid_market";
}

function inferPurchaseModel(text: string) {
  if (text.includes("subscription") || text.includes("box") || text.includes("monthly")) {
    return "subscription";
  }

  if (text.includes("custom") || text.includes("ships in 6 weeks") || text.includes("$1,200") || text.includes("$650")) {
    return "considered purchase";
  }

  if (text.includes("saas") || text.includes("software") || text.includes("workflow")) {
    return "sales-led service";
  }

  return "one-time purchase";
}

function inferObjective(text: string, category: string) {
  if (text.includes("subscription") || text.includes("box")) {
    return "subscription acquisition";
  }

  if (category === "b2b_saas") {
    return "qualified lead generation";
  }

  if (text.includes("average price") || text.includes("$1,200") || text.includes("$650")) {
    return "high-intent traffic";
  }

  return "new customer acquisition";
}

function determineAmbiguity(description: string, categoryCount: number, signalCount: number): AmbiguityLevel {
  const normalized = normalizeText(description);
  const wordCount = tokenize(description).length;

  if (vaguePhrases.some((phrase) => normalized.includes(phrase)) || wordCount < 5) {
    return "high";
  }

  if (categoryCount === 0 || signalCount === 0 || wordCount < 10) {
    return "medium";
  }

  return "low";
}

function confidenceFor(ambiguityLevel: AmbiguityLevel, categoryScore: number, signalCount: number) {
  if (ambiguityLevel === "high") {
    return 0.35;
  }

  if (ambiguityLevel === "medium") {
    return 0.58 + Math.min(categoryScore + signalCount, 4) * 0.05;
  }

  return Math.min(0.92, 0.72 + Math.min(categoryScore + signalCount, 5) * 0.04);
}

function uniqueOrFallback(values: string[], fallback: string) {
  const unique = Array.from(new Set(values));
  return unique.length > 0 ? unique : [fallback];
}
