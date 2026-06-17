# PMO RAID Register

A small, single-user tool to log and track **R**isks, **A**ssumptions, **I**ssues and
**D**ependencies — with a change history behind every item that cannot be altered.

Built spec-first: this code implements `spec.md` against the rules in `constitution.md`,
following `plan.md` and `tasks.md`. Every route and test names the requirement it satisfies.

## Run it

```bash
pip install -r requirements.txt          # or: pip install -r requirements.txt --break-system-packages
export RAID_ACTOR="Your Name"            # the name recorded against every change (req. 12)
uvicorn src.app:app --reload             # then open http://127.0.0.1:8000
```

The database is a single local file (`raid.db`) created automatically on first run.

## Run the tests

```bash
python3 -m pytest -q
```

Nine tests, each mapped to a requirement (e.g. `test_history_is_append_only` → req. 5 / Article II).

## How it honours the constitution

- **Append-only history (Article II).** The `history` table has SQLite triggers that reject
  any UPDATE or DELETE. The audit trail can't be rewritten, even by future code.
- **Traceability (Article I).** Requirement numbers appear in `spec.md`, in route comments
  in `src/app.py`, and in the test names — a continuous thread from intent to proof.
- **Simplicity (Article IV).** Python + FastAPI + SQLite + server-rendered HTML. No build
  step, no external services, no trackers (Article V).
- **Accessibility (Article VII).** Keyboard-operable, labelled controls, and status shown by
  icon + text, never colour alone.

## Structure

```
src/      app.py (routes) · db.py (data + audit triggers) · models.py (rules)
          export.py · logging_config.py · templates/ · static/
tests/    one file per behaviour group, mapped to requirements
spec.md · plan.md · tasks.md · constitution.md
```

*© 2026 Apurv Duhan. Built as Phase 1 of a spec-driven, agentic delivery portfolio.*
