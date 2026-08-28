# LoyaltyOS Development Phases

Each phase should be independently testable. Do not begin a phase until its dependencies are complete and do not silently pull future scope into it.

## Phase 0 - Project Documentation and Setup

**Goal:** Establish the source of truth and local development expectations.

**Build:** The six planning documents, repository conventions, environment variable plan, and basic setup decisions.

**Not build:** React frontend, Express backend, database code, or application features.

**Dependencies:** None.

**Completion criteria:** All six docs exist, agree with one another, and the initial objective is recorded in memory.

**Testing:** Verify file structure and review documents for scope conflicts.

## Phase 1 - MERN Project Foundation

**Goal:** Create the Vite React frontend and Node/Express backend foundation.

**Build:** Project scripts, Tailwind CSS, API bootstrap, environment loading, health endpoint, and development proxy/configuration.

**Not build:** Business features, authentication, or database behavior.

**Dependencies:** Phase 0.

**Completion criteria:** Frontend and backend start locally; health check works; no secrets are committed.

**Testing:** Build frontend, run backend health test, and verify environment validation.

## Phase 2 - Database and Models

**Goal:** Connect MongoDB and establish validated core models.

**Build:** Mongoose connection, Business, AdminUser, Customer, loyalty/reward configuration, QR, visit, stamp, and customer reward models as needed.

**Not build:** Complete user workflows or analytics.

**Dependencies:** Phase 1.

**Completion criteria:** Connection lifecycle works and schemas/indexes represent documented relationships.

**Testing:** Connection test, model validation tests, index review, and isolation query tests.

## Phase 3 - Admin Authentication

**Goal:** Secure the owner dashboard.

**Build:** Admin login, password hashing, JWT issuance/validation, protected route middleware, and safe auth errors.

**Not build:** Staff roles, billing, OTP, or customer authentication automation.

**Dependencies:** Phases 1-2.

**Completion criteria:** Authorized admin access works and unauthorized/invalid access is rejected.

**Testing:** Login success/failure, token expiry, protected routes, and secret-handling tests.

## Phase 4 - Business Setup

**Goal:** Make the first business configurable.

**Build:** Business profile, logo strategy, contact/social links, loyalty program settings, and reward settings.

**Not build:** Multi-business onboarding or subscription management.

**Dependencies:** Phases 2-3.

**Completion criteria:** Admin can view/update valid settings within their business scope.

**Testing:** Validation, authorization, URL handling, and persistence tests.

## Phase 5 - Customer Registration/Profile

**Goal:** Identify customers with minimal friction.

**Build:** Customer identification/creation using name and normalized phone, business association, and profile retrieval.

**Not build:** Mandatory OTP or a full customer account system.

**Dependencies:** Phases 2 and 4.

**Completion criteria:** Repeat visits resolve to the correct customer within the correct business.

**Testing:** Normalization, duplicate handling, validation, privacy, and cross-business tests.

## Phase 6 - QR Session Generation and Validation

**Goal:** Prevent abuse of stamp issuance.

**Build:** Short-lived QR session creation, display payload, expiration, ownership, status, replay/idempotency policy, and validation endpoint/service.

**Not build:** Permanent QR authority or advanced fraud scoring.

**Dependencies:** Phases 2-5.

**Completion criteria:** Only valid, current, correctly scoped sessions can proceed.

**Testing:** Expired, missing, replayed, malformed, foreign-business, and concurrent requests.

## Phase 7 - Stamp System

**Goal:** Record one legitimate visit and stamp.

**Build:** Backend stamp command, visit and stamp history, duplicate prevention, and authoritative progress response.

**Not build:** Customer-facing polish or advanced reporting.

**Dependencies:** Phases 5-6.

**Completion criteria:** A valid flow creates the correct records exactly once.

**Testing:** Happy path, retries, concurrency, invalid identity, unauthorized scope, and audit fields.

## Phase 8 - Loyalty/Reward System

**Goal:** Unlock and track rewards reliably.

**Build:** Requirement calculation, unlock state, reward display data, redemption action, and idempotent redemption.

**Not build:** Multiple complex reward campaigns or payments.

**Dependencies:** Phase 7.

**Completion criteria:** Required stamps unlock the configured reward and used rewards cannot be reused.

**Testing:** Boundary counts, refresh/retry behavior, redemption authorization, and state transitions.

## Phase 9 - Customer Loyalty Interface

**Goal:** Give customers a fast mobile loyalty experience.

**Build:** Scan/identify flow, progress, reward state, basic history/status, and business links.

**Not build:** Native apps, offline stamping, or marketing landing pages.

**Dependencies:** Phases 4-8.

**Completion criteria:** A customer can complete the journey on a phone without staff explaining the interface.

**Testing:** Responsive behavior, accessibility, loading/errors, and end-to-end happy path.

## Phase 10 - Admin Dashboard

**Goal:** Make daily operations visible and actionable.

**Build:** Overview, QR generation action, activity summaries, and navigation to management areas.

**Not build:** Complex analytics or staff workspaces.

**Dependencies:** Phases 3-8.

**Completion criteria:** Owner can understand current activity and start a valid stamp flow.

**Testing:** Protected navigation, responsive layouts, empty states, and API failure states.

## Phase 11 - Customer Management

**Goal:** Let owners find and understand customers.

**Build:** List, search, filters, details, visit history, and stamp history.

**Not build:** Bulk messaging automation or exports unless required for MVP validation.

**Dependencies:** Phases 7 and 10.

**Completion criteria:** Owner can locate a customer and inspect trustworthy history.

**Testing:** Search/filter correctness, pagination if used, authorization, and mobile usability.

## Phase 12 - Customer Insights and Filters

**Goal:** Turn activity data into useful follow-up groups.

**Build:** Rule-based new, regular, frequent, recent, inactive, close-to-reward, and unused-reward segments.

**Not build:** AI predictions, complex cohort analytics, or automated actions.

**Dependencies:** Phases 8 and 11.

**Completion criteria:** Each segment is explainable and leads to a customer list/action.

**Testing:** Boundary dates, empty groups, segment membership, performance, and authorization.

## Phase 13 - Google/Social/WhatsApp Links

**Goal:** Make configured business contact and review channels useful.

**Build:** Admin configuration and safe customer-facing links, including manual WhatsApp initiation.

**Not build:** WhatsApp API automation or scheduled campaigns.

**Dependencies:** Phases 4, 9, and 12.

**Completion criteria:** Valid configured links work on mobile and absent links are handled cleanly.

**Testing:** URL/phone validation, encoding, permission, and responsive behavior.

## Phase 14 - Security and Validation

**Goal:** Harden the complete MVP.

**Build:** Rate limiting, authorization audit, input validation review, replay/concurrency protections, safe logging, headers, and privacy review.

**Not build:** Enterprise compliance program or advanced fraud platform.

**Dependencies:** Phases 1-13.

**Completion criteria:** Security checklist passes and known abuse cases are addressed.

**Testing:** Negative API tests, dependency audit, authorization matrix, and manual threat review.

## Phase 15 - Testing

**Goal:** Establish confidence before real-world use.

**Build:** Unit, integration, API, frontend, responsive, and end-to-end coverage for critical journeys.

**Not build:** Broad testing of postponed features.

**Dependencies:** Phase 14.

**Completion criteria:** Critical flows pass reliably with documented test commands and fixtures.

**Testing:** Run the complete agreed test suite and record remaining gaps.

## Phase 16 - Deployment

**Goal:** Make the MVP available in a controlled environment.

**Build:** Hosting, MongoDB deployment, environment secrets, HTTPS, logging, backups, monitoring, and rollback procedure.

**Not build:** SaaS billing or broad tenant onboarding.

**Dependencies:** Phase 15.

**Completion criteria:** Production smoke tests pass and operational recovery steps are documented.

**Testing:** Deployment smoke test, health check, auth, QR, stamp, reward, and backup verification.

## Phase 17 - Real-World Testing with the First Business

**Goal:** Validate LoyaltyOS during actual business visits.

**Build:** Onboarding, staff instructions, observation, issue capture, and small usability refinements.

**Not build:** Large feature expansion based on one anecdote.

**Dependencies:** Phase 16.

**Completion criteria:** The first business can operate the core flow and provide evidence for prioritized improvements.

**Testing:** Real-device customer flow, owner workflows, abuse/retry scenarios, and feedback review.
