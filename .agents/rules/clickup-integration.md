# ClickUp Bot & Webhook Integration Rules

When building conversational bots or webhook listeners for ClickUp, observe the following critical guidelines:

## 1. Avoid Slash Commands (`/`) for Bot Triggers
ClickUp relies heavily on its own native slash command menu. Typing `/` opens the ClickUp UI menu and intercepts the `Enter` key, making it very frustrating to send messages to a bot. 
**Rule:** Always use a non-slash prefix like `!` (e.g. `!capydam search`) when building chatbots that live inside ClickUp to bypass their native UI menu.

## 2. Listening to Chat Channels vs Tasks
ClickUp treats Chat Channels as "Views" internally. 
**Rule:** To listen to messages in a ClickUp Chat Channel, your webhook must explicitly subscribe to the `viewCommentPosted` event. Normal task comments trigger `taskCommentPosted`. Ensure the webhook registration payload includes both if the bot is meant to be available globally.
