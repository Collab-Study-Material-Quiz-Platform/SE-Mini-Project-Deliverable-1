# Availability target (CSQ-NF-003)

## Requirement
The service target is at least 99% availability in a calendar month, excluding planned maintenance of up to four hours announced at least 24 hours in advance.

## Health endpoints
- `GET /api/health` is the primary health endpoint.
- `GET /health` is a compatibility alias.
- The endpoint returns HTTP 200 and `status: "OK"` when the app is available. If `MONGO_URI` is configured but MongoDB is disconnected, it returns HTTP 503 and `status: "DOWN"`.
- The payload includes process uptime, database connection state, start time and response time.

## Local check
Start the backend with the normal `MONGO_URI` configured, then run:

```bash
./scripts/check-health.sh
```

An alternate URL can be passed as the first argument.

## Verification and remaining operational work
The automated health tests verify both endpoint paths and the expected response shape. CI runs them with MongoDB available. The 99% monthly availability objective cannot be established by a unit test alone: after deployment, configure an external uptime monitor against `/api/health`, review monthly availability, and document planned-maintenance announcements.
