# LoyaltyOS Architecture

## Architectural Goals

LoyaltyOS is a mobile-first MERN web application. The MVP keeps deployment and tenancy simple while establishing boundaries that can support multiple businesses later.

No implementation code belongs in this document. It defines responsibilities, data ownership, and flows.

## High-Level System Architecture

- Customer frontend: React and Vite, optimized for phone browsers.
- Admin frontend: React and Vite, responsive for desktop and mobile.
- Backend: Node.js and Express.js REST API.
- Database: MongoDB accessed through Mongoose.
- Authentication: JWT for admin initially; lightweight customer identity initially.
- Static/media hosting: deployment decision deferred; logos should use a controlled storage strategy.

The frontends communicate with the backend over HTTPS. The backend validates identity, business scope, QR sessions, visits, stamps, and rewards before writing to MongoDB.

## Frontends

### Customer frontend

The customer experience should have a short registration/identification flow, a loyalty page, progress indicator, reward state, reward usage action, and configured business links. It should not calculate authoritative progress or accept client-provided stamp totals.

### Admin frontend

The admin experience includes authentication, overview, QR session generation, customer search and filters, customer details, history, insights, loyalty settings, reward settings, and business settings. It presents backend results and requests actions; it does not own business rules.

## Backend Responsibilities

Express routes receive validated requests, authenticate them, enforce business scope, apply loyalty rules, and return safe response DTOs. Service-level logic should own QR, visit, stamp, reward, and insight behavior. Controllers should remain thin, and database access should not be duplicated across route handlers.

## Database

Mongoose models should enforce reasonable schema validation, indexes, timestamps, and businessId fields where business-owned data is involved. Database constraints and transactional or idempotent behavior should be used where needed to prevent duplicate stamp effects.

## API Communication

Use versioned REST routes under an `/api` namespace. JSON responses should have predictable success and error shapes. Frontend requests must handle loading, empty, validation, authentication, and server-error states. HTTPS is required outside local development.

## Authentication and Authorization

Admin login issues a JWT containing an admin identity and business scope. Protected admin routes validate the token and confirm the requested businessId is authorized; a client-supplied businessId must never expand access.

Customers initially use a lightweight identity flow based on name and phone number and may receive a short-lived customer session/token if needed. The design must leave room for OTP later. Sensitive customer data should be minimized in tokens and responses.

## QR Session Flow

1. An authorized admin requests a QR session for their business.
2. The backend creates a cryptographically unpredictable, short-lived session/token with businessId, status, timestamps, and intended use rules.
3. The admin UI displays the QR payload or URL.
4. The customer scans it and submits identification plus the session reference.
5. The backend verifies existence, signature or token validity, expiration, business ownership, status, and use limits.
6. The backend resolves the customer/business relationship and applies stamp rules.
7. The session is marked used, consumed, or otherwise recorded according to the chosen idempotency policy.

A permanent QR code must not be the authority for issuing stamps.

## Stamp Flow

The backend receives a validated QR session and customer identity. It checks that the operation is valid, prevents duplicate effects, records a visit and stamp history event, updates or derives progress, and evaluates reward unlock rules. The response returns authoritative current progress and reward state.

The frontend may display a requested action but cannot choose the number of stamps, customer, business, or reward status without backend verification.

## Reward Flow

A reward is unlocked when authoritative stamp progress reaches the configured requirement. Unlocking should be represented as durable state or a durable event. The customer can display an unlocked reward, and an authorized redemption action changes it to used with timestamp and actor/context. Redemption must be idempotent and cannot be performed for another business or for an already-used reward.

## Customer Insights Flow

The backend computes simple, explainable segments from visit, stamp, customer, and reward data. Examples include inactive recently, recently active, new, frequent, close to reward, and unlocked unused rewards. Filters should return customer identifiers and useful summary fields, plus enough context for an owner to decide whether to follow up. WhatsApp links are generated from configured data and should be manually triggered.

## Expected MongoDB Collections / Models

- `Business`: name, logo, address, contact/social links, settings, and timestamps.
- `AdminUser`: businessId, login identity, password hash or auth metadata, status, and timestamps.
- `Customer`: businessId, name, normalized phone, display phone, activity summaries, and timestamps.
- `LoyaltyProgram`: businessId, stamps required, active status, and timestamps.
- `Reward`: businessId, loyalty program reference, description, status/configuration, and timestamps.
- `QrSession`: businessId, hashed token or secure token metadata, expiration, status, creator, and usage metadata.
- `Visit`: businessId, customerId, QR session reference, occurredAt, and idempotency metadata.
- `StampEvent`: businessId, customerId, visitId, quantity, source, and createdAt.
- `CustomerReward`: businessId, customerId, rewardId, unlockedAt, redeemedAt, status, and timestamps.

A simpler MVP may combine some configuration models, but business-owned records should retain businessId and the model boundaries should remain clear.

## Important Relationships

- One Business has many AdminUsers, Customers, QrSessions, Visits, StampEvents, Programs, Rewards, and CustomerRewards.
- A Customer belongs to one Business in the MVP data model; future SaaS may allow carefully modeled cross-business identity.
- A Visit belongs to one Business and Customer and may reference one QR session.
- A StampEvent belongs to one Visit and Customer.
- A CustomerReward belongs to one Business, Customer, and Reward.
- Program and reward settings determine future calculations, while history remains auditable.

## Suggested API Route Structure

- `POST /api/auth/login`
- `POST /api/auth/refresh` (if refresh tokens are adopted)
- `GET /api/business`
- `PATCH /api/business`
- `GET /api/loyalty-program`
- `PATCH /api/loyalty-program`
- `GET /api/reward-settings`
- `PATCH /api/reward-settings`
- `POST /api/qr-sessions`
- `GET /api/qr-sessions/:token`
- `POST /api/stamps`
- `POST /api/rewards/:customerRewardId/redeem`
- `POST /api/customers/identify`
- `GET /api/customers`
- `GET /api/customers/:customerId`
- `GET /api/customers/:customerId/history`
- `GET /api/insights`
- `GET /api/dashboard/overview`

Exact route names may evolve, but authorization and business scope must remain consistent.

## Security Considerations

- Use HTTPS in deployed environments and secure, appropriately scoped token storage.
- Hash admin passwords and QR tokens where practical; never log raw secrets.
- Use strong random QR session values and short expiration windows.
- Validate all request bodies, query parameters, route parameters, and URLs.
- Enforce business ownership on every business-scoped read and write.
- Prevent replay, duplicate stamps, race-condition double writes, and reward double redemption.
- Apply rate limiting and abuse monitoring to identification, login, QR, and stamp endpoints.
- Normalize phone numbers for matching while preserving a safe display form.
- Avoid exposing unnecessary customer data in lists, logs, and tokens.
- Keep secrets in environment variables and use safe error responses.
- Add audit-friendly timestamps and actor/source metadata to important events.

## Future Multi-Tenant Architecture

Each request will resolve an authenticated business context, and every business-owned query will scope by that context. Future onboarding, billing, staff roles, stronger isolation, per-business configuration, and operational monitoring can be added without rewriting core loyalty records. The MVP should avoid premature tenant infrastructure while never omitting businessId from important data.
