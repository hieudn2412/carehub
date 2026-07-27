#!/usr/bin/env python3
"""Build the L3 system/API-test CSVs for Report 5.3 and sync their Status column.

Same pipeline as scripts/l1-testcases.py and scripts/l2-testcases.py, adapted to the L3 contract
from docs/L2-L3-TESTCASE-BRIEF.md. The one structural difference: L3 uses **four different sheet
layouts**, so every sheet declares a "layout" and each layout has its own column list, its own
technique/category enum and its own row builder:

  api   15 columns  API-contract sheets  (L3-AuthAPI, L3-TrainingAPI, ...)
  flow  11 columns  L3-APIFlows
  perf  13 columns  L3-Performance       (no Negative? column)
  sec   12 columns  L3-Security          (OWASP Category instead of Coverage Technique)

Rows that have no Java test — the k6 scenarios and the ZAP-dependent security row — set
"code": false and must carry a "statusOverride"; `check` leaves them out of the two-way ID diff.

Sources of truth:
  * Test ID and Coverage Technique come from the @DisplayName strings in the test sources.
  * Everything else comes from docs/l3-system-api-tests/l3-testcases.json.
  * Status/Defect ID come from the latest surefire reports (unless statusOverride is set).

Usage:
    python scripts/l3-testcases.py build     # regenerate docs/l3-system-api-tests/*.csv
    python scripts/l3-testcases.py check     # validate IDs both ways, exit 1 on mismatch
    python scripts/l3-testcases.py status    # alias of build (kept for parity with l1/l2)

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
DOCS = REPO / "docs" / "l3-system-api-tests"
META = DOCS / "l3-testcases.json"
BACKEND_TESTS = REPO / "carehub-backend" / "src" / "test" / "java"
SUREFIRE = REPO / "carehub-backend" / "target" / "surefire-reports"

API_COLUMNS = [
    "Test ID",
    "Coverage Technique",
    "SRS Reference",
    "Feature",
    "Priority",
    "HTTP Method + Endpoint",
    "Auth Required",
    "Request (Params / Body / Headers)",
    "Expected HTTP Status",
    "Expected Response Body",
    "Expected Error Code",
    "Negative?",
    "Status",
    "Defect ID",
    "Notes",
]

FLOW_COLUMNS = [
    "Test ID",
    "Coverage Technique",
    "SRS Reference",
    "Feature",
    "Priority",
    "Flow Steps (HTTP Calls in order)",
    "Expected State After Each Step",
    "Negative?",
    "Status",
    "Defect ID",
    "Notes",
]

PERF_COLUMNS = [
    "Test ID",
    "Test Type",
    "SRS Reference",
    "Priority",
    "Endpoint(s) Under Test",
    "k6 Config (VUs / Duration / Ramp)",
    "Auth Setup",
    "Expected Threshold (k6 assertion)",
    "Baseline (previous run)",
    "Actual Result",
    "Status",
    "Defect ID",
    "Notes",
]

SEC_COLUMNS = [
    "Test ID",
    "OWASP Category",
    "SRS Reference",
    "Priority",
    "Attack Vector / Test Description",
    "Tool",
    "Request / Payload",
    "Expected Safe Response",
    "Negative?",
    "Status",
    "Defect ID",
    "Notes",
]

API_TECHNIQUES = {
    "Input-Domain-Happy",
    "Input-Domain-Invalid",
    "Auth-Missing",
    "Auth-Expired",
    "Auth-Wrong-Role",
    "Validation",
    "State-Conflict",
    "Not-Found",
    "Pagination",
    "Contract",
    # Used by the read-side analytics sheet for aggregate-shape assertions.
    "Query-Correctness",
}
FLOW_TECHNIQUES = {"Multi-step Flow", "BVA", "Negative"}
PERF_TYPES = {"Load", "Stress", "Spike", "Soak"}
OWASP_CATEGORIES = {
    "A01 Access Control",
    "A02 Cryptographic Failures",
    "A03 Injection",
    "A05 Security Misconfiguration",
    "A07 Auth Failures",
    "A09 Logging",
}

LAYOUTS = {
    "api": (API_COLUMNS, API_TECHNIQUES),
    "flow": (FLOW_COLUMNS, FLOW_TECHNIQUES),
    "perf": (PERF_COLUMNS, PERF_TYPES),
    "sec": (SEC_COLUMNS, OWASP_CATEGORIES),
}

# Matches "L3-XXX-01 | Technique: description" inside a @DisplayName("...").
TITLE_RE = re.compile(r"(L3-[A-Z]+-\d+)\s*\|\s*(.*)")
DISPLAY_NAME_RE = re.compile(r'@DisplayName\(\s*"((?:[^"\\]|\\.)*)"\s*\)')

# Surefire writes the JUnit method name, not the @DisplayName; capture the method declared right
# after each annotation block to bridge the two (same regex as the l1/l2 scripts).
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
    problems: list[str] = []
    documented: set[str] = set()
    coded: set[str] = set()

    for sheet in meta["sheets"]:
        layout = sheet.get("layout")
        if layout not in LAYOUTS:
            problems.append(f"  sheet {sheet.get('name')!r} has an unknown layout {layout!r}")
            continue
        _, allowed = LAYOUTS[layout]
        for test_id, row in sheet["rows"].items():
            documented.add(test_id)
            has_code = row.get("code", True)
            if has_code:
                coded.add(test_id)
            elif not row.get("statusOverride"):
                problems.append(f"  {test_id} has \"code\": false but no statusOverride")

            technique = row.get("technique") or sources.get(test_id, ("", ""))[0]
            if not technique:
                problems.append(f"  no Coverage Technique / category: {test_id}")
            for part in re.split(r"\s*\+\s*", technique):
                if part and part not in allowed:
                    problems.append(
                        f"  {layout} value {part!r} not allowed for that layout: {test_id}")
            if not row.get("srs"):
                problems.append(f"  empty SRS Reference: {test_id}")
            if layout in {"api", "flow"} and not row.get("feature"):
                problems.append(f"  empty Feature: {test_id}")
            if row.get("p") not in {"P1", "P2", "P3"}:
                problems.append(f"  Priority must be P1/P2/P3: {test_id} -> {row.get('p')!r}")
            if layout != "perf" and row.get("n") not in {"Yes", "No"}:
                problems.append(f"  Negative? must be Yes/No: {test_id} -> {row.get('n')!r}")
            override = row.get("statusOverride")
            if override and override not in {"Blocked", "Skip", "Not Run"}:
                problems.append(f"  statusOverride must be Blocked/Skip/Not Run: {test_id}")

    in_code = set(sources)
    for test_id in sorted(in_code - documented):
        problems.append(f"  in code but not in l3-testcases.json: {test_id}  ({sources[test_id][1]})")
    for test_id in sorted(coded - in_code):
        problems.append(f"  in l3-testcases.json but not in any test source: {test_id}")

    # The brief: a Negative? ratio under one quarter almost certainly means missing error paths.
    rows = [row for sheet in meta["sheets"] if sheet.get("layout") != "perf"
            for row in sheet["rows"].values()]
    negatives = sum(1 for row in rows if row.get("n") == "Yes")
    if rows and negatives * 4 < len(rows):
        problems.append(
            f"  Negative? ratio {negatives}/{len(rows)} is below 1/4 — add error-path rows")

    if problems:
        print(f"FAIL - {len(problems)} problem(s):")
        print("\n".join(problems))
        return 1
    print(f"OK - {len(coded)} coded test IDs match between the sources and l3-testcases.json "
          f"({len(documented) - len(coded)} documentation-only rows, Negative {negatives}/{len(rows)})")
    return 0


def _nl(value: str) -> str:
    return value.replace("\\n", "\n")


def build_row(layout: str, test_id: str, row: dict, technique: str, status: str, defect: str) -> list[str]:
    if layout == "api":
        return [
            test_id, technique, row["srs"], row["feature"], row["p"],
            row["endpoint"], row["auth"], _nl(row["request"]),
            row["httpStatus"], _nl(row["responseBody"]), row.get("errorCode", "None"),
            row["n"], status, defect, row.get("notes", ""),
        ]
    if layout == "flow":
        return [
            test_id, technique, row["srs"], row["feature"], row["p"],
            _nl(row["steps"]), _nl(row["expected"]),
            row["n"], status, defect, row.get("notes", ""),
        ]
    if layout == "perf":
        return [
            test_id, technique, row["srs"], row["p"],
            _nl(row["endpoint"]), _nl(row["config"]), _nl(row["auth"]),
            _nl(row["threshold"]), row.get("baseline", ""), row.get("actual", ""),
            status, defect, row.get("notes", ""),
        ]
    return [
        test_id, technique, row["srs"], row["p"],
        _nl(row["vector"]), row["tool"], _nl(row["payload"]), _nl(row["safeResponse"]),
        row["n"], status, defect, row.get("notes", ""),
    ]


def build(meta: dict, sources: dict[str, tuple[str, str]], results: dict[str, str]) -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    total = 0
    tallies = {"Pass": 0, "Fail": 0, "Blocked": 0, "Skip": 0, "Not Run": 0}
    for sheet in meta["sheets"]:
        layout = sheet["layout"]
        columns, _ = LAYOUTS[layout]
        out = DOCS / f"{sheet['name']}.csv"
        rows = []
        for test_id, row in sheet["rows"].items():
            technique = row.get("technique") or sources[test_id][0]
            if row.get("block"):
                rows.append([f"  ▶  {row['block']}"] + [""] * (len(columns) - 1))
            status = row.get("statusOverride") or results.get(test_id, "Not Run")
            defect = row.get("defect", "")
            if status == "Fail" and not defect:
                found = re.search(r"\bD\d+\b", row.get("notes", ""))
                defect = found.group(0) if found else ""
            tallies[status] = tallies.get(status, 0) + 1
            rows.append(build_row(layout, test_id, row, technique, status, defect))
        with out.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.writer(handle, quoting=csv.QUOTE_ALL)
            writer.writerow([sheet["title"]] + [""] * (len(columns) - 1))
            writer.writerow(columns)
            writer.writerows(rows)
        cases = len(sheet["rows"])
        total += cases
        print(f"  {out.relative_to(REPO).as_posix():<58} {layout:<5} {cases:>3} cases")
    summary = ", ".join(f"{k}={v}" for k, v in tallies.items() if v)
    print(f"  {'TOTAL':<58} {'':<5} {total:>3} cases   ({summary})")


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
