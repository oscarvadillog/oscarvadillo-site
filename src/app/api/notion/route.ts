export async function GET() {
    const databaseId = process.env.NOTION_DATABASE_ID;
    const notionToken = process.env.NOTION_TOKEN;
  
    try {
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({}),
      });
  
      if (!response.ok) {
        throw new Error(`Notion API error: ${response.status}`);
      }
  
      const data = await response.json();
      return new Response(JSON.stringify(data.results), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching Notion data:", error);
      return new Response(JSON.stringify({ error: "Could not fetch Notion data" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  