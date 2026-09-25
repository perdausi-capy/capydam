import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export const postClickupComment = async (targetId: string, targetType: 'task' | 'view', message: string) => {
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
    const response = await axios.post(
      endpoint,
      { comment_text: message },
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

export const handleSearchCommand = async (targetId: string, targetType: 'task' | 'view', query: string) => {
  const assets = await prisma.asset.findMany({
    where: {
      OR: [
        { originalName: { contains: query, mode: 'insensitive' } },
        { filename: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } }
      ],
      deletedAt: null
    },
    take: 5
  });

  const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
  let msg = `Found ${assets.length} assets for "${query}":\n\n`;
  
  assets.forEach((a, i) => {
    msg += `**${i + 1}. ${a.originalName}** (ID: ${a.id})\n\n`; // Changed from \n to \n\n
    if (a.mimeType.startsWith('image/')) {
       const imageUrl = `${serverUrl}/api/assets/view/${a.id}/image.png`;
       msg += `![${a.originalName}](${imageUrl})\n\n`;
    }
  });
  
  await postClickupComment(targetId, targetType, msg);
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
    let msg = `Asset Info:\nName: ${asset.originalName}\nType: ${asset.mimeType}\nSize: ${(asset.size / 1024 / 1024).toFixed(2)} MB\nUploaded: ${asset.createdAt.toISOString()}`;
    
    // Auto-preview for images
    if (asset.mimeType.startsWith('image/')) {
       const imageUrl = `${serverUrl}/api/assets/view/${asset.id}/image.png`;
       msg += `\n\nPreview:\n![${asset.originalName}](${imageUrl})`;
    }

    await postClickupComment(targetId, targetType, msg);
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
