#!/usr/bin/env python3
"""Build the L4 E2E-test CSVs for Report 5.4 and sync their Status column.

Same pipeline as scripts/l1-testcases.py … l3-testcases.py. Two differences at this level:

  * All five sheets share ONE 14-column layout (L3 needed four), taken from the template's
    Introduction sheet — docs/L2-L3-TESTCASE-BRIEF.md does not cover L4.
  * Test ids live in Playwright test titles inside carehub-frontend/e2e/**.spec.js (JavaScript), not in
    Java @DisplayName annotations, and Status comes from Playwright's JSON reporter rather than surefire.

Sources of truth:
  * Test ID and Coverage Technique come from the test titles: test('L4-XXX-NN | Technique: ...').
  * Everything else comes from docs/l4-e2e-tests/l4-testcases.json.
  * Status/Defect ID come from carehub-frontend/playwright-report.json (unless statusOverride is set);
    with no report the whole sheet reads "Not Run", which is the honest state until the suite is run
    against a dedicated environment (see docs/l4-e2e-tests/README.md).

Usage:
    python scripts/l4-testcases.py build     # regenerate docs/l4-e2e-tests/*.csv
    python scripts/l4-testcases.py check     # validate ids both ways, exit 1 on mismatch
    python scripts/l4-testcases.py status    # alias of build (kept for parity with l1/l2/l3)

Stdlib only.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / "docs" / "l4-e2e-tests"
META = DOCS / "l4-testcases.json"
E2E_SPECS = REPO / "carehub-frontend" / "e2e"
PLAYWRIGHT_JSON = REPO / "carehub-frontend" / "playwright-report.json"

COLUMNS = [
    "Test ID",
    "Coverage Technique",
    "SRS Reference",
    "Feature",
    "Priority",
    "Actor (Role)",
    "Entry Point (URL / Page)",
    "Precondition (DB + Auth + Sandbox)",
    "Test Steps (Browser Actions)",
    "Expected UI Result",
    "Negative?",
    "Status",
    "Defect ID",
    "Notes",
]

TECHNIQUES = {
    "Critical Path",
    "User Journey - Happy",
    "User Journey - Error",
    "Permission Boundary",
    "Session Management",
    "Negative UI",
}

# Matches "L4-XXX-01 | Technique: description" inside a test('...') / test("...") title.
TITLE_RE = re.compile(r"(L4-[A-Z0-9]+-\d+)\s*\|\s*(.*)")
TEST_TITLE_RE = re.compile(r"""\btest\(\s*(['"`])((?:\\.|(?!\1).)*)\1""", re.S)


def _technique(rest: str) -> str:
    return rest.split(":", 1)[0].strip() if ":" in rest else rest.strip()


def scan_sources() -> dict[str, tuple[str, str]]:
    """id -> (technique, spec path relative to the repo)."""
    found: dict[str, tuple[str, str]] = {}
    if not E2E_SPECS.is_dir():
        return found

    for path in sorted(E2E_SPECS.rglob("*.spec.js")):
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(REPO).as_posix()
        for _quote, raw in TEST_TITLE_RE.findall(text):
            match = TITLE_RE.match(raw.replace('\\"', '"').replace("\\'", "'"))
            if not match:
                continue
            test_id = match.group(1)
            if test_id in found:
                raise SystemExit(f"duplicate Test ID {test_id} in {rel} and {found[test_id][1]}")
            found[test_id] = (_technique(match.group(2)), rel)

    return found


def load_meta() -> dict:
    return json.loads(META.read_text(encoding="utf-8"))


def playwright_results() -> dict[str, str]:
    """Test ID -> Pass | Fail | Skip from Playwright's JSON reporter output."""
    results: dict[str, str] = {}
    if not PLAYWRIGHT_JSON.is_file():
        return results
    report = json.loads(PLAYWRIGHT_JSON.read_text(encoding="utf-8"))

    def verdict_of(spec: dict) -> str | None:
        statuses = [
            result.get("status")
            for test in spec.get("tests", [])
            for result in test.get("results", [])
        ]
        # `playwright test --list` also writes a report, with every spec ok=true and zero results.
        # Nothing ran, so the row must stay "Not Run" rather than silently reading as a pass.
        if not statuses:
            return None
        if any(status in {"failed", "timedOut", "interrupted"} for status in statuses):
            return "Fail"
        if all(status == "skipped" for status in statuses):
            return "Skip"
        return "Pass" if spec.get("ok") else "Fail"

    def walk(suite: dict) -> None:
        for spec in suite.get("specs", []):
            match = TITLE_RE.match(spec.get("title") or "")
            if not match:
                continue
            test_id = match.group(1)
            verdict = verdict_of(spec)
            if verdict is None:
                continue
            # A retried or parameterised spec contributes several results; one failure fails the row.
            if results.get(test_id) != "Fail":
                results[test_id] = verdict
        for child in suite.get("suites", []):
            walk(child)

    for suite in report.get("suites", []):
        walk(suite)
    return results


def check(meta: dict, sources: dict[str, tuple[str, str]]) -> int:
    problems: list[str] = []
    documented: set[str] = set()
    coded: set[str] = set()

    for sheet in meta["sheets"]:
        for test_id, row in sheet["rows"].items():
            documented.add(test_id)
            if row.get("code", True):
                coded.add(test_id)
            elif not row.get("statusOverride"):
                problems.append(f"  {test_id} has \"code\": false but no statusOverride")

            technique = row.get("technique") or sources.get(test_id, ("", ""))[0]
            if not technique:
                problems.append(f"  no Coverage Technique: {test_id}")
            for part in re.split(r"\s*\+\s*", technique):
                if part and part not in TECHNIQUES:
                    problems.append(
                        f"  Coverage Technique part {part!r} not in the template's enum: {test_id}")
            for field, label in (("srs", "SRS Reference"), ("feature", "Feature"),
                                 ("actor", "Actor (Role)"), ("entry", "Entry Point"),
                                 ("precondition", "Precondition"), ("steps", "Test Steps"),
                                 ("expected", "Expected UI Result")):
                if not row.get(field):
                    problems.append(f"  empty {label}: {test_id}")
            if row.get("p") not in {"P1", "P2", "P3"}:
                problems.append(f"  Priority must be P1/P2/P3: {test_id} -> {row.get('p')!r}")
            if row.get("n") not in {"Yes", "No"}:
                problems.append(f"  Negative? must be Yes/No: {test_id} -> {row.get('n')!r}")
            override = row.get("statusOverride")
            if override and override not in {"Blocked", "Skip", "Not Run"}:
                problems.append(f"  statusOverride must be Blocked/Skip/Not Run: {test_id}")

    in_code = set(sources)
    for test_id in sorted(in_code - documented):
        problems.append(f"  in code but not in l4-testcases.json: {test_id}  ({sources[test_id][1]})")
    for test_id in sorted(coded - in_code):
        problems.append(f"  in l4-testcases.json but not in any spec: {test_id}")

    rows = [row for sheet in meta["sheets"] for row in sheet["rows"].values()]
    negatives = sum(1 for row in rows if row.get("n") == "Yes")
    if rows and negatives * 4 < len(rows):
        problems.append(
            f"  Negative? ratio {negatives}/{len(rows)} is below 1/4 — add error-path rows")

    if problems:
        print(f"FAIL - {len(problems)} problem(s):")
        print("\n".join(problems))
        return 1
    print(f"OK - {len(coded)} coded test IDs match between the specs and l4-testcases.json "
          f"({len(documented) - len(coded)} documentation-only rows, Negative {negatives}/{len(rows)})")
    return 0


def _nl(value: str) -> str:
    return value.replace("\\n", "\n")


def build(meta: dict, sources: dict[str, tuple[str, str]], results: dict[str, str]) -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    total = 0
    tallies = {"Pass": 0, "Fail": 0, "Blocked": 0, "Skip": 0, "Not Run": 0}
    for sheet in meta["sheets"]:
        out = DOCS / f"{sheet['name']}.csv"
        rows = []
        for test_id, row in sheet["rows"].items():
            technique = row.get("technique") or sources[test_id][0]
            if row.get("block"):
                rows.append([f"  ▶  {row['block']}"] + [""] * (len(COLUMNS) - 1))
            status = row.get("statusOverride") or results.get(test_id, "Not Run")
            defect = row.get("defect", "")
            if not defect:
                found = re.search(r"\bD\d+\b", row.get("notes", ""))
                defect = found.group(0) if found else ""
            tallies[status] = tallies.get(status, 0) + 1
            rows.append([
                test_id,
                technique,
                row["srs"],
                row["feature"],
                row["p"],
                row["actor"],
                _nl(row["entry"]),
                _nl(row["precondition"]),
                _nl(row["steps"]),
                _nl(row["expected"]),
                row["n"],
                status,
                defect,
                row.get("notes", ""),
            ])
        with out.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.writer(handle, quoting=csv.QUOTE_ALL)
            writer.writerow([sheet["title"]] + [""] * (len(COLUMNS) - 1))
            writer.writerow(COLUMNS)
            writer.writerows(rows)
        cases = len(sheet["rows"])
        total += cases
        print(f"  {out.relative_to(REPO).as_posix():<52} {cases:>3} cases")
    summary = ", ".join(f"{k}={v}" for k, v in tallies.items() if v)
    print(f"  {'TOTAL':<52} {total:>3} cases   ({summary})")


def main() -> int:
    command = sys.argv[1] if len(sys.argv) > 1 else "build"
    meta = load_meta()
    sources = scan_sources()

    if command == "check":
        return check(meta, sources)

    if command not in {"build", "status"}:
        print(__doc__)
        return 2

    exit_code = check(meta, sources)
    if exit_code:
        print("\nRefusing to write CSVs while the metadata is out of sync.")
        return exit_code

    results = playwright_results()
    if not results:
        print("NOTE: no executed Playwright results - Status will be 'Not Run' for every row.")
        print(f"  expected {PLAYWRIGHT_JSON.relative_to(REPO).as_posix()} "
              f"(run `npm run test:e2e` in carehub-frontend against a dedicated environment)")
    build(meta, sources, results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
