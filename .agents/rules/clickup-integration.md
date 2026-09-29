# ClickUp Bot & Webhook Integration Rules

When building conversational bots or webhook listeners for ClickUp, observe the following critical guidelines:

## 1. Avoid Slash Commands (`/`) for Bot Triggers
ClickUp relies heavily on its own native slash command menu. Typing `/` opens the ClickUp UI menu and intercepts the `Enter` key, making it very frustrating to send messages to a bot. 
**Rule:** Always use a non-slash prefix like `!` (e.g. `!capydam search`) when building chatbots that live inside ClickUp to bypass their native UI menu.

## 2. Webhooks Fail in Chat Channels (Polling Required)
ClickUp treats Chat Channels as "Views" internally, but the ClickUp Webhook API is **deaf** to Chat Channels. Neither `viewCommentPosted` nor `taskCommentPosted` will trigger when a user sends a message in a Chat view. 
**Rule:** To build a bot that listens to a ClickUp Chat Channel, you **must bypass webhooks entirely** and build a polling script (e.g., a 5-second Cron Job) that actively fetches `GET https://api.clickup.com/api/v2/view/{view_id}/comment` and tracks the timestamp of the last processed message.

## 3. Rich Text JSON Image Embedding
If you are posting comments using ClickUp's advanced Rich Text JSON array format (e.g., `comment: [{ text: "...", attributes: { "advanced-banner": "..." } }]`) to bypass standard markdown limitations, ClickUp will **not** parse standard markdown images (`![img](url)`).
**Rule:** To embed an external image natively within a Rich Text JSON payload (without needing to upload it as an attachment first), inject a native image block into the array:
`{ type: "image", image: { url: "https://your-public-url.com/image.png" } }`
