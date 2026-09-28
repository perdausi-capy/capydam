# Environment Variable & API Token Safety

When loading secret tokens, API keys, or credentials from `.env` files using Node.js (via `dotenv` or similar loaders), hidden newline/carriage return characters (`\r` or `\n`) can sometimes be accidentally appended during environment setup (especially via PowerShell scripts or echo commands).

## The Risk
Modern HTTP clients (like Axios) and the underlying Node.js HTTP parser strictly adhere to RFC specifications. If an `Authorization` header contains an invisible trailing `\r`, Node.js will silently drop or reject the header for safety (to prevent HTTP Response Splitting attacks). This leads to confusing "Authorization header required" or "401 Unauthorized" API errors despite the key being present in `.env`.

## The Rule
**Always sanitize tokens:** When retrieving an API key or Token from `process.env` to inject into an HTTP header, explicitly append `.trim()` to strip any whitespace or invisible carriage returns.

```typescript
// Incorrect (Unsafe)
const token = process.env.MY_API_TOKEN;

// Correct (Safe)
const token = process.env.MY_API_TOKEN?.trim();
```
