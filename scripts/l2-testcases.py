#!/usr/bin/env python3
"""Build the L2 integration-test CSVs for Report 5.2 and sync their Status column.

Same pipeline as scripts/l1-testcases.py, adapted to the L2 contract from
docs/L2-L3-TESTCASE-BRIEF.md:
  * 15 columns (Services Involved / Infrastructure / External Mocks replace the L1 Covers column).
  * Coverage Technique restricted to the brief's enum (combinations joined with " + " allowed).
  * Backend only — there is no frontend at L2, so no vitest side.
  * Optional per-row "statusOverride" (e.g. "Blocked") for @Disabled tests whose honest workbook
    status is Blocked, not Skip — the H2/no-broker cases the brief calls out.

Sources of truth:
  * Test ID and Coverage Technique come from the @DisplayName strings in the test sources.
  * Everything else comes from docs/l2-integration-tests/l2-testcases.json.
  * Status/Defect ID come from the latest surefire reports (unless statusOverride is set).

Usage:
    python scripts/l2-testcases.py build     # regenerate docs/l2-integration-tests/*.csv
    python scripts/l2-testcases.py check     # validate IDs both ways, exit 1 on mismatch
    python scripts/l2-testcases.py status    # alias of build (kept for parity with l1)

Stdlib only.
"""

from __future__ import annotations

import csv
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / "docs" / "l2-integration-tests"
META = DOCS / "l2-testcases.json"
BACKEND_TESTS = REPO / "carehub-backend" / "src" / "test" / "java"
SUREFIRE = REPO / "carehub-backend" / "target" / "surefire-reports"

COLUMNS = [
    "Test ID",
    "Coverage Technique",
    "SRS Reference",
    "Feature",
    "Priority",
    "Services Involved",
    "Infrastructure (Testcontainers)",
    "External Mocks (WireMock)",
    "Given (DB State / Setup)",
    "When (Action / HTTP Call)",
    "Then (Expected DB State + Events + Response)",
    "Negative?",
    "Status",
    "Defect ID",
    "Notes",
]

TECHNIQUES = {
    "Happy Path",
    "Transaction Boundary",
    "Rollback",
    "Idempotency",
    "Concurrency",
    "Optimistic Lock",
    "Event Published",
    "Constraint Violation",
    "Query Correctness",
    "Negative",
}

# Matches "L2-XXX-01 | Technique: description" inside a @DisplayName("...").
TITLE_RE = re.compile(r"(L2-[A-Z]+-\d+)\s*\|\s*(.*)")
DISPLAY_NAME_RE = re.compile(r'@DisplayName\(\s*"((?:[^"\\]|\\.)*)"\s*\)')

# Surefire writes the JUnit method name, not the @DisplayName; capture the method declared right
# after each annotation block to bridge the two (same regex as the l1 script).
DISPLAY_NAME_WITH_METHOD_RE = re.compile(
    r'@DisplayName\(\s*"((?:[^"\\]|\\.)*)"\s*\)'
    r"(?:\s*@\w+(?:\([^)]*\))?)*"
    r"\s*(?:public|private|protected)?\s*"
    r"(?:<[^>]+>\s*)?[\w.<>\[\],\s]+?\s+(\w+)\s*\(",
    re.S,
)
SUREFIRE_ARG_SUFFIX_RE = re.compile(r"\(.*$")

JAVA_METHOD_TO_ID: dict[tuple[str, str], str] = {}


def _technique(rest: str) -> str:
    return rest.split(":", 1)[0].strip() if ":" in rest else rest.strip()


def scan_sources() -> dict[str, tuple[str, str]]:
    """id -> (technique, source path relative to the repo)."""
    found: dict[str, tuple[str, str]] = {}
    JAVA_METHOD_TO_ID.clear()

    for path in sorted(BACKEND_TESTS.rglob("*.java")):
        text = path.read_text(encoding="utf-8")
        class_name = path.stem
        rel = path.relative_to(REPO).as_posix()
        for raw, method in DISPLAY_NAME_WITH_METHOD_RE.findall(text):
            match = TITLE_RE.match(raw.replace('\\"', '"'))
            if not match:
                continue
            test_id = match.group(1)
            if test_id in found:
                raise SystemExit(f"duplicate Test ID {test_id} in {rel} and {found[test_id][1]}")
            found[test_id] = (_technique(match.group(2)), rel)
            JAVA_METHOD_TO_ID[(class_name, method)] = test_id
        # Catch annotations whose method declaration the regex could not parse.
        for raw in DISPLAY_NAME_RE.findall(text):
            match = TITLE_RE.match(raw.replace('\\"', '"'))
            if match and match.group(1) not in found:
                found[match.group(1)] = (_technique(match.group(2)), rel)

    return found


def load_meta() -> dict:
    return json.loads(META.read_text(encoding="utf-8"))


def surefire_results() -> dict[str, str]:
    """Test ID -> Pass | Fail | Skip from the surefire XML reports."""
    results: dict[str, str] = {}
    if not SUREFIRE.is_dir():
        return results
    for xml in SUREFIRE.glob("TEST-*.xml"):
        try:
            root = ET.fromstring(xml.read_bytes())
        except ET.ParseError:
            continue
        for case in root.iter("testcase"):
            name = case.get("name") or ""
            class_name = (case.get("classname") or "").rsplit(".", 1)[-1]
            title_match = TITLE_RE.match(name)
            if title_match:
                test_id = title_match.group(1)
            else:
                method = SUREFIRE_ARG_SUFFIX_RE.sub("", name)
                test_id = JAVA_METHOD_TO_ID.get((class_name, method))
            if not test_id:
                continue
            if case.find("failure") is not None or case.find("error") is not None:
                verdict = "Fail"
            elif case.find("skipped") is not None:
                verdict = "Skip"
            else:
                verdict = "Pass"
            if results.get(test_id) != "Fail":
                results[test_id] = verdict
    return results


def check(meta: dict, sources: dict[str, tuple[str, str]]) -> int:
    documented = {test_id for sheet in meta["sheets"] for test_id in sheet["rows"]}
    in_code = set(sources)
    problems: list[str] = []

    for test_id in sorted(in_code - documented):
        problems.append(f"  in code but not in l2-testcases.json: {test_id}  ({sources[test_id][1]})")
    for test_id in sorted(documented - in_code):
        problems.append(f"  in l2-testcases.json but not in any test source: {test_id}")

    for sheet in meta["sheets"]:
        for test_id, row in sheet["rows"].items():
            technique = row.get("technique") or sources.get(test_id, ("", ""))[0]
            for part in re.split(r"\s*\+\s*", technique):
                if part not in TECHNIQUES:
                    problems.append(
                        f"  Coverage Technique part {part!r} not in the brief's enum: {test_id}")
            if not row.get("srs"):
                problems.append(f"  empty SRS Reference: {test_id}")
            if not row.get("feature"):
                problems.append(f"  empty Feature: {test_id}")
            if row.get("p") not in {"P1", "P2", "P3"}:
                problems.append(f"  Priority must be P1/P2/P3: {test_id} -> {row.get('p')!r}")
            if row.get("n") not in {"Yes", "No"}:
                problems.append(f"  Negative? must be Yes/No: {test_id} -> {row.get('n')!r}")
            override = row.get("statusOverride")
            if override and override not in {"Blocked", "Skip", "Not Run"}:
                problems.append(f"  statusOverride must be Blocked/Skip/Not Run: {test_id}")

    # The brief: a Negative? ratio under one quarter almost certainly means missing error paths.
    rows = [row for sheet in meta["sheets"] for row in sheet["rows"].values()]
    negatives = sum(1 for row in rows if row.get("n") == "Yes")
    if rows and negatives * 4 < len(rows):
        problems.append(
            f"  Negative? ratio {negatives}/{len(rows)} is below 1/4 — add error-path rows")

    if problems:
        print(f"FAIL - {len(problems)} problem(s):")
        print("\n".join(problems))
        return 1
    print(f"OK - {len(in_code)} test IDs match between the sources and l2-testcases.json "
          f"(Negative {negatives}/{len(rows)})")
    return 0


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
            if status == "Fail" and not defect:
                found = re.search(r"\bD\d+\b", row.get("notes", ""))
                defect = found.group(0) if found else ""
            tallies[status] = tallies.get(status, 0) + 1
            rows.append([
                test_id,
                technique,
                row["srs"],
                row["feature"],
                row["p"],
                row["services"],
                row["infra"],
                row.get("mocks", "None"),
                row["g"].replace("\\n", "\n"),
                row["w"].replace("\\n", "\n"),
                row["t"].replace("\\n", "\n"),
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
        print(f"  {out.relative_to(REPO).as_posix():<62} {cases:>3} cases")
    summary = ", ".join(f"{k}={v}" for k, v in tallies.items() if v)
    print(f"  {'TOTAL':<62} {total:>3} cases   ({summary})")


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

    results = surefire_results()
    if not results:
        print("WARNING: no surefire reports found - Status will be 'Not Run' for every row.")
        print(f"  expected {SUREFIRE.relative_to(REPO).as_posix()}/TEST-*.xml")
    build(meta, sources, results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
