# TC-Perf-01 — Material search performance (CSQ-NF-001)

**Requirement:** The system shall return search results within 2 seconds for at least 95% of searches when up to 10,000 materials are stored.

**Acceptance criterion:** 95th percentile ≤ 2 s over 200 searches in a load test with 10,000 materials.

## Method

The load test is `backend/perf/searchPerformance.js` (run with `npm run perf:search` in `backend`).

1. Connects to a dedicated database (`PERF_MONGO_URI`, default `mongodb://127.0.0.1:27017/studyplatform_perf`) and makes sure the search indexes exist.
2. Inserts **10,000 materials** spread over 20 subjects, 50 topics and 10 material kinds, with creation dates one minute apart.
3. Starts the real Express API and logs in as a Student (signed session token).
4. Sends 10 warm-up searches (not measured), then **200 measured searches** with **10 requests in flight at a time**. The mix rotates through:
   - keyword only (for example `Optics`),
   - keyword + subject,
   - subject only,
   - topic only,
   - subject + topic,
   - two-word keyword,

   across result pages 1, 2 and 3.
5. Times every request end to end (request sent until the full JSON body is read) and reports mean, p50, p95, p99 and maximum, plus the share of searches within 2 s.
6. Deletes the seeded materials.

The script exits with code 1 if any search fails or the target is missed. `PERF_MATERIALS`, `PERF_SEARCHES` and `PERF_CONCURRENCY` change the load profile.

The same check runs on every CI build as `backend/tests/searchPerformance.integration.test.js` against the CI MongoDB service.

## Design measures (DS-Perf-01)

- Text index on `title`, `subject` and `topic` for keyword search.
- Indexes on `createdAt` (newest first) and on the lower-cased subject and topic keys combined with `createdAt` for exact filters.
- Fixed page size of 10, lean queries and a projection of list fields only.

## Result — recorded 29 Oct 2026

| Item | Value |
|---|---|
| Environment | Local machine: Intel Core Ultra 5 125H (18 logical CPUs), 15 GB RAM, Windows 11, Node.js v24.4.1, MongoDB 7.0.14, API and database on the same host |
| Materials stored | 10,000 |
| Searches measured | 200 (10 concurrent) |
| Failed searches | 0 |
| Mean | 48.0 ms |
| p50 | 45.1 ms |
| **p95** | **65.6 ms** |
| p99 | 101.9 ms |
| Maximum | 117.7 ms |
| Searches within 2 s | 100% |
| Mean response size | 2,159 bytes (≈ 1.7 ms extra at 10 Mbps) |

**Status: Passed.** The 95th percentile (65.6 ms) is well below the 2 s target.

## Limitations

- The test ran with the API and MongoDB on one machine, so network latency is not included. A 10-result page is about 2 KB, which adds roughly 2 ms at the SRS reference speed of 10 Mbps; the margin to the target is large enough to absorb this.
- Response time in the SRS is measured to the result being shown on screen. Browser rendering of 10 list items is not part of this API-level measurement.
- The result should be re-recorded on the deployment server before final acceptance.
