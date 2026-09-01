import type { CampaignResult, CreativeVariant } from "./types";

function validateCreativeVariants(variants: CreativeVariant[]) {
  const errors: string[] = [];

  if (variants.length < 3 || variants.length > 5) {
    errors.push("Creative output must include 3 to 5 variants.");
  }

  variants.forEach((variant, index) => {
    if (!variant.personaId) {
      errors.push(`Creative ${index + 1} is missing a persona id.`);
    }

    if (!variant.headline || variant.headline.length > 80) {
      errors.push(`Creative ${index + 1} must have a headline under 80 characters.`);
    }

    if (!variant.body || variant.body.length > 220) {
      errors.push(`Creative ${index + 1} must have body copy under 220 characters.`);
    }
  });

  return errors;
}

export function validateCampaignResult(result: CampaignResult) {
  const errors: string[] = [];
  const recommendedPublisherIds = new Set(result.recommendedPublishers.map((item) => item.publisher.id));
  const selectedPersonaIds = new Set(result.selectedPersonas.map((item) => item.persona.id));
  const allocationTotal = result.campaignConfig.budget.allocation.reduce(
    (total, item) => total + item.budgetPercent,
    0
  );

  result.excludedPublishers.forEach((item) => {
    if (recommendedPublisherIds.has(item.publisher.id)) {
      errors.push(`${item.publisher.name} cannot be both recommended and excluded.`);
    }
  });

  result.creativeVariants.forEach((variant) => {
    if (!selectedPersonaIds.has(variant.personaId)) {
      errors.push(`${variant.headline} references an unselected persona.`);
    }
  });

  if (Math.abs(allocationTotal - 100) > 0.01) {
    errors.push(`Budget allocation must sum to 100, received ${allocationTotal}.`);
  }

  return [...errors, ...validateCreativeVariants(result.creativeVariants)];
}
