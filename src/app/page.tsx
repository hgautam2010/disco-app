import { CampaignPlanner } from "@/components/CampaignPlanner";
import { getCatalogSummary, getExampleAdvertisers } from "@/lib/data";

export default function Home() {
  const examples = getExampleAdvertisers();
  const catalogSummary = getCatalogSummary();

  return (
    <main className="page-shell">
      <CampaignPlanner examples={examples} catalogSummary={catalogSummary} />
    </main>
  );
}
