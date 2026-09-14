# Fetch API Error Handling
When writing or modifying `fetch` requests (especially in Node.js backend controllers), ALWAYS verify that the response is successful.

1. Check `if (!response.ok)`.
2. If it fails, extract the error payload using `await response.text()` or `await response.json()`.
3. Throw or log a detailed error containing the HTTP status code, status text, and the error payload to prevent silent failures.
