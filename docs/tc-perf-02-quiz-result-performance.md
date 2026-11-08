# TC-Perf-02 — Concurrent quiz-result performance (CSQ-NF-002)

**Requirement:** The system shall display the quiz result within 3 seconds for at least 95% of submissions when 100 Students submit at the same time.

**Acceptance criterion:** 95th percentile ≤ 3 s over 100 simultaneous student submissions.

## Method

The load test is implemented in `backend/perf/quizSubmitPerformance.js` and can be run with:

```bash
npm run perf:quiz-submit
```

1. Connects to MongoDB (`PERF_MONGO_URI` or `MONGO_URI`, default `mongodb://127.0.0.1:27017/studyplatform`) and initializes database indexes.
2. Seeds a published **Quiz** containing **10 multiple-choice questions** with distinct options and topics.
3. Generates **100 distinct Student accounts** and corresponding signed JWT session tokens (`requireAuth`).
4. Pre-creates **100 `in_progress` QuizAttempt documents** associated with the students and the published quiz, pre-populated with answer maps.
5. Concurrently fires all 100 `POST /api/quizzes/attempts/:attemptId/submit` requests across 100 parallel workers using `Promise.all`.
6. Measures high-resolution monotonic request-to-response duration (`process.hrtime.bigint()`), reading the full response JSON and verifying that valid graded scores and results are returned.
7. Calculates the distribution metrics: mean, p50, p95 (nearest-rank method), p99, maximum, and percentage of requests completing within the 3.0-second threshold.
8. Deletes all seeded benchmark documents (`Quiz`, `Question`, `QuizAttempt`) using the unique `perfRunId`.

The test is integrated into the automated test suite as `backend/tests/quizSubmitPerformance.integration.test.js`.

## Design measures (DS-Perf-02)

- **Atomic State Transition:** The submission endpoint performs an atomic `findOneAndUpdate` with condition `{ _id, studentId, status: 'in_progress' }`, guaranteeing each attempt is graded exactly once even under high concurrency.
- **In-Memory Result Evaluation:** The auto-grading algorithm evaluates questions and answers entirely in-memory using Map lookups, requiring only a single batched query to fetch the question definitions for the quiz.
- **Embedded Result Snapshot:** The graded result (`score`, `total`, `percentage`, per-question snapshot) is written directly into the `QuizAttempt` document, avoiding complex join overhead during subsequent reads.
- **Indexed Attempt Lookups:** Indexes on `{ studentId: 1, quizId: 1, createdAt: -1 }` and `{ status: 1, expiresAt: 1 }` ensure immediate index-backed query execution.

## Result — recorded November 2026

| Metric | Measured Value |
|---|---|
| Environment | Local development environment, Windows 11, Node.js v25.8.2, MongoDB 8.2, API and database on same host |
| Simultaneous Submissions | 100 |
| Total Submissions Evaluated | 100 |
| Failed Submissions | 0 (0%) |
| Mean Duration | 1559.4 ms |
| Median (p50) | 1538.9 ms |
| **95th Percentile (p95)** | **1619.9 ms** |
| 99th Percentile (p99) | 1663.1 ms |
| Maximum Duration | 1663.8 ms |
| Submissions within 3.0 s SLA | 100% (100/100) |
| Mean Result Payload Size | 3,004 bytes (≈ 2.4 ms network transfer at 10 Mbps) |

**Status: Passed.** The 95th percentile response time of **1619.9 ms** is well below the 3.0-second SLA target, with a 100% success rate under 100 simultaneous submissions.

## Limitations

- The benchmark measures API response round-trip time on localhost; network propagation latency over WAN is not included. However, the average response payload size (3.0 KB) requires only ~2.4 ms of transfer time on a 10 Mbps connection, leaving more than 1.3 seconds of margin beneath the SLA.
- The test was executed on a multicore developer workstation; production environments should replicate this benchmark under equivalent container/cluster constraints.
