# Finance Control Tower — specification v2

Supersedes the original `spec/` folder (`01-tokens.md` … `08-o2c-and-process-aware-root-cause.md`),
which described the first build and is still referenced by comments in the code. Leave
those files in place for provenance; **build from these.**

Split across six files so a task loads only what it needs. **Read only the file a step
names.** The whole spec is roughly 24,000 tokens; no task needs more than two files.

| File | Sections | What is in it |
|---|---|---|
| `spec-v2/rules.md` | §0 · §10 · §13 | How to use the spec, design constraints, codebase conventions. **Read once per session.** |
| `spec-v2/model.md` | §1–§6 · §12 | Product framing, legal entities, scoring model, attribution, data types, out of scope |
| `spec-v2/data-core.md` | §7.1–§7.16 | Dimension scores, entity metrics, stage counts, root causes, trends, prior periods |
| `spec-v2/data-detail.md` | §7.17–§7.31 | Exception seeding, counterparties, compliance, cost centres, forecasts, ageing buckets |
| `spec-v2/ui.md` | §8 · §9 · §11 | Cross-cutting UI rules, screen inventory, the assistant |
| `spec-v2/agents.md` | §15 | The agent workforce, delegation model, touch economics |

Section numbers are unchanged, so a cross-reference like "§7.19" still resolves — it
lives in `spec-v2/data-detail.md`.
