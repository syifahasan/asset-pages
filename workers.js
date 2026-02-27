export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    if (path === "/api/assets") {
      const assetId = url.searchParams.get("assetId"); // optional
      const res = await fetch("https://api.notion.com/v1/databases/" + env.NOTION_DB_ID + "/query", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            and: [
              { property: "Public", checkbox: { equals: true } },
              ...(assetId
                ? [{ property: "Serial / Asset ID", rich_text: { equals: assetId } }]
                : [])
            ],
          },
          page_size: 100,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return json({ error: "Notion query failed", detail: text }, 500);
      }

      const data = await res.json();

      // Mapping Notion -> JSON publik (sembunyikan field sensitif di sini)
      const items = data.results.map((p) => ({
        id: p.id,
        name: title(p.properties.Item),
        assetId: richText(p.properties["Serial / Asset ID"]),
        category: select(p.properties.Category),
        condition: select(p.properties.Condition),
        location: select(p.properties.Location),
        status: select(p.properties.Status),
        description: richText(p.properties.Description),
        // Tambahkan field public lain jika perlu
        lastEdited: p.last_edited_time,
      }));

      return json({ items }, 200);
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders() });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function title(prop) {
  const t = prop?.title?.[0]?.plain_text;
  return t || "";
}
function richText(prop) {
  const t = prop?.rich_text?.[0]?.plain_text;
  return t || "";
}
function select(prop) {
  return prop?.select?.name || "";
}