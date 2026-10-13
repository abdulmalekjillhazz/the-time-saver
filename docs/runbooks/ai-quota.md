# Gemini routine assistant unavailable or over quota

Submitting a question sends it and up to 30 routine summaries (titles, times, completion status, estimated risk, and the most-important-task marker) to the authenticated server. The server tries Gemini first, then Groq when configured. If both providers fail, the client falls back to local keyword matching. The current route has no separate AI-provider consent gate and does not persist assistant prompts in the app database; avoid entering sensitive information.

## Detect
- The assistant returns "unavailable", or the per-user request limit is reached.
- Google Cloud billing shows a sudden increase.

## First steps
1. Check Google Cloud billing and quota. Look for a spike in requests.
2. Check that the server-side `GEMINI_API_KEY` is configured and valid. Never put it in client environment variables or source control.
3. Check for abuse: many requests from one user or one IP. Block that user with a role change or a session revoke, not by deleting data.

## Confirm it is fixed
- The assistant answers a test request. The per-user rate limit still applies.
- The monthly spend is under the cap.

## Do not
- Do not raise the cap without knowing the cause of the spike.
