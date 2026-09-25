import { Request, Response } from 'express';
import { handleSearchCommand, handleInfoCommand, handleDownloadCommand, handleUploadCommand, postClickupComment } from '../services/clickup.service';

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const { event, task_id, view_id, history_items } = req.body;
    
    // DEBUG LOGGING TO FILE
    const fs = require('fs');
    const logStr = `\n--- NEW WEBHOOK ---\nEvent: ${event}\nPayload: ${JSON.stringify(req.body, null, 2)}\n`;
    fs.appendFileSync('webhook-debug.txt', logStr);

    console.log('[ClickUp Webhook] Received raw payload event:', event);
    console.dir(req.body, { depth: null });

    // We care about task comments or view (chat channel) comments
    if (event !== 'taskCommentPosted' && event !== 'viewCommentPosted') {
      return res.status(200).send('OK');
    }

    const targetId = task_id || view_id;
    const targetType = task_id ? 'task' : 'view';

    if (!targetId || !history_items || history_items.length === 0) {
      return res.status(200).send('OK');
    }

    // Extract the text of the comment
    const commentData = history_items[0]?.comment;
    const textContent = (commentData?.text_content || '').trim();

    // Check if the comment starts with !capydam
    const args = textContent.split(/\s+/);
    if (args[0].toLowerCase() !== '!capydam') {
      // Not a command for us, ignore
      return res.status(200).send('OK');
    }

    const commandName = args[1]?.toLowerCase();
    const commandArgs = args.slice(2).join(' ');

    if (!commandName) {
      const helpMsg = `**Capydam Available Commands:**\n\n` +
                      `🔍 \`!capydam search <query>\` - Search for assets by name\n` +
                      `ℹ️ \`!capydam info <asset-id>\` - Get details about an asset\n` +
                      `📥 \`!capydam download <asset-id>\` - Get a download link for an asset\n` +
                      `☁️ \`!capydam upload <url>\` - Upload an asset from a URL`;
      await postClickupComment(targetId, targetType, helpMsg);
      return res.status(200).send('OK');
    }

    console.log(`[ClickUp Webhook] Received command: ${commandName} with args: ${commandArgs} in ${targetType} ${targetId}`);

    switch (commandName) {
      case 'search':
        if (!commandArgs) {
          await postClickupComment(targetId, targetType, 'Please provide a search term. Example: `!capydam search logo`');
          break;
        }
        await handleSearchCommand(targetId, targetType, commandArgs);
        break;
      case 'info':
        if (!commandArgs) {
          await postClickupComment(targetId, targetType, 'Please provide an asset ID. Example: `!capydam info 123-abc`');
          break;
        }
        await handleInfoCommand(targetId, targetType, commandArgs);
        break;
      case 'download':
        if (!commandArgs) {
          await postClickupComment(targetId, targetType, 'Please provide an asset ID. Example: `!capydam download 123-abc`');
          break;
        }
        await handleDownloadCommand(targetId, targetType, commandArgs);
        break;
      case 'upload':
        if (!commandArgs) {
          await postClickupComment(targetId, targetType, 'Please provide a file URL. Example: `!capydam upload https://example.com/file.png`');
          break;
        }
        await handleUploadCommand(targetId, targetType, commandArgs);
        break;
      default:
        await postClickupComment(targetId, targetType, `Unknown command: ${commandName}. Type \`!capydam\` to see available commands.`);
        console.log(`[ClickUp Webhook] Unknown command: ${commandName}`);
    }

    // ClickUp webhooks expect a 200 OK quickly
    res.status(200).send('OK');
  } catch (error) {
    console.error('[ClickUp Webhook] Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};
