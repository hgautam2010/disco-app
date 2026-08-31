import { Megaphone } from "lucide-react";
import type { CreativeVariant } from "@/lib/types";

type CreativeVariantsProps = {
  variants: CreativeVariant[];
};

export function CreativeVariants({ variants }: CreativeVariantsProps) {
  return (
    <section className="result-section" aria-labelledby="creative-heading">
      <div className="section-heading">
        <Megaphone aria-hidden="true" size={20} />
        <h2 id="creative-heading">Creative variants</h2>
      </div>
      <div className="creative-grid">
        {variants.map((variant) => (
          <article className="creative-card" key={variant.id}>
            <p className="persona-pill">{variant.personaName}</p>
            <h3>{variant.headline}</h3>
            <p className="creative-body">{variant.body}</p>
            <p className="rationale-copy">{variant.rationale}</p>
            <span>{variant.tone}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
