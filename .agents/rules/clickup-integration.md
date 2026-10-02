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

## 4. Search Query Logic (AND vs OR)
When users execute natural language searches (e.g., "Find me images for the Cartier module"), using strict `AND` logic across database fields will often result in 0 matches because generic words ("images", "module") rarely exist in the asset's specific filename or tags.
**Rule:** Always use **`OR`** logic when querying multiple keywords against database fields. To maintain relevance, ensure the AI keyword extraction prompt is configured to aggressively strip out conversational noise and generic asset terms (like "video", "sample", "module", "images") so that the `OR` query is only executed against high-value proper nouns.

## 5. Chat Bot UX Patterns
A conversational interface shouldn't require rigid command syntax.
**Rule:** 
- **Default Actions**: If a user types `!capydam <query>` without an explicit sub-command (like `info` or `upload`), default to executing a search rather than returning an error.
- **Hidden Modifiers**: Support inline modifiers (like `+5` or `+10` to adjust the search return limit) by using regex to extract and slice them out of the `args` array before parsing the main command or extracting keywords.
- **Asset Links**: Always return clickable deep-links back to the application's frontend web dashboard (`/assets/:id`) rather than raw API download endpoints.
