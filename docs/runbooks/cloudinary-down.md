# Cloudinary down or misconfigured

## Detect
- Admins or users report that uploads fail, or that a signed upload returns an error.
- Lesson or routine media stops loading (the browser shows broken images/videos).
- Logs show "cloudinary lookup failed" or "cloudinary destroy failed".

## First steps
1. Check Cloudinary's status page.
2. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the host. All three must be set, or none. The API refuses to start on a partial set.
3. If the secret was rotated in Cloudinary, update the host and restart. Old signatures stop working on purpose.

## Effects while it is down
- Existing lessons keep their stored URLs. Images may not load until Cloudinary returns.
- New lesson and routine uploads fail with a clear message. Nothing is half-saved in the app.
- Cleanup runs will fail to delete. They keep those files marked and try again next run. No data is lost.

## Confirm it is fixed
- Upload one test image to a test lesson and one to a test routine, then open each media URL.
- Run the cleanup once: npm run cleanup-uploads -w server. The output should show failed 0.
