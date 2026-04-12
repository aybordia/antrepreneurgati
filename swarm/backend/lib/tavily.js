export async function tavilySearch({ query, maxResults = 6 }) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: "advanced",
      include_answer: true,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = await response.json();

  return data.results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content.slice(0, 500),
    score: r.score,
  }));
}

export function formatResults(results) {
  return results
    .map((r, i) => `[Result ${i + 1}]\nTitle: ${r.title}\nSource: ${r.url}\nContent: ${r.snippet}`)
    .join("\n\n");
}
