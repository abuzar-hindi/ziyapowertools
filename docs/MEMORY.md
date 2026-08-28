# LoyaltyOS Project Memory

## Project Name

LoyaltyOS

## Current Objective

Create the MERN project foundation, validated database layer, secure admin authentication, business configuration, and lightweight customer registration for a production-quality digital loyalty and customer-retention web application for small local businesses.

## Current Phase

Permanent QR and pending stamp approval architecture implemented; shop status and single featured photo added

## Completed Work

- Defined the product vision, problem, users, journeys, MVP, future scope, and success criteria.
- Defined the high-level MERN architecture, core flows, data relationships, routes, and security principles.
- Defined AI coding-agent rules.
- Defined independently testable development phases from foundation through first-business testing.
- Defined the visual and UX direction for customer and admin experiences.
- Created a Vite + React client with Tailwind CSS and a minimal foundation screen.
- Created an Express server with environment loading and `GET /api/health`.
- Configured the Vite development proxy to forward `/api` requests to the local server.
- Added frontend and backend environment examples and repository secret exclusions.
- Verified frontend startup, backend startup, direct health, proxied health, build, lint, and secret checks.
- Created Business, AdminUser, Customer, LoyaltyProgram, Reward, QrSession, Visit, StampEvent, and CustomerReward models.
- Added business ownership references, timestamps, validation, and useful query indexes.
- Verified required fields, enum/status values, phone normalization, customer uniqueness, cross-business isolation, references, indexes, and connection failure behavior.
- Added admin login, logout, current-session verification, JWT middleware, trusted business-scope middleware, bcrypt password hashing, and a minimal protected admin shell.
- Added HttpOnly cookie session handling, configured CORS, Helmet security headers, request body limits, login rate limiting, and safe error responses.
- Verified authentication and database tests: 17 passed.
- Added authenticated business profile GET/PATCH settings for name, URL-based logo, address, phone, WhatsApp, social links, and Google Review URL.
- Added authenticated single-program loyalty settings with active state and positive stamp requirement.
- Added authenticated single-reward settings with description and active/inactive state.
- Added responsive admin settings UI with loading, validation, save success, and save failure states.
- Verified all Phase 2, Phase 3, and Phase 4 backend tests: 23 passed; frontend lint and production build passed.
- Added the local-only `npm run setup:admin` CLI for first Business/AdminUser creation.
- The setup CLI prompts for business name, admin email, password, and confirmation, validates input, hashes with the existing bcrypt utility, and blocks setup when an admin already exists.
- Setup never prints or stores plaintext passwords or password hashes in output; failed admin creation removes the newly created business.
- Verified the complete backend test suite: 26 passed, including setup validation, hashing, duplicate prevention, and secret non-disclosure tests.
- Added public customer identification through `POST /api/customers/identify` using a server-configured pre-QR business context.
- Added business-scoped customer profile retrieval for authenticated admins through `GET /api/customers/:customerId`.
- Customer identification uses name plus phone, normalizes phone numbers, upserts by `(businessId, normalizedPhone)`, and returns only safe profile fields.
- Added the mobile-first `/customer` registration screen with client feedback for loading, validation, success, and server errors.
- Diagnosed the browser login `Request failed` issue: the local API lacked `JWT_SECRET`, causing a backend 500 during token creation. The API was verified with a generated in-process development secret; no secret was stored or printed.
- Improved frontend network errors to report when the API is unreachable instead of showing a misleading generic failure.
- Browser-verified admin valid login, invalid login, protected shell, customer valid registration, and customer invalid phone feedback.
- Verified the complete backend suite: 32 passed; frontend lint and production build passed.
- Added authenticated temporary QR session generation with cryptographically random tokens, hashed storage, QR image payloads, expiration, revocation-aware validation, and validation rate limiting.
- Connected customer identification to validated QR context and removed the obsolete environment-only customer context middleware.
- Added short-lived opaque customer sessions stored as hashed tokens in HttpOnly cookies, scoped by business and customer.
- Added customer session `/me` verification and QR-gated customer browser flow.
- Browser-verified admin login, QR generation and expiration display, valid QR customer registration, customer session access, and invalid QR friendly messaging.
- Verified the complete Phase 2 through Phase 6 backend suite: 38 passed; frontend lint and production build passed.
- Added backend-authoritative reward unlocking at the configured stamp threshold, cycle-aware reward records, atomic redemption, reset-on-redemption progress, and strict customer/business authorization.
- Added admin customer list, search, filters, pagination, customer history, and explainable insight summary endpoints.
- Added the responsive customer loyalty card with persistent session restore, stamp progress, reward display/redemption, and configured phone, WhatsApp, and review links.
- Added the admin overview and customer management screens with actionable reward-ready status and manual WhatsApp links.
- Verified the complete backend suite: 51 passed; frontend lint and production build passed.
- Added safe customer-facing business engagement data for Google Reviews, Instagram, Facebook, WhatsApp, phone, address, logo, and business name; missing links remain empty and are hidden by the UI.
- Preserved server-side HTTP(S) URL and phone validation, admin authorization, business isolation, and minimal public business DTOs.
- Added authenticated `/api/dashboard` analytics with today, last-7-days, and last-30-days periods; metrics include customers, new/active/inactive customers, visits, visits today, stamps today, reward states, and close-to-reward customers.
- Added bounded recent activity, top customers, inactive/almost-reward segments, segment pagination, ObjectId-safe aggregations, and query indexes for dashboard date/status access.
- Connected the existing admin shell to the dashboard period selector, metric display, recent activity, and top-customer lists without a visual redesign.
- Added focused dashboard and engagement tests, then verified the complete backend suite: 55 passed; frontend lint and production build passed.
- Browser-verified admin login, dashboard metrics/activity/top customer data, QR generation, customer identification, one stamp, and all configured customer engagement links.
- Final acceptance browser verification used isolated temporary fixtures: configured links resolved to the expected `tel:`, `wa.me`, review, Instagram, and Facebook destinations; an empty-links business rendered no broken anchors; QR identification reached 6/6, displayed the unlocked reward, and successfully redeemed it.
- Fixed the customer data-flow gap where a successful stamp did not refresh the rewards list, so newly unlocked rewards now appear immediately.
- Final backend acceptance run after the fix: 55 passed, 0 failed; frontend lint and production build passed.
- Added the Phase 13 installable web app manifest, LoyaltyOS app metadata, theme configuration, and 192/512 SVG icons.
- Added a production-only service worker that caches only the static application shell and never caches API responses or presents stale loyalty data as authoritative.
- Added explicit customer offline state handling: identification, stamping, and redemption are blocked offline with clear connection messaging and server-confirmed state remains authoritative.
- Added throttling to public customer identification and a regression test for the limit.
- Added production configuration documentation covering HTTPS, exact frontend origin, MongoDB, JWT secret, session lifetimes, cookie behavior, and API trust boundaries.
- Final Phase 13-14 browser acceptance verified QR to identification to loyalty card to stamp to reward unlock to redemption and new-cycle reset, admin login/dashboard/customers/search/filters/settings/QR, configured engagement links, logout, unauthorized access, mobile layout at 390x844, no horizontal overflow, and offline safeguards.
- Final backend suite after hardening: 56 passed, 0 failed; frontend lint and production build passed.
- Replaced customer use of temporary QR sessions for stamping with one deterministic, signed permanent business QR. Temporary session routes remain available for compatibility but permanent QR stamping requires approval.
- Added business-scoped `StampRequest` records with pending, approved, and rejected states, one pending request per customer/business/day, customer status polling, and admin approve/reject actions. Official `Visit`, `StampEvent`, progress, and rewards are created only after approval.
- Added timezone-aware shop status with scheduled operating days/times and explicit manual open/closed overrides.
- Added one business-scoped `FeaturedPhoto` stored in MongoDB with MIME, size, dimension, landscape validation and explicit replacement confirmation in the admin UI.
- Added live customer shop status/photo integration, admin pending queue, permanent QR screen, and focused pending/shop/photo test coverage.
- Final backend suite after architecture migration: 62 passed, 0 failed; frontend production build passed. Frontend lint has two non-blocking React effect-style warnings in the existing single-file client.

## Current Work

Final acceptance validation is complete. Phases 13 and 14 are implemented; no later development phase has been started.

## Next Task

Deployment and operational setup remain, using the production configuration documented in `docs/PRODUCTION.md`. Photo storage is intentionally MongoDB-backed for this small deployment; move to managed object storage before large-scale use.

## Important Decisions

- The product is a responsive web application, not a native mobile application.
- The first real-world test targets one local business owned by the developer's brother.
- MVP scope prioritizes the smallest useful real-world product.
- One signed permanent QR identifies the business; customer stamp requests require later admin approval.
- Backend logic is authoritative for identity scope, visits, stamps, rewards, and redemption.
- Customer identification starts with name and phone number; OTP is deferred.
- Manual WhatsApp links are in scope for re-engagement; automated WhatsApp API campaigns are deferred.
- Important business-owned data will include businessId for future SaaS readiness without over-engineering MVP tenancy.
- The local frontend runs on Vite's default port 5173 and proxies `/api` to the Express server on port 5000.
- Tailwind CSS uses its Vite plugin and CSS import integration.
- The backend currently exposes only the health route; database and business behavior are intentionally absent.
- MongoDB connections use Mongoose through one reusable connection module, with startup connection, timeout handling, missing-URI failure, and graceful shutdown.
- Phase 2 uses Mongoose 9 and Node's built-in test runner; database tests run against the configured MongoDB instance from `MONGODB_URI`.
- Customer uniqueness is enforced by the compound index `(businessId, normalizedPhone)`.
- Visit and stamp records retain dates and references needed for the future one-stamp-per-calendar-day rule; that rule is not implemented yet.
- Admin JWTs contain only `sub`, `businessId`, `type`, and standard token metadata; passwords and sensitive records are excluded.
- Admin JWTs are stored in an HttpOnly, SameSite=Lax cookie; production cookies are Secure. The frontend never reads or stores the token.
- Login is limited to 10 requests per IP per 15 minutes using in-process rate limiting; distributed rate limiting is postponed.
- CORS allows the configured `FRONTEND_ORIGIN` with credentials and rejects other browser origins.
- Business settings always query by the authenticated admin's trusted businessId; client-supplied businessId is rejected by scope middleware.
- MVP business logos use validated HTTP/HTTPS URLs; no media-storage platform was added.
- The MVP has one loyalty program and one reward per business, enforced by unique businessId indexes.
- Business profile updates validate URLs, phone formats, allowed fields, and Mongoose schema constraints; database errors are not exposed to clients.
- Initial admin/business setup is intentionally a local CLI process, not public signup; use it only before the first admin exists.
- Customer registration is not customer authentication: there are no customer passwords, JWTs, OTPs, or accounts.
- Customer registration derives business context from a validated permanent QR or legacy temporary QR; browser-supplied businessId is ignored and does not expand scope.
- Customer API responses expose only a safe ID, name, display phone, and timestamps; normalized phone and businessId are not returned to the customer browser.
- Customer profile reads are admin-authenticated and scoped by the trusted admin businessId.
- Legacy temporary QR tokens use 32 random bytes encoded as base64url, are stored only as SHA-256 hashes, and expire after 15 minutes by default. Permanent QR tokens are HMAC-signed from businessId and JWT_SECRET and do not expire.
- QR validation returns only the business display context needed by the customer flow; raw tokens are returned only inside the admin-generated customer URL/QR payload.
- Customer sessions use 32 random bytes encoded as base64url, SHA-256 hash storage, HttpOnly SameSite cookies, and a 30-minute default expiration.
- Customer identification requires a valid permanent or active temporary QR and derives businessId server-side; it does not issue official stamps or visits.

## Known Issues

- Deployment target and production credentials do not exist yet.
- Browser verification used a temporary local demo business/admin fixture; production-like credentials and deployment configuration are still pending.
- The first business's branding, logo, exact loyalty terms, and contact links have not yet been supplied.
- JWT secret and frontend origin must be supplied through deployment environment variables; no real values belong in the repository.
- QR session TTL defaults to 15 minutes and customer session TTL defaults to 30 minutes; both are configurable through environment variables.

## Technical Decisions

- Frontend: React, Vite, and Tailwind CSS.
- Backend: Node.js and Express.js.
- Database: MongoDB and Mongoose.
- Initial authentication: JWT for admins, lightweight customer identity.
- Deployment choice is postponed until the application foundation and real-world constraints are clearer.
- Node.js 22.19.0 and npm 10.8.3 were used for the initial scaffold.
- Password hashing uses bcryptjs with 12 salt rounds.
- Authentication tests use Supertest and Node's built-in test runner; test files run serially because they share the MongoDB integration connection and in-process rate limiter.

## Design Decisions

- Mobile-first customer experience focused on loyalty progress and rewards.
- Desktop-capable, responsive admin dashboard focused on actions and scanning.
- Warm, modern, trustworthy, friendly, practical visual direction.
- Restrained palette and motion; avoid generic SaaS visuals, excessive gradients, glassmorphism, rounded cards, and clutter.
- Design principles remain flexible so the first business identity and user feedback can guide iteration.

## Things Explicitly Postponed

- Native Android and iOS apps.
- AI chatbot and complex AI analytics.
- Automated WhatsApp API campaigns.
- Payment/subscription system.
- Complex staff-permission hierarchy.
- Overly complex analytics.
- Multi-business onboarding and enterprise tenancy infrastructure.
- OTP customer authentication.
- Phase 13 PWA/mobile experience is complete; offline operations remain intentionally unsupported.
- Phase 14 security hardening is complete; deployment credentials and hosting remain environment-specific.
- Complex analytics, automated messaging, and future campaigns remain postponed.
