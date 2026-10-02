import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { extractSearchKeywords } from './ai.service';

const prisma = new PrismaClient();

export const postClickupComment = async (targetId: string, targetType: 'task' | 'view', messagePayload: any) => {
  const token = process.env.CLICKUP_API_TOKEN?.trim();
  if (!token) {
    console.error("CLICKUP_API_TOKEN is missing");
    return;
  }
  
  try {
    const endpoint = targetType === 'task' 
      ? `https://api.clickup.com/api/v2/task/${targetId}/comment`
      : `https://api.clickup.com/api/v2/view/${targetId}/comment`;

    console.log(`[ClickUp] Posting reply to ${endpoint}`);
    
    // If it's a string, wrap it in comment_text. Otherwise, it's a rich payload.
    const body = typeof messagePayload === 'string' ? { comment_text: messagePayload } : messagePayload;

    const response = await axios.post(
      endpoint,
      body,
      {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`[ClickUp] Reply posted successfully. Status: ${response.status}`);
  } catch (error: any) {
    console.error("Failed to post comment to ClickUp");
    console.error("Status:", error?.response?.status);
    console.error("Data:", JSON.stringify(error?.response?.data, null, 2));
    console.error("Message:", error.message);
  }
};

export const handleSearchCommand = async (targetId: string, targetType: 'task' | 'view', query: string, limit: number = 5) => {
  const keywords = await extractSearchKeywords(query);

  if (keywords.length === 0) {
    await postClickupComment(targetId, targetType, "Could not extract valid search terms from your query. Please try again.");
    return;
  }

  // Build an OR array for each keyword
  const keywordConditions = keywords.map(kw => ({
    OR: [
      { originalName: { contains: kw, mode: 'insensitive' } },
      { filename: { contains: kw, mode: 'insensitive' } },
      { description: { contains: kw, mode: 'insensitive' } }
    ]
  }));

  const assets = await prisma.asset.findMany({
    where: {
      OR: keywordConditions as any, // "Match ANY of the words" (OR logic)
      deletedAt: null
    },
    take: limit
  });

  const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
  
  const comment: any[] = [
      { type: "emoticon", emoticon: { code: "1f50d", name: "mag", type: "default" }, text: "🔍" },
      { text: `  Capydam Search Results  `, attributes: { bold: true } },
      {
          text: "\n",
          attributes: { "advanced-banner": "8b461d23-f294-4683-8826-2cb9bf991071", "advanced-banner-color": "purple", header: 3 }
      },
      { text: "\n", attributes: {} },
      { text: `Found ${assets.length} assets for `, attributes: { italic: true } },
      { text: `"${query}"`, attributes: { bold: true } },
      { text: "\n", attributes: {} },
      { text: "\n", attributes: {} }
  ];

  assets.forEach((a, i) => {
      comment.push({ type: "emoticon", emoticon: { code: "1f4c1", name: "file_folder", type: "default" }, text: "📁" });
      // Route users to the Capydam Web Dashboard for this specific asset
      const assetUrl = `${serverUrl}/assets/${a.id}`;
      comment.push({ text: ` ${i + 1}. ${a.originalName} `, attributes: { bold: true, link: assetUrl } });
      comment.push({ text: "\n", attributes: {} });
      
      if (a.mimeType.startsWith('image/')) {
         const imageUrl = `${serverUrl}/api/assets/view/${a.id}/image.png`;
         comment.push({ type: "image", image: { url: imageUrl } });
         comment.push({ text: "\n\n", attributes: {} });
      } else {
         comment.push({ text: "\n", attributes: {} });
      }
  });

  const payload = { notify_all: true, comment: comment };
  await postClickupComment(targetId, targetType, payload);
};

export const handleInfoCommand = async (targetId: string, targetType: 'task' | 'view', assetId: string) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId }
    });
    if (!asset) {
      await postClickupComment(targetId, targetType, `Asset not found with ID: ${assetId}`);
      return;
    }

    const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
    
    const comment: any[] = [
        { type: "emoticon", emoticon: { code: "1f4e6", name: "package", type: "default" }, text: "📦" },
        { text: `  Capydam Asset Info  `, attributes: { bold: true } },
        {
            text: "\n",
            attributes: { "advanced-banner": "8b461d23-f294-4683-8826-2cb9bf991071", "advanced-banner-color": "blue-strong", header: 3 }
        },
        { text: "\n", attributes: {} },
        { text: `Name: `, attributes: { bold: true } },
        { text: `${asset.originalName}\n`, attributes: {} },
        { text: `Type: `, attributes: { bold: true } },
        { text: `${asset.mimeType}\n`, attributes: {} },
        { text: `Size: `, attributes: { bold: true } },
        { text: `${(asset.size / 1024 / 1024).toFixed(2)} MB\n`, attributes: {} },
        { text: `Uploaded: `, attributes: { bold: true } },
        { text: `${asset.createdAt.toISOString()}\n\n`, attributes: {} },
    ];
    
    // Auto-preview for images
    if (asset.mimeType.startsWith('image/')) {
       const imageUrl = `${serverUrl}/api/assets/view/${asset.id}/image.png`;
       comment.push({ type: "emoticon", emoticon: { code: "1f5bc", name: "frame_with_picture", type: "default" }, text: "🖼️" });
       comment.push({ text: `  Preview:\n\n`, attributes: { bold: true } });
       comment.push({ type: "image", image: { url: imageUrl } });
       comment.push({ text: "\n", attributes: {} });
    }

    const payload = { notify_all: true, comment: comment };
    await postClickupComment(targetId, targetType, payload);
  } catch(e) {
    await postClickupComment(targetId, targetType, `Error finding asset: ${assetId}`);
  }
};

export const handleDownloadCommand = async (targetId: string, targetType: 'task' | 'view', assetId: string) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId }
    });
    if (!asset) {
      await postClickupComment(targetId, targetType, `Asset not found with ID: ${assetId}`);
      return;
    }
    const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
    const url = `${serverUrl}/api/assets/download/${assetId}`;
    await postClickupComment(targetId, targetType, `Download link for ${asset.originalName}:\n${url}`);
  } catch(e) {
    await postClickupComment(targetId, targetType, `Error generating download link: ${assetId}`);
  }
};

export const handleUploadCommand = async (targetId: string, targetType: 'task' | 'view', fileUrl: string) => {
  await postClickupComment(targetId, targetType, `Upload command received for: ${fileUrl}. (File ingestion from URL pending implementation).`);
};
