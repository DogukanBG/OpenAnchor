# OpenAnchor current design contract

This document replaces the earlier forecasting candidate comparison and warm visual direction. The accepted implementation scope is the user's five-phase plan, with the subsequent Workspace redesign and restored financial health report.

## Fixed choices

- Electron + React + SQLite; extract domain services rather than rewrite the persistence foundation.
- Apple Silicon macOS validation first. All artifacts remain local; no publishing, release upload, signing or notarization is performed.
- Workspace UI: blue/cool neutrals, sidebar navigation, local sans-serif fonts, crisp cards/tables, light and dark themes. Approved blue rounded-anchor icon for Dock, Finder and app switcher.
- Chronos-2 only, CPU worker outside the renderer. Pin model revision, dependencies and integrity hashes. No alternate model/cloud fallback.
- Forecasting off initially, persistent toggle, horizons 30/90/180 (default 90). Every account needs consecutive verified coverage: default 180 days, configurable 30–8,192. Ineligible accounts have no future graph.
- Other AI: Ollama and llama.cpp-compatible custom endpoint, separate extraction/assistant models.
- Recurring costs **and income** require confirmation; monthly budgets only.

## Ledger and imports

Versioned migrations make consistent backups and preserve raw legacy values. Invalid legacy values are flagged rather than repaired by guessing. Money uses signed integer minor units and currency precision. Backend validation governs dates, amounts, references and category compatibility. Linked transfers retain cash movement but are excluded from income/spending totals.

CSV uses the CSV library with explicit formats. PDF/TXT use reviewed AI extraction, preserving page provenance and failures. Failed/missing pages cannot establish full coverage. File hashes and import batches support duplicate detection, overlap review and undo. Ledger rows, accepted balance updates and coverage commit atomically. Opening/closing reconciliation is checked in the backend. Statement periods and CSV completeness require explicit review.

## Categorization and exploration

Order: explicit user rule → confirmed merchant mapping → strong confirmed history → specific keywords → validated AI suggestion → review. Counterparty identifiers are exact identities where available; aliases require confirmation. Keep raw descriptions. Corrections target one transaction, previewed past matches or future matches, retaining provenance. Referenced categories require reassignment before deletion.

Spending aggregates and drill-down use the same account/date/currency filters. Date presets are separate from chart grouping. Comparisons identify incomplete periods. Large lists are paginated and currencies never silently converted.

## Recurring commitments

Group by account/currency/merchant identity and examine calendar cadence, modest date shifts, purpose signal and supporting amount consistency. Weekly/fortnightly/monthly need three observations; quarterly/annual need two. Groceries/restaurants/ordinary shopping are excluded by default. Allow variable utilities and price changes. Confirmation includes purpose, cadence, expected date/amount and observed range. Manual entries, persistent dismissal, effective-dated changes and active/paused/cancelled states are supported. Matched transactions link to their confirmed series.

## Forecast construction

Only verified days are zero-filled. Confirmed recurring transactions are removed from residual historical inflow/outflow inputs. Linked transfers are excluded when both accounts are inside the selected scope; transfers crossing its boundary remain cash movements. Forecast residual series independently per account using Chronos-2; add confirmed schedules and planned one-offs once. Combine compatible-currency point estimates. Use the latest common complete coverage date as origin and show freshness.

Historical lines are solid; future lines dashed, with a full-height divider labelled Forecast starts and dated at the origin. Toggle off hides future lines, bands, divider and cards. Show daily individual-series p10–p90 bands only. Do not treat sums of marginal quantiles as a net-flow/balance interval. A projected balance requires a reconciled dated anchor. Revision-keyed caches prevent stale results; cancellation stops/restarts the worker safely.

## Planning and explainability

Monthly account plans include income assumptions, category limits, bill reservations, savings and buffer. Bill reservations count once within existing category limits, adding only any uncovered reservation. Show actuals, remaining limits and over-allocation. Copy-forward is supported. The Budget page reuses current eligible dashboard forecasts for the dates that fall within its month; missing/ineligible forecasts produce no future estimates. Allocations are planning records, not ledger rows; there are no invented category forecasts.

Financial health is calculated by the backend, with evidence IDs, account/date scope and coverage. Comparisons require complete coverage on both sides. Optional AI interprets these facts. The assistant first selects an allowlisted read-only analysis with a validated structured request; native tool calling is unnecessary. Numerical facts/evidence links come from the backend. Chats retain scope/revision and edits truncate stored subsequent history.

## Security and recovery

Sandboxed renderer, isolated preload, validated main-frame IPC senders, navigation/permission restrictions, production CSP and locally bundled fonts. Consistent backup/restore/export and migration/import audit trail. Runtime setup downloads public software/model artifacts, not financial data. Local privacy for language-model features depends on the configured endpoint.

## Verification status

See `IMPLEMENTATION.md` for executed checks, packaged validation and remaining limitations. Synthetic backtests measure chronological prediction error and interval coverage without future-data leakage. They provide no real-world accuracy promise.
