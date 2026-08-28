# LoyaltyOS Design Direction

## Design Intent

LoyaltyOS should feel simple, modern, warm, trustworthy, friendly, and practical. It is a working tool for local relationships, not a technology showcase. Every screen should help a customer understand their progress or help an owner decide what to do next.

## Visual Principles

- Use a warm, welcoming visual direction with enough contrast to feel dependable.
- Prefer a restrained palette with one recognizable brand accent, neutral surfaces, and semantic success/warning/error colors.
- Do not lock exact colors before the first real business identity is known; preserve contrast and accessibility when iterating.
- Avoid excessive gradients, glassmorphism, decorative blobs, visual noise, and generic AI-generated SaaS styling.
- Use whitespace to establish hierarchy rather than filling every area.
- Avoid huge marketing heroes inside the application.

## Typography

Choose a readable, distinctive sans-serif family with strong mobile legibility and useful weights. Use a clear type scale: compact labels, comfortable body text, and restrained headings. Keep line lengths short on customer screens and do not use decorative typography where it reduces clarity.

## Spacing and Layout

Use a consistent spacing scale and generous touch targets. Customer pages should prioritize a single obvious next action. Admin pages may use denser layouts but must retain clear grouping, predictable alignment, and comfortable scanning. Use responsive constraints instead of fixed desktop assumptions.

## Buttons

Buttons should have clear verbs and obvious states: default, hover, focus, disabled, loading, and success/error feedback. Use a filled primary button for the main action, quieter secondary actions, and destructive styling only for genuinely destructive actions. Icon buttons are appropriate for familiar tool actions and should have accessible labels/tooltips.

## Cards

Use cards only to frame genuinely related information such as a loyalty progress panel, reward, customer summary, or insight result. Keep corners modest, borders/subtle elevation restrained, and avoid nesting cards inside cards. Do not turn every section into a floating panel.

## Forms

Forms should ask only for information needed at that moment. Labels remain visible, validation is specific and close to the field, and error messages explain how to recover. Phone fields should support normalized storage and familiar entry. Preserve entered values after recoverable errors.

## Navigation

Customer navigation should be minimal, with the loyalty status as the primary destination. Business links can sit in a clear contact area. Admin navigation should group Overview, QR/stamps, Customers, Insights, and Settings. On mobile, use a compact menu or bottom navigation only when it remains easy to scan and reach.

## Status Indicators

Use text plus color or icon so status is never color-only. Progress should communicate both current count and requirement, such as 4/6. Reward states should be unmistakable: in progress, unlocked, redeemed, or unavailable. Error and success feedback should be timely and non-blocking when possible.

## Tables and Lists

Admin lists should favor useful columns and actions over exhaustive data. On small screens, convert rows into readable stacked summaries or allow deliberate horizontal scrolling; never compress text until it becomes unreadable. Search and filters should preserve context and show empty states that explain what happened.

## Mobile Behavior

The customer experience is mobile-first and should work comfortably with one hand, on variable connections, and without staff instruction. Keep the QR-to-stamp path short. Use stable dimensions for progress indicators, buttons, QR displays, and loading states so content does not jump. Admin screens must remain functional on mobile, even if desktop is the primary owner workspace.

## Customer Loyalty Card

The loyalty card is the visual center of the customer experience. It should show the business identity, current progress, next reward, and clear state when a reward is unlocked. Use a calm visual hierarchy, an obvious stamp count, and a single primary action. It should feel like a digital replacement for the familiar physical card without pretending to be a game.

## Admin Dashboard

The dashboard should answer three questions quickly: what happened recently, which customers need attention, and what action can the owner take now? Lead with concise activity and reward summaries, then provide direct paths to generate a QR session, search customers, and open actionable insight groups. Avoid vanity metrics and dense charts that do not lead to a decision.

## Customer Insights

Insights should be presented as understandable groups with plain-language labels, counts, a short explanation of the rule, and a next action. Examples include "Has not visited recently", "Close to a reward", and "Reward unused". A group should lead to customer details or a manually triggered WhatsApp link, not merely display a number.

## Accessibility and Trust

Maintain strong contrast, visible keyboard focus, semantic headings, accessible labels, and touch targets appropriate for phones. Do not hide important information in color, animation, hover-only interactions, or technical terminology. Confirm meaningful actions and make reward status auditable to the customer and owner.

## Motion

Use little motion and give it a purpose: a subtle confirmation after a stamp or reward unlock, and restrained transitions between states. Avoid looping animation, delayed access to primary actions, and motion that makes a practical workflow feel slower.

## Iteration Principle

The design system should evolve with the first business's branding and real customer feedback. Preserve the principles in this document while allowing measured changes to color, typography, density, and content hierarchy when evidence shows they improve comprehension or trust.
