export interface GeneratedSnippet {
  text: string;
  difficulty: number;
  snippet_type: string;
  contains_title: boolean;
}

export async function generateSnippets(
  lyrics: string,
  songTitle: string,
  artistName: string,
  apiKey: string,
  isDeepCut = false
): Promise<GeneratedSnippet[]> {
  const difficultyNote = isDeepCut
    ? "C'est une chanson moins connue : oriente les difficultés vers 3-5 (évite les 1-2 sauf refrain très accrocheur)."
    : "C'est un grand hit : varie librement entre 1-5, les refrains évidents peuvent être à 1-2.";

  const prompt = `Tu aides à construire un jeu de quiz musical. Extrais 3 à 5 snippets de paroles depuis cette chanson qui feraient de bonnes questions pour deviner la chanson.

Chanson : "${songTitle}" de ${artistName}

Paroles :
${lyrics.slice(0, 3000)}

Règles :
- Chaque snippet : 1 à 4 lignes consécutives, extraites mot pour mot
- Préfère les passages distinctifs, imagés ou mémorables
- Si le snippet contient le titre exact de la chanson, mets contains_title à true
- ${difficultyNote}
- snippet_type : "chorus" (refrain), "verse" (couplet), "bridge", "intro", "outro", ou "other"

Retourne UNIQUEMENT un tableau JSON valide, sans aucun autre texte :
[{"text":"...","difficulty":2,"snippet_type":"chorus","contains_title":false}]`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude API ${res.status}: ${(err as any)?.error?.message ?? JSON.stringify(err)}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";

  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as GeneratedSnippet[];
  } catch {
    return [];
  }
}
