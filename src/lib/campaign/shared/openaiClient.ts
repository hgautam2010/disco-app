type ResponsesApiBody = {
  model: string;
  input: {
    role: "system" | "user";
    content: string;
  }[];
  text: {
    format: Record<string, unknown>;
  };
};

type ResponsesApiResult = {
  output_text?: string;
  output?: {
    content?: {
      type?: string;
      text?: string;
    }[];
  }[];
};

const responsesEndpoint = "https://api.openai.com/v1/responses";

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL || "gpt-5.1";
}

export async function createStructuredResponse<T>(body: ResponsesApiBody): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch(responsesEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI request failed with ${response.status}: ${errorBody}`);
  }

  const json = (await response.json()) as ResponsesApiResult;
  const outputText = extractOutputText(json);

  if (!outputText) {
    throw new Error("OpenAI response did not include output text.");
  }

  return JSON.parse(outputText) as T;
}

function extractOutputText(result: ResponsesApiResult) {
  if (typeof result.output_text === "string") {
    return result.output_text;
  }

  return (
    result.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text" && typeof content.text === "string")?.text ?? ""
  );
}
