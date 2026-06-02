const DEFAULT_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

export async function callNvidia(apiKey, model, messages, maxTokens = 1024, endpoint) {
  const url = endpoint && endpoint.trim() ? endpoint.trim() : DEFAULT_ENDPOINT;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`NVIDIA API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
