import { createClient } from 'redis';

const databaseId = process.env.NOTION_PROFILE_DATABASE_ID;
const notionToken = process.env.NOTION_TOKEN;
const redisUrl = process.env.REDIS_URL;

const redis = await createClient({ url: redisUrl }).connect();

export async function GET() {
  
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

      const name = data.results[0].properties.Name.title[0].text.content;
      await redis.set("name", name, { EX: 5 * 60 });

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

  