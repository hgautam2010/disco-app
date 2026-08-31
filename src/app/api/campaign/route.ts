import { NextResponse } from "next/server";
import { generateCampaign } from "@/lib/campaignEngine";
import { validateCampaignResult } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { description?: unknown };
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (description.length < 4) {
      return NextResponse.json({ error: "Enter a more specific advertiser description." }, { status: 400 });
    }

    const campaign = await generateCampaign(description);
    const validationErrors = validateCampaignResult(campaign);

    return NextResponse.json({
      campaign: {
        ...campaign,
        warnings: Array.from(new Set([...campaign.warnings, ...validationErrors]))
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate campaign.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
