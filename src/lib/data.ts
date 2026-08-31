import { readFileSync } from "node:fs";
import path from "node:path";
import publishersData from "../../data/publishers.json";
import personasData from "../../data/shopper_personas.json";
import type { ExampleAdvertiser, Persona, Publisher } from "./types";

const dataPath = (...segments: string[]) => path.join(process.cwd(), "data", ...segments);

export function getPublishers(): Publisher[] {
  return publishersData as Publisher[];
}

export function getPersonas(): Persona[] {
  return personasData as Persona[];
}

export function getExampleAdvertisers(): ExampleAdvertiser[] {
  const raw = readFileSync(dataPath("example_advertisers.txt"), "utf8");

  return raw
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.match(/^(\d+)\.\s+(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      id: `example_${match[1].padStart(2, "0")}`,
      description: match[2]
    }));
}

export function getCatalogSummary() {
  const publishers = getPublishers();
  const personas = getPersonas();
  const categories = Array.from(new Set(publishers.map((publisher) => publisher.category))).sort();

  return {
    publisherCount: publishers.length,
    personaCount: personas.length,
    categories
  };
}
