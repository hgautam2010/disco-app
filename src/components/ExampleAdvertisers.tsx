"use client";

import { MousePointer2 } from "lucide-react";
import type { ExampleAdvertiser } from "@/lib/types";

type ExampleAdvertisersProps = {
  examples: ExampleAdvertiser[];
  disabled: boolean;
  onSelect: (description: string) => void;
};

export function ExampleAdvertisers({ examples, disabled, onSelect }: ExampleAdvertisersProps) {
  return (
    <section className="sample-panel" aria-labelledby="sample-heading">
      <div className="section-heading compact-heading">
        <MousePointer2 aria-hidden="true" size={18} />
        <h2 id="sample-heading">Samples</h2>
      </div>
      <div className="sample-list">
        {examples.map((example, index) => (
          <button
            key={example.id}
            className="sample-button"
            type="button"
            disabled={disabled}
            onClick={() => onSelect(example.description)}
            title={example.description}
          >
            <span>{index + 1}</span>
            {example.description}
          </button>
        ))}
      </div>
    </section>
  );
}
