# What Gets Built, and in What Order

**Author:** Apurv Duhan, PMP  |  **Last updated:** 14 June 2026

**What this document is:** The spec said *what* the RAID Register does. The plan said *how* I'd build it. This is the last document before building — it breaks the plan into an ordered to-do list the AI works through one step at a time. Think of it as the build checklist: small, concrete steps, each tied back to a numbered requirement so nothing gets built that nobody asked for.

There's a deliberate order to it. The foundation and the locked history come first, because everything else sits on top of them. Then the rules for what counts as valid input. Then the things a user actually does — adding, editing, deleting. Then the list view and the report. And finally the quality passes: making sure it works for everyone and that nothing fails quietly. For each feature, the test that proves it works gets written before the code that does the work — so "done" always means "proven," not "looks finished."

The **(req. N)** tags point back to the numbered requirements in the spec. That's the traceability thread: pick any task here and you can trace it to what was agreed, and later to the test that proves it.

---

## First — the foundation
Nothing works until the data and its history exist, so this comes first.

- [ ] Set up the project skeleton: folders, dependencies, a readme.
- [ ] Create where data lives — a table for items, and a separate, locked table for history *(req. 5)*.
- [ ] Lock that history so it can never be edited or erased, even by future code *(req. 5)*.
- [ ] Add plain, structured logging for startup, errors, and every change, so nothing fails silently.

## Next — the rules for valid input
Before anything can be saved, the tool has to know what "valid" means.

- [ ] Fix the lists for type, severity, and status *(req. 13)*.
- [ ] Generate readable IDs like `RISK-001` *(req. 2)*.
- [ ] Reject bad entries with a clear message, without throwing away the rest of what was typed *(req. 10)*.
- [ ] Stamp every change with the local display name of whoever made it *(req. 12)*.
- [ ] Write the tests for all of the above — first.

## Then — the things a user actually does
The core actions, each with its test written first.

- [ ] Add an item: assign its ID, mark it Open, record that it was created *(req. 1, 2, 5)*.
- [ ] Edit an item: record a history entry for each field that changed *(req. 4, 5)*.
- [ ] Show an item's full history on demand *(req. 6)*.
- [ ] Delete an item — but only after a clear confirmation, and log the deletion *(req. 8, 5)*.

## Then — the list and the report

- [ ] The main register, with filters for type and status and a live count of what matches *(req. 7)*.
- [ ] A printable status report grouped by type and stamped with the date — with a sensible message when the list is empty *(req. 9)*.

## Last — the quality passes
The finishing work that makes it trustworthy and usable.

- [ ] Make it work for everyone: keyboard access, clear labels, and status shown by icon and text, not colour alone *(req. 11)*.
- [ ] Make sure every error explains itself in plain language *(req. 10)*.
- [ ] Run the consistency gate: check that the spec, plan, tasks, and rules all still agree before calling it done.

---

## What "done" actually means
Every requirement (1 through 13) has a passing test that names it. The history genuinely can't be altered. And someone non-technical can pick up the tool and use it without being told how. Until all three are true, it isn't finished.

---

*© 2026 Apurv Duhan. All rights reserved. Authored by Apurv Duhan (apurvduhan-8.com). Please credit the author when referencing or reusing this document.*
