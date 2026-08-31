import type { AdvertiserAnalysis, CreativeVariant, ScoredPersona } from "./types";

export function generateFallbackCreative(
  analysis: AdvertiserAnalysis,
  selectedPersonas: ScoredPersona[]
): CreativeVariant[] {
  return selectedPersonas.slice(0, 5).map((scoredPersona, index) => {
    const persona = scoredPersona.persona;
    const angle = scoredPersona.messagingAngles[0] ?? persona.messaging_preferences[0] ?? "clear value";
    const categoryLabel = readableCategory(analysis.category);
    const valueProp = analysis.valuePropositions[0] ?? "a sharper everyday upgrade";

    return {
      id: `creative_${String(index + 1).padStart(2, "0")}`,
      personaId: persona.id,
      personaName: persona.name,
      headline: headlineFor(categoryLabel, angle, persona.name),
      body: bodyFor(analysis, valueProp, angle),
      rationale: `Built for ${persona.name}: ${persona.description}`,
      tone: toneFor(angle)
    };
  });
}

function headlineFor(categoryLabel: string, angle: string, personaName: string) {
  if (angle.includes("science")) {
    return `${categoryLabel}: made for proof-first shoppers`;
  }

  if (angle.includes("sustainability")) {
    return `${categoryLabel} with a lighter footprint`;
  }

  if (angle.includes("subscription") || angle.includes("speed")) {
    return `${categoryLabel}, easier to keep stocked`;
  }

  if (angle.includes("gift")) {
    return `A ${categoryLabel} gift that feels considered`;
  }

  if (personaName.includes("Value")) {
    return `Better ${categoryLabel}, clearer value`;
  }

  return `A smarter ${categoryLabel} choice`;
}

function bodyFor(analysis: AdvertiserAnalysis, valueProp: string, angle: string) {
  const signalCopy = analysis.productSignals.slice(0, 2).join(" and ");
  const audience = analysis.audienceHints[0] ?? "the shoppers you want most";
  const angleCopy = angle ? `Lead with ${angle}.` : "Lead with clear benefits.";
  const signalSentence = signalCopy ? `Built around ${signalCopy}.` : "Positioned around a clear shopper need.";

  return `${signalSentence} ${angleCopy} Aimed at ${audience} looking for ${valueProp}.`;
}

function toneFor(angle: string) {
  if (angle.includes("science")) {
    return "credible and specific";
  }

  if (angle.includes("sustainability")) {
    return "transparent and values-led";
  }

  if (angle.includes("gift")) {
    return "warm and polished";
  }

  if (angle.includes("value")) {
    return "direct and practical";
  }

  return "clear and helpful";
}

function readableCategory(category: string) {
  if (category === "unknown") {
    return "offer";
  }

  return category.replaceAll("_", " ");
}
