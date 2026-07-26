#!/usr/bin/env python3
"""Build the L1 unit-test CSVs for Report 5.2 and sync their Status column.

Single source of truth split:
  * Test ID, Coverage Technique and Covers come from the @DisplayName / it() strings in the test
    sources, so they can never drift from the code.
  * SRS Reference, Priority, Given/When/Then, Negative? and Notes come from
    docs/l1-unit-tests/l1-testcases.json.
  * Status and Defect ID come from the latest test reports (surefire XML + vitest JSON).

Usage:
    python scripts/l1-testcases.py build     # regenerate docs/l1-unit-tests/*.csv
    python scripts/l1-testcases.py check     # validate IDs both ways, exit 1 on mismatch
    python scripts/l1-testcases.py status    # refresh only Status / Defect ID in the CSVs

Stdlib only - openpyxl is not required (and not installed).
"""

from __future__ import annotations

import csv
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / "docs" / "l1-unit-tests"
META = DOCS / "l1-testcases.json"
BACKEND_TESTS = REPO / "carehub-backend" / "src" / "test" / "java"
FRONTEND_SRC = REPO / "carehub-frontend" / "src"
SUREFIRE = REPO / "carehub-backend" / "target" / "surefire-reports"
VITEST_JSON = REPO / "carehub-frontend" / "vitest-report.json"

COLUMNS = [
    "Test ID",
    "Coverage Technique",
    "Covers (Decision/Condition)",
    "SRS Reference",
    "Priority",
    "Given (Precondition / Mock Setup)",
    "When (Input / Act)",
    "Then (Expected Output / Assert)",
    "Negative?",
    "Status",
    "Defect ID",
    "Notes",
]

# Matches "L1-XXX-01 | Technique: covers text" inside a @DisplayName("...") or an it('...') title.
TITLE_RE = re.compile(r"(L1-[A-Z]+-\d+)\s*\|\s*(.*)")
DISPLAY_NAME_RE = re.compile(r'@DisplayName\(\s*"((?:[^"\\]|\\.)*)"\s*\)')
JS_TITLE_RE = re.compile(r"""(?:it|test)(?:\.each\([^)]*\))?\(\s*(['"])((?:(?!\1).)*)\1""", re.S)

# Surefire writes the JUnit method name, not the @DisplayName, so the Java method declared right
# after each annotation is captured to bridge the two. Parameterized invocations arrive as
# "methodName(ArgType)[1]", hence the suffix strip in surefire_results().
DISPLAY_NAME_WITH_METHOD_RE = re.compile(
    r'@DisplayName\(\s*"((?:[^"\\]|\\.)*)"\s*\)'      # the display name
    r'(?:\s*@\w+(?:\([^)]*\))?)*'                     # any further annotations
    r'\s*(?:public|private|protected)?\s*'
    r'(?:<[^>]+>\s*)?[\w.<>\[\],\s]+?\s+(\w+)\s*\(',  # return type + method name
    re.S,
)
SUREFIRE_ARG_SUFFIX_RE = re.compile(r"\(.*$")

# IDs whose technique cannot be derived from the title prefix (the title says only "Negative",
# which the dedicated Negative? column already carries).
TECHNIQUE_OVERRIDES = {
    "L1-DUP-01": "BVA",
    "L1-TRSM-16": "BC-FALSE",
    "L1-SEC-13": "BC-FALSE",
    "L1-BV-04": "BVA-Max+1",
}

# " + Negative" duplicates the Negative? column and " + DC-xx" duplicates SRS Reference, so both
# are dropped from the technique value to keep it inside the template's vocabulary.
TECHNIQUE_NOISE_RE = re.compile(r"\s*\+\s*(?:Negative|(?:AC|NAC|BR|BV|DC|FR|FT)-\d+[a-z]*)\s*$")


def _split_title(rest: str) -> tuple[str, str]:
    """"Technique: covers" -> ("Technique", "covers"). Falls back to the whole string."""
    if ":" in rest:
        technique, covers = rest.split(":", 1)
        return technique.strip(), covers.strip()
    return rest.strip(), rest.strip()


JAVA_METHOD_TO_ID: dict[tuple[str, str], str] = {}


def scan_sources() -> dict[str, tuple[str, str, str]]:
    """id -> (technique, covers, source path relative to the repo).

    Also populates JAVA_METHOD_TO_ID with (simpleClassName, methodName) -> test id.
    """
    found: dict[str, tuple[str, str, str]] = {}
    JAVA_METHOD_TO_ID.clear()

    def record(test_id: str, rest: str, path: Path) -> None:
        technique, covers = _split_title(rest)
        technique = TECHNIQUE_OVERRIDES.get(test_id, TECHNIQUE_NOISE_RE.sub("", technique))
        rel = path.relative_to(REPO).as_posix()
        if test_id in found:
            raise SystemExit(f"duplicate Test ID {test_id} in {rel} and {found[test_id][2]}")
        found[test_id] = (technique, covers, rel)

    for path in sorted(BACKEND_TESTS.rglob("*.java")):
        text = path.read_text(encoding="utf-8")
        class_name = path.stem
        for raw, method in DISPLAY_NAME_WITH_METHOD_RE.findall(text):
            match = TITLE_RE.match(raw.replace('\\"', '"'))
            if match:
                record(match.group(1), match.group(2), path)
                JAVA_METHOD_TO_ID[(class_name, method)] = match.group(1)
        # Catch any annotation whose method could not be parsed, so `check` still reports it.
        for raw in DISPLAY_NAME_RE.findall(text):
            match = TITLE_RE.match(raw.replace('\\"', '"'))
            if match and match.group(1) not in found:
                record(match.group(1), match.group(2), path)

    for path in sorted(FRONTEND_SRC.rglob("*.test.js")):
        text = path.read_text(encoding="utf-8")
        for _, raw in JS_TITLE_RE.findall(text):
            match = TITLE_RE.match(raw)
            if match:
                record(match.group(1), match.group(2), path)

    return found


def load_meta() -> dict:
    return json.loads(META.read_text(encoding="utf-8"))


def surefire_results() -> dict[str, str]:
    """Test ID -> Pass | Fail | Skip, from the surefire XML reports."""
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
            # Surefire may write either the raw method name (default) or the @DisplayName
            # (when usePhrasedTestCaseMethodName is enabled) - handle both.
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
            # A parameterized method contributes several <testcase> entries; one failing
            # invocation fails the whole row.
            if results.get(test_id) != "Fail":
                results[test_id] = verdict
    return results


def vitest_results() -> dict[str, str]:
    """Test ID -> Pass | Fail | Skip, from the vitest JSON reporter output."""
    results: dict[str, str] = {}
    if not VITEST_JSON.is_file():
        return results
    report = json.loads(VITEST_JSON.read_text(encoding="utf-8"))
    for suite in report.get("testResults", []):
        for case in suite.get("assertionResults", []):
            match = TITLE_RE.match(case.get("title") or "")
            if not match:
                continue
            test_id = match.group(1)
            raw = case.get("status")
            verdict = {"passed": "Pass", "failed": "Fail"}.get(raw, "Skip")
            if results.get(test_id) != "Fail":
                results[test_id] = verdict
    return results


def check(meta: dict, sources: dict[str, tuple[str, str, str]]) -> int:
    documented = {
        test_id
        for sheet in meta["sheets"]
        for test_id in sheet["rows"]
    }
    in_code = set(sources)
    problems = []
    for test_id in sorted(in_code - documented):
        problems.append(f"  in code but not in l1-testcases.json: {test_id}  ({sources[test_id][2]})")
    for test_id in sorted(documented - in_code):
        problems.append(f"  in l1-testcases.json but not in any test source: {test_id}")

    for sheet in meta["sheets"]:
        for test_id, row in sheet["rows"].items():
            if not row.get("srs"):
                problems.append(f"  empty SRS Reference: {test_id}")
            if row.get("p") not in {"P1", "P2", "P3"}:
                problems.append(f"  Priority must be P1/P2/P3: {test_id} -> {row.get('p')!r}")
            if row.get("n") not in {"Yes", "No"}:
                problems.append(f"  Negative? must be Yes/No: {test_id} -> {row.get('n')!r}")

    if problems:
        print(f"FAIL - {len(problems)} problem(s):")
        print("\n".join(problems))
        return 1
    print(f"OK - {len(in_code)} test IDs match between the sources and l1-testcases.json")
    return 0


def build(meta: dict, sources: dict[str, tuple[str, str, str]], results: dict[str, str]) -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    total = 0
    for sheet in meta["sheets"]:
        out = DOCS / f"{sheet['name']}.csv"
        rows = []
        for test_id, row in sheet["rows"].items():
            technique, covers, _ = sources[test_id]
            if row.get("block"):
                rows.append([f"  ▶  {row['block']}"] + [""] * (len(COLUMNS) - 1))
            status = results.get(test_id, "Not Run")
            defect = row.get("defect", "")
            if status == "Fail" and not defect:
                # Surface the defect id already named in the Notes column, if any.
                found = re.search(r"\bD\d+\b", row.get("notes", ""))
                defect = found.group(0) if found else ""
            rows.append([
                test_id,
                row.get("technique", technique),
                covers,
                row["srs"],
                row["p"],
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
        print(f"  {out.relative_to(REPO).as_posix():<58} {cases:>3} cases")
    print(f"  {'TOTAL':<58} {total:>3} cases")


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
        print("\nRefusing to write CSVs while IDs are out of sync.")
        return exit_code

    results = {**surefire_results(), **vitest_results()}
    if not results:
        print("WARNING: no test reports found - Status will be 'Not Run' for every row.")
        print(f"  expected {SUREFIRE.relative_to(REPO).as_posix()}/TEST-*.xml")
        print(f"  expected {VITEST_JSON.relative_to(REPO).as_posix()}")
    else:
        counts: dict[str, int] = {}
        for verdict in results.values():
            counts[verdict] = counts.get(verdict, 0) + 1
        missing = len(sources) - len(results)
        summary = ", ".join(f"{k}={v}" for k, v in sorted(counts.items()))
        print(f"Test reports: {summary}, not reported={missing}")

    build(meta, sources, results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
