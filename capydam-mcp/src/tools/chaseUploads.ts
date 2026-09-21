import axios from 'axios';

export const getMissingProjectsTool = {
  name: "get_missing_projects",
  description: "Identify all missing projects (Collections) in CapyDAM. These are projects that have been created but have zero assets uploaded to them. Returns the project names and their respective owners.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function getMissingProjectsHandler() {
  const CAPYDAM_API_URL = process.env.CAPYDAM_API_URL || 'https://dam.capy-dev.com/api';
  const CAPYDAM_API_KEY = process.env.CAPYDAM_API_KEY;

  if (!CAPYDAM_API_KEY) {
    throw new Error("CAPYDAM_API_KEY environment variable is missing");
  }

  try {
    // targetUserId=all bypasses the userId filter so the MCP admin user can see all collections
    const response = await axios.get(`${CAPYDAM_API_URL}/collections`, {
      params: { targetUserId: 'all' },
      headers: {
        'x-api-key': CAPYDAM_API_KEY,
      },
    });

    const collections = response.data;
    
    if (!Array.isArray(collections)) {
      throw new Error("Invalid response from CapyDAM API");
    }

    // A missing project is a collection with 0 assets
    const missingProjects = collections.filter(c => c._count && c._count.assets === 0);

    if (missingProjects.length === 0) {
      return {
        content: [{ type: "text", text: `Great news! All projects currently have assets uploaded. There are no missing projects.` }],
      };
    }

    const formattedProjects = missingProjects.map(c => {
      const ownerName = c.owner?.name || c.owner?.email || c.userId || 'Unknown';
      return `- **${c.name}** (Owner: ${ownerName})`;
    }).join('\n');

    return {
      content: [
        {
          type: "text",
          text: `Found ${missingProjects.length} missing projects (zero assets uploaded):\n\n${formattedProjects}`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error fetching missing projects:", error.message);
    return {
      content: [
        { type: "text", text: `Error fetching missing projects from CapyDAM: ${error.message}` },
      ],
      isError: true,
    };
  }
}
