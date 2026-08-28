# Production Configuration

Before starting the server, provide values through the server environment. Never commit a real secret.

- `NODE_ENV=production`
- `PORT`: the server listen port
- `MONGODB_URI`: the production MongoDB connection string
- `JWT_SECRET`: at least 32 random characters
- `JWT_EXPIRES_IN`: admin session lifetime, such as `8h`
- `FRONTEND_ORIGIN`: the exact HTTPS frontend origin, with no wildcard
- `QR_SESSION_TTL_MINUTES`: short-lived QR lifetime between 5 and 1440 minutes
- `CUSTOMER_SESSION_TTL_MINUTES`: customer session lifetime between 5 and 1440 minutes

Serve the built client over HTTPS and keep the API same-origin or configure the exact frontend origin in CORS. Production cookies are HttpOnly, SameSite=Lax, and Secure. The service worker caches only static client assets; stamps, rewards, customer identification, and dashboard data require a live API response.