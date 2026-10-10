# Implementation and local verification

Implementation and automated verification completed 3 October 2026. This is a local implementation/build record, not a public release announcement.

## Delivered implementation

The five planned areas are implemented in the application: migrated/audited ledger and reliable imports/recovery; category corrections and spending exploration; confirmed recurring costs and income; managed Chronos-2 dashboard forecasting; monthly budgets, evidence-based reports/assistant, provider reliability and local macOS packaging.

Cash-flow charts, health-report cash movement and residual forecast inputs include transfers crossing the selected account boundary. Income/spending excludes all linked transfers; internal transfers disappear from combined-scope cash flows. The forecast recipe revision prevents reuse of caches computed with the earlier transfer behavior.

The accepted Workspace design replaces the warm café theme. The Financial health report is below the Overview cash-flow chart. The approved blue icon is bundled as PNG for the running app and ICNS for the macOS bundle.

The backend services live under `electron/`: `domain.js`, migrations, `ledger.js`, import/PDF extraction, data management, providers, health and `forecast/`. The named preload API groups isolate privileged operations. Page components use the shared account/date scope and backend-calculated records. Unused original pages have been removed; the app shell selects the current pages.

## Executed checks

- `npm test`: ledger/money/date/CSV validation; migration backups and raw invalid legacy records; transfer/refund/account behavior, including cash-flow boundaries and cancellation within combined scopes; import atomicity, duplicates, reconciliation and undo; categorization priority; recurring income/cadence and grocery exclusions; scoped spending; budgets/copy-forward/reservations; coverage boundaries/gaps, forecast arithmetic/anchors/cache/toggle; evidence/chat edits; health/report cutoff; PDF missing/failed-page provenance; both AI provider protocols/errors/cancellation.
- Real pinned Chronos-2 CPU/offline inference using 180 synthetic daily observations, plus real worker cold-start cancellation, concurrent startup, safe restart, missing/corrupt-model rejection and failed-setup recovery.
- Chronological synthetic backtests for 30/90/180-day horizons. Results are in `tests/backtest-results.json`. Individual interval coverage on these fixtures is below the nominal 80% in several cases. These results do not establish real-account forecast accuracy or calibration.
- Source Electron smoke: sandbox, named IPC, navigation and native icon using a temporary synthetic profile. The test profile isolates both the SQLite database and Chromium storage/preferences.
- Packaged `.app` smoke: navigation, visible Financial health report, sandbox, approved icon, **both existing-Python and standalone-runtime in-app setup paths**, real Chronos-2 forecast through packaged IPC/worker, cache presentation and turning future charts off. Dependencies install into a separate temporary environment. Model files are reused from the already verified local download, with integrity validation. The standalone package test starts from a fresh profile and the verified Python archive; the separate fresh installer test exercises its actual HTTPS download and archive extraction. Budget forecast context reconciles to the cached dashboard forecast and disappears when forecasts are switched off.
- Fresh standalone installer: pinned Python archive download/hash validation, extraction, isolated dependency installation and real CPU inference passed using a temporary profile.
- Local Apple Silicon `.app`, DMG and ZIP built with publishing disabled, signing identity unset and notarization disabled. Bundle `Info.plist` references `icon.icns`; its bytes match the approved generated icon asset.
- Dependency override replaces the old build-time cached HTTP downloader with `@electron/get` 5.1.0. The dependency audit reports zero known vulnerabilities at the recorded check. This is time-specific, not a security guarantee.
- Packaged screenshot inspected locally: `docs/images/overview.png`, using synthetic records.

## Validation boundaries

Both setup routes have now been exercised with synthetic records after authorization to finish the outstanding installer test. The standalone route downloads its own pinned Python; the existing-Python route creates an isolated environment without modifying the selected original environment. Tests reuse verified model weights to avoid repeatedly downloading the same checkpoint. The existing-Python option is restricted to the validated Apple Silicon Python 3.12 target; other versions are rejected before dependency setup.

Provider checks use synthetic protocol fixtures; arbitrary user-selected language models can still miss extraction records or return an invalid structured request. Review remains mandatory. Real user financial data has not been used in automated tests. Record links do not make an AI interpretation infallible.

Bundle icon metadata and the running native image are verified. macOS image tools also decoded the packaged ICNS; the resulting icon was visually inspected. A manual Finder/app-switcher appearance check remains unverified because Computer Use access to Finder was not approved. No alternate method was used to control Finder. Windows, Linux and Intel Mac validation is deferred. Signing/notarization is deliberately untested and disabled.

No publishing, Git push, public release, cloud forecasting or real-data import was performed. The generated artifacts remain under `dist-electron/` on this Mac.

## Deferred scope

Bank sync, OCR, exchange-rate conversion, cloud accounts, advanced budget rollover/reserves/scenarios, model fine-tuning, alternate forecasting models and other-platform distribution remain deferred as requested.

### CSV review and existing GGUF follow-up (3 October 2026)

Added GGUF selection and an app-owned, loopback-only llama-server process using an already-installed executable, with status, cancellation, stop and quit cleanup. Fixed discovery to use the selected provider/URL before settings are saved. Added grouped/searchable bulk import category review, optional future rules, manual assignment precedence and pagination. Added a Categories navigation page and inline creation. Migration v3 preserves category IDs and makes built-in Investments usable for expenses and income, with a consistent backup; restore accepts v3. Synthetic tests exercise grouping, rules, investment purchases and local process startup/cancellation. An isolated Electron UI smoke check also passed category creation, grouped CSV review, commit persistence and GGUF control rendering. Testing the user's actual GGUF checkpoint still requires selecting it locally.

### Visible extraction AI activity and progress (3 October 2026)

Added an Import model selector and optional AI categorization control; explicit model validation replaces silent skipping, and categorization no longer depends on a stale connection-status flag. AI request/invalid-response errors appear in the activity summary. Added stage progress for parsing, page extraction, deterministic categorization, AI batches and backend validation, with completed counts and an indeterminate indicator while a model response is pending. Synthetic Electron tests verify CSV AI suggestions, TXT AI extraction, provider failures and progress. A live local gemma4:latest request returned a valid Shopping category for one synthetic transaction; no personal transaction was sent.

### Explicit AI review and readable descriptions (3 October 2026)

AI categories remain in outstanding review until explicit individual/group/all acceptance, correction or rejection. Different suggestions for the same counterparty are shown as separate groups. Backend import validation rejects unreviewed AI categories atomically; original AI suggestions and acceptance are retained in raw provenance. Manual changes and accepted suggestions survive import. Description editing uses wider multiline fields in import review and the transaction editor.

### Structured AI, German keywords, Scholarships and full descriptions (3 October 2026)

Category batches now send provider-native JSON schemas with per-record compatible category enums and all indices required. Ollama structured requests disable thinking output; replies are validated, and complete JSON inside code fences or after a reasoning block is supported without inventing values. Both live local models (gemma4:latest and qwen3.6:latest) returned 16/16 compatible categories for synthetic batches.

Migration v4 backs up existing ledgers and adds Scholarships as an income category; restore accepts v4. The active keyword service focuses on German merchants and purposes, normalizes umlauts and terminal suffixes, uses whole tokens and prefers specific phrases (Amazon Prime, Uber Eats). Scholarship income can be proposed as recurring when cadence evidence exists; confirmation is still required. Description inputs auto-grow and displayed transaction names wrap in full, including spending and evidence drill-downs. Domain and isolated UI checks cover these changes, including a long-description end marker remaining fully visible.

### Review layout and categorization context (3 October 2026)

Separated each group's full-width name and summary from its wrapping action row, preventing long controls from squeezing names into single-character columns. Added a saved 4,000-character categorization context in Import, included in all category batches, with a reconsideration action limited to unresolved/unaccepted suggestions; accepted and manual assignments remain unchanged. Context is distinct from assistant memory and PDF factual extraction. The existing schema and explicit-review requirements still apply.

### Per-category keyword extensions (3 October 2026)

Every built-in or user-created category exposes its built-in German terms and a locally persisted additional keyword editor. Custom terms are validated by the backend, deduplicated using German normalization, matched by whole word/phrase and income/expense compatibility, and applied by the shared CSV/PDF/TXT categorization pipeline before built-in guesses. Explicit rules and confirmed merchant/history matches keep priority. Conflicting custom assignments are rejected or left for review; editing does not silently recategorize past transactions. Keyword settings survive restart and backup/restore and follow category reassignment. Synthetic domain and isolated app checks cover editing and import assignment.

### Import review amount formats (3 October 2026)

Review edits and optional closing balances carry an explicit German/English amount format through backend validation, reconciliation and atomic commit. The review UI defaults to German decimal commas, provides a format selector, and retains the format attached to each edited value. Extracted numeric amounts remain canonical regardless of locale. Regression checks cover grouped values, negative balances, edited amounts, invalid formats, rollback and undo.

### Financial health periods and crossed forecast quantiles (4 October 2026)

The health card defaults to this month and saves its own period/custom dates locally, with an option to follow dashboard dates. It scopes supporting records and explanations to the calculated report, clears stale explanations on period changes, and resolves all-time coverage from the first valid transaction or verified coverage. Calendar and inclusive rolling-period boundary tests and isolated UI checks verify date filtering and persistence.

Chronos quantile crossings no longer abort otherwise valid forecasts. Daily quantile triplets are monotonically rearranged; original crossed values and correction flags/counts are retained in model components and the dashboard discloses corrections. Finite/nonnegative validation remains enforced; net/balance confidence intervals are still unavailable. The forecast recipe revision invalidates previous cached forecasts. Synthetic crossing/nonfinite cases and actual local CPU worker inference are checked.

### Spending, cash-flow readability, text preprocessing and recoverable reset (4 October 2026)

Spending now starts with net spending, gross payments/refunds and purchase averages, then ranks categories or merchants and provides coverage-qualified equal-period comparisons, a bar trend and searchable/paginated breakdowns. Refunds do not count as purchases. Cash flow has a running-net default and a grouped money-in/out view; forecasts keep dashed styling, a dated divider and optional individual daily bands. Pure/domain checks cover financial arithmetic, incomplete coverage and chart grouping.

Derived transaction-text preprocessing preserves original descriptions. It extracts arbitrary explicitly named PayPal merchants, repairs inconsistent word breaks using matching repeated names, removes bank-reference boilerplate from categorization input, and retains purchase-purpose text. Exact parsed PayPal merchant groups and future rules stay separated across merchants and reconcile to supporting records. Original text is shown only after clicking a transaction, including import review, transactions, spending and evidence views. No migration or destructive rewriting of historical text is required.

The reset button requires typed WIPE confirmation, creates a recovery copy, clears the active ledger and personal categorization/chat context, and preserves models/connection settings and existing backups. Tests execute only on synthetic temporary profiles and verify restoration from the recovery copy. Automatic approval review rejected the initially proposed permanent deletion of local backups; the implemented reset retains them.

Packaged checks passed for spending conclusions/refund drill-downs, grouped/running cash flow, click-only original text, recovery-backed reset and return to Overview. A separate mocked local-provider import check verifies only cleaned categorization text is sent, AI suggestions remain reviewable, original descriptions are retained exactly and cent values reconcile. The packaged offline Chronos worker/forecast visibility check also passed. All automation uses isolated synthetic profiles; real user data is untouched.

PayPal regression fix (4 October 2026): recognize whitespace inside the fixed German purchase marker and both PP/non-PP reference prefixes. Parsed shop identities take priority over processor counterparty IDs in new merchant records, future rules, category history, review groups and correction previews. Legacy shared PayPal merchant IDs are ignored for category inference; spending derives shop-specific groups on read. Blank-merchant payments remain individual rows, disable future-rule creation and have transaction-specific spending drill-downs. The supplied six descriptions have regression coverage, including a legacy shared-counterparty fixture and exact totals. Raw descriptions and previously saved categories are not rewritten.

### Assistant chat fix and monthly planning additions (4 October 2026)
Scoped chat creation now derives the inclusive duration and label from validated dates in the privileged backend. Saving the chat and its scope is atomic; a null renderer duration cannot violate the existing schema.

Monthly budgets include editable historical category estimates (120 calendar days by default, 1–8,192 supported). History ends at the latest verified complete date before the selected budget month, capped at today for future months. Full verified lookback coverage is required; unknown days never become assumed zeros. Expected net category spending uses exact integer arithmetic: historical category net spend × days in budget month ÷ history days, rounded to minor units. Refunds reduce spending; linked transfers and income are excluded; currencies remain account-scoped. Month-end and leap-year lengths are respected; bills already in history are not added again. Original limits stay unchanged unless the user applies an estimate to the draft and saves. Covered days without transactions count in the denominator; uncategorized spending remains visible.

The same month now has a bill/income calendar for confirmed schedules and planned one-offs, with linked paid/received records and clearly qualified “not recorded” statuses. In-app budget alerts show saved allocations exceeding income, recorded category overspending, and eligible historical estimates exceeding saved limits. No unsolicited notifications are sent.

Import preflight checks update before committing: invalid selected records, reviewed AI suggestions, previously imported files, existing and within-file duplicate rows, complete statement-period bounds, missing verified intervals, extraction failures and balance reconciliation/stale balance anchors. Later repeated rows are deselected by default and require explicit overlap acceptance. Domain and packaged synthetic UI tests cover these additions. Rejected idea suggestions (savings goals, spending-change reports, subscription price alerts, saved search filters and local reminders) are outside this work.

## Audit corrections and report layout

- Restore initializes and validates a staged SQLite snapshot before replacement, with recovery if reopening fails. Rejected account deletion preserves plans. Import rows retain their currency and changing accounts clears review.
- Manual schedules offer a merchant selector and explicit past-payment links. Relevant transaction edits clear stale links; automatic matching checks amounts/ranges. Legacy PayPal recurrence candidates use extracted shops. Calendar generation includes dates before the next payment. Category reassignment includes archived schedule snapshots.
- Forecast assistant evidence is restricted to requested dates. Refund references block unsafe deletion. Categorization uses distinct SQL history categories and reuses results within an import. Unreachable old screens and two unused font packages were removed.
- The financial health report presents a readable AI summary with Generate report/Regenerate, retains the period selector, and keeps detailed calculations and supporting payments collapsed. Numerical placeholders are replaced with calculated facts; unsupported numeric claims are rejected. Coverage and comparison limitations remain visible.
- Regression coverage: `tests/audit-regressions.cjs`, health summary checks in `tests/health.cjs`, and isolated packaged checks in `tests/packaged-audit.cjs` and `tests/packaged-health.cjs`.
- Demo screenshots are generated with invented data in a temporary profile. Identifying old images, local paths and original payment references were removed from current source files. Git history was not rewritten.
