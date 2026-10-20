"""Compact view of docs/testing/test-cases/<feature>/*.md (rows are very long).

Usage:
  python .claude/scripts/test_cases.py f1            ID | Title | Requirement | Priority
  python .claude/scripts/test_cases.py f1 --data     reusable test data table
  python .claude/scripts/test_cases.py TC_F3_007     one case, every column
"""

import glob
import re
import sys

ROOT = "docs/testing/test-cases"


def table_rows(lines, first_header):
    header, rows = None, []
    for line in lines:
        if not line.startswith("|"):
            if header and rows:
                break
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if header is None:
            if cells[0] == first_header:
                header = cells
            continue
        if set("".join(cells)) <= set("- :"):
            continue
        rows.append(dict(zip(header, cells)))
    return rows


def load(feature):
    lines = []
    for path in sorted(glob.glob(f"{ROOT}/{feature}/*.md")):
        with open(path, encoding="utf-8") as handle:
            lines += handle.read().splitlines()
    return lines


def main(argv):
    sys.stdout.reconfigure(encoding="utf-8")
    if len(argv) < 2:
        print(__doc__)
        return 1
    target = argv[1]
    case = re.fullmatch(r"TC_(F\d)_\d+", target, re.IGNORECASE)
    feature = case.group(1).lower() if case else target.lower()
    lines = load(feature)
    if not lines:
        print(f"No test-case files under {ROOT}/{feature}/")
        return 1
    if "--data" in argv:
        for row in table_rows(lines, "Data ID"):
            print(" | ".join(row.values()))
        return 0
    rows = table_rows(lines, "Test Case ID")
    if case:
        for row in rows:
            if row.get("Test Case ID", "").upper() == target.upper():
                for key, value in row.items():
                    print(f"{key}: {value.replace('<br>', ' ')}")
                return 0
        print(f"{target} not found")
        return 1
    for row in rows:
        print(" | ".join(row.get(key, "") for key in ("Test Case ID", "Title", "Requirement", "Priority")))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
