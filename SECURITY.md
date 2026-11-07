# Security

Please report vulnerabilities privately through [GitHub's private vulnerability reporting](../../security/advisories/new) instead of opening a public issue. Include the steps to reproduce and the impact you expect. You will get an answer within a few days.

## How localxpo protects your data

- Builds run on your own machines; source code and binaries never reach the dashboard.
- Store credentials (App Store Connect keys, Google service accounts, Android keystores) are encrypted with AES-256-GCM using `LOCALXPO_SECRET`. Owners can always download them; members only while one of their own builds or uploads is running in that project.
- Passwords are hashed with scrypt; session cookies and API tokens are stored as SHA-256 hashes.
- Failed sign-ins are rate limited per email and per IP.
- Log lines are redacted on the build machine before they are sent.

## Running your own server

- Set `LOCALXPO_SECRET` (32+ random characters) and back it up: without it, saved store keys can't be decrypted.
- Serve the dashboard over HTTPS and set `NEXT_PUBLIC_APP_URL` to its public address.
- Set `LOCALXPO_DISABLE_SIGNUP=1` once your team has registered if the server is reachable from the internet.
