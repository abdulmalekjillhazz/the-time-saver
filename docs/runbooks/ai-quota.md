# Server AI features unavailable or over quota

Server-side AI is used by routine suggestions, adaptive replanning, generated lessons, voice briefings, and other configured coaching features. Most requests using the shared provider try Gemini first and Groq as a fallback when both are configured; some generation paths require Gemini directly.

## First steps
1. Check Google Cloud billing and Gemini quota. Check Groq usage too if the fallback provider is enabled.
2. Verify `GEMINI_API_KEY` and, when used, `GROQ_API_KEY` in `server/.env` or the deployment environment. Keep keys server-side and out of source control.
3. Review server logs for the route and provider error. Do not log or share API keys.
4. Confirm whether the affected feature uses the shared Gemini/Groq provider or a Gemini-only endpoint before changing configuration.

## Confirm it is fixed
- Retry the affected feature and verify it returns a usable response.
- Confirm provider usage stays within the configured budget and quotas.

## Do not
- Do not raise provider limits or add another key until the cause of the quota spike is understood.
- Do not put provider keys in client-side environment variables or source code.
