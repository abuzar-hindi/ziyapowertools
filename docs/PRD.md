# LoyaltyOS Product Requirements Document

## Product Vision

LoyaltyOS is a simple, mobile-first digital loyalty and customer-retention system for small local businesses. It replaces a physical stamp card with a trustworthy digital experience that helps businesses reward visits and take practical action to bring customers back.

The first real-world test will be with one local business owned by the developer's brother. The product should solve that business's daily needs while preserving a clear path to support multiple businesses later.

## Problem

Physical loyalty cards are easy to lose, difficult for owners to understand, and provide no useful customer history or follow-up opportunity. Small businesses often lack affordable tools to identify loyal, new, inactive, or reward-eligible customers.

A permanent QR code can also be copied or abused if stamp issuance is trusted to the browser.

## Solution

LoyaltyOS provides:

- One permanent, business-bound QR for customer check-ins; official stamps require admin confirmation.
- Lightweight customer identification using name and phone number.
- Server-controlled stamp and reward calculations.
- A mobile loyalty page showing progress and rewards.
- A practical admin dashboard for customers, visits, settings, and insights.
- Configurable review, social, phone, WhatsApp, and address links.
- Manually triggered WhatsApp contact links for customer re-engagement.

## Target Users

### Primary business user
The owner or manager of a small local business such as a coffee shop, salon, restaurant, or gym. They are not expected to be technical and need clear, action-oriented information.

### Primary customer
A returning local customer who uses a phone to scan a QR code and wants a fast way to collect and redeem loyalty rewards.

### Initial test business
One local business, using a single business account and a simple loyalty program. Multi-business readiness is a data-model principle, not an MVP reason to build complex tenancy controls.

## Customer Journey

1. The customer visits the business.
2. The customer scans a QR code displayed or provided by staff.
3. The customer enters their name and phone number.
4. The backend validates the permanent QR, business, and customer relationship.
5. The customer creates a pending stamp request; official progress does not change.
6. The owner approves or rejects the request.
7. After approval, the backend records one visit and one digital stamp.
8. The customer sees updated progress, such as 4/6.
7. Once the required count is reached, a reward is unlocked.
8. The customer later shows the loyalty page to use the reward.
9. The customer can open the business's Google Review, social, phone, address, or WhatsApp links.

## Admin Journey

1. The owner signs in.
2. They see an overview of recent activity, progress, and rewards.
3. They generate or display a temporary QR session for a visit.
4. They search, filter, and inspect customers.
5. They review visit and stamp history.
6. They identify actionable groups such as inactive customers or customers close to a reward.
7. They open a manually prepared WhatsApp link when follow-up is appropriate.
8. They configure the loyalty program, reward, and business links.

## Core Features

- Admin authentication with JWT.
- Business profile and businessId association.
- Configurable stamps required and reward description.
- Permanent QR generation and backend validation.
- Pending stamp requests with owner approval or rejection.
- Business operating hours, manual shop status, and one featured photo.
- Customer registration/profile using name and phone number.
- Visit and stamp history.
- Reward unlocking and redemption status.
- Mobile customer loyalty page.
- Admin overview, customer list, search, filters, details, and insights.
- Business links: Google Review, Instagram, Facebook, WhatsApp number, phone, address, logo, and name.
- Manual WhatsApp contact links for appropriate customer segments.

## MVP Features

The smallest useful first release includes one business, one loyalty program, one reward configuration, admin login, customer registration, secure temporary QR stamping, progress display, reward unlock/use status, basic customer management, history, business links, and a small set of actionable insight filters.

MVP insights should be understandable and rule-based, including recent activity, new customers, frequent customers, customers close to a reward, and unlocked unused rewards. They should support viewing customers and opening a WhatsApp link, without automated campaigns.

## Future Features

- Multiple businesses with stronger tenant isolation and onboarding.
- OTP or passwordless customer verification.
- PWA installation and offline-friendly shell where appropriate.
- Staff accounts and carefully scoped permissions.
- More configurable loyalty programs and multiple rewards.
- Scheduled reminders and WhatsApp API campaigns with consent controls.
- Advanced reporting and cohort analytics.
- Export tools and integrations.
- Subscription billing for SaaS operation.
- Native mobile applications only if web usage proves insufficient.

## Explicitly Out of Scope for MVP

- Native Android or iOS applications.
- AI chatbot, complex AI analytics, or predictive automation.
- Automated WhatsApp API campaigns.
- Payment or subscription system.
- Complex staff-permission hierarchy.
- Complex analytics and unnecessary third-party libraries.
- Permanent unvalidated QR codes.
- Frontend-controlled stamp, reward, or security decisions.

## Success Criteria

- A customer can receive a valid stamp in under one minute on a typical mobile connection.
- Duplicate, expired, foreign-business, and malformed stamp requests are rejected by the backend.
- A customer can understand current progress and available rewards without instruction.
- An owner can find a customer and see their history quickly.
- An owner can identify an actionable customer group and open a manual WhatsApp contact link.
- Reward unlock and redemption states remain correct after refresh and repeated requests.
- The initial business can use the product during real visits without relying on developer intervention.
- The system is responsive on mobile for customers and usable on desktop for admins.

## Important Product Decisions

- LoyaltyOS is a responsive web application, with PWA readiness later.
- The first release optimizes for one business but associates important business data with businessId.
- Customer identity is lightweight name plus phone initially; stronger verification may come later.
- QR sessions are temporary and validated server-side.
- One valid visit produces at most one stamp for the applicable session/request.
- The backend is authoritative for visits, stamps, rewards, and eligibility.
- Re-engagement begins with human-triggered WhatsApp links, not automated messaging.
- Simplicity and real-world usability take priority over breadth.
