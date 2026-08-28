# LoyaltyOS AI Coding Rules

These rules apply to every future implementation change.

## Source of Truth

1. Read `PRD.md`, `ARCHITECTURE.md`, `RULES.md`, `PHASES.md`, `DESIGN.md`, and `MEMORY.md` before making changes.
2. Follow the product requirements and architecture unless an explicit decision changes them.
3. Work phase-by-phase and update `MEMORY.md` after completing a phase.
4. Do not implement future features unless explicitly requested.
5. Before a large architectural change, explain the reason, impact, and proposed approach.

## Scope and Maintainability

- Modify only files relevant to the requested task.
- Do not rewrite working code without a concrete reason.
- Prefer the existing project patterns and APIs.
- Do not introduce a dependency without explaining why it is needed and checking whether existing tools suffice.
- Keep components, routes, services, and models maintainable and appropriately sized.
- Avoid unnecessary abstractions and premature generalization.
- Keep names clear and business terminology consistent with the docs.

## Business Logic and Security

- Keep authoritative business logic in the backend.
- Never trust frontend values for stamps, rewards, customer identity, business scope, or security-sensitive operations.
- Validate and sanitize all backend input, including query and route parameters.
- Enforce business ownership on every business-scoped operation.
- Use temporary validated QR sessions; never make a permanent QR code the stamp authority.
- Prevent replay, duplicate stamps, double redemption, and race-condition side effects.
- Use environment variables for secrets and configuration that differs by environment.
- Never expose secrets, private keys, password hashes, raw tokens, or API keys.
- Return safe, useful errors without leaking implementation details.
- Minimize customer data in logs, tokens, and API responses.

## Product Scope

- Preserve the MVP principle: build the smallest useful real-world product first.
- Do not add native apps, AI features, automated WhatsApp campaigns, billing, complex staff permissions, or complex analytics without explicit approval.
- Keep customer flows fast and understandable for mobile users.
- Keep admin workflows practical and action-oriented for non-technical owners.

## UI and UX

- Follow `DESIGN.md` for visual and interaction decisions.
- Use responsive, mobile-first layouts for customer flows.
- Provide loading, empty, validation, success, and error states.
- Keep labels understandable to business owners; avoid developer terminology.
- Avoid visual clutter, excessive animation, excessive rounded cards, and generic SaaS patterns.
- Do not sacrifice accessibility for appearance.

## Testing and Delivery

- Test the affected functionality after implementation.
- Add focused tests for security-sensitive and business-rule changes.
- Check duplicate requests, invalid input, unauthorized business access, expired QR sessions, and reward state transitions where relevant.
- Run the narrowest useful test first, then the relevant broader checks.
- Do not mark a phase complete until its completion criteria and testing requirements are met.
- Record completed work, decisions, issues, and the next task in `MEMORY.md`.
