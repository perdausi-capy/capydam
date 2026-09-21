import axios from 'axios';

export const searchDamAssetsTool = {
  name: "search_dam_assets",
  description: "Search the CapyDAM asset library for files. Use this to find source files, images, videos, and documents.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search term (e.g., 'Dubai Holding procurement module')",
      },
    },
    required: ["query"],
  },
};

export async function searchDamAssetsHandler(args: any) {
  const query = args.query;
  if (!query) {
    throw new Error("Missing query parameter");
  }

  const CAPYDAM_API_URL = process.env.CAPYDAM_API_URL || 'https://dam.capy-dev.com/api';
  const CAPYDAM_API_KEY = process.env.CAPYDAM_API_KEY;

  if (!CAPYDAM_API_KEY) {
    throw new Error("CAPYDAM_API_KEY environment variable is missing");
  }

  try {
    const response = await axios.get(`${CAPYDAM_API_URL}/assets`, {
      params: { search: query, limit: 10 },
      headers: {
        'x-api-key': CAPYDAM_API_KEY,
      },
    });

    const assets = response.data.results || response.data;
    
    if (!Array.isArray(assets) || assets.length === 0) {
      return {
        content: [{ type: "text", text: `No assets found in CapyDAM for query: "${query}"` }],
      };
    }

    const formattedAssets = assets.map((a: any) => {
      return `- **${a.originalName}** (ID: ${a.id})\n  Type: ${a.mimeType}\n  Path: ${a.path}\n  Owner ID: ${a.userId}`;
    }).join('\n\n');

    return {
      content: [
        {
          type: "text",
          text: `Found ${assets.length} assets matching "${query}":\n\n${formattedAssets}`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error searching CapyDAM:", error.message);
    return {
      content: [
        { type: "text", text: `Error searching CapyDAM: ${error.message}` },
      ],
      isError: true,
    };
  }
}
