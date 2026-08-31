import { CircleOff } from "lucide-react";
import type { ExcludedPublisher } from "@/lib/types";

type ExcludedPublishersProps = {
  publishers: ExcludedPublisher[];
};

export function ExcludedPublishers({ publishers }: ExcludedPublishersProps) {
  return (
    <section className="result-section" aria-labelledby="excluded-heading">
      <div className="section-heading">
        <CircleOff aria-hidden="true" size={20} />
        <h2 id="excluded-heading">Excluded publishers</h2>
      </div>
      <div className="excluded-grid">
        {publishers.map((item) => (
          <article className="excluded-card" key={item.publisher.id}>
            <div className="mini-topline">
              <h3>{item.publisher.name}</h3>
              <span>{item.score}</span>
            </div>
            <p>{item.reason}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
