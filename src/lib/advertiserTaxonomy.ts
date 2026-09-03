export const advertiserCategoryValues = [
  "pet_food",
  "sustainable_apparel",
  "functional_beverages",
  "home_goods",
  "refillable_products",
  "supplements",
  "luxury_accessories",
  "beauty",
  "b2b_saas",
  "wellness",
  "unknown"
] as const;

export const productSignalValues = [
  "subscription",
  "premium",
  "sustainability",
  "science-backed",
  "gifting",
  "convenience",
  "value",
  "performance"
] as const;

export type AdvertiserCategory = (typeof advertiserCategoryValues)[number];
export type ProductSignal = (typeof productSignalValues)[number];
