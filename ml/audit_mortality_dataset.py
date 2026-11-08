"""Audit whether the public Mendeley tilapia workbook has next-day outcomes.

Usage: python ml/audit_mortality_dataset.py path/to/Data_Model_IoTMLCQ_2024.xlsx
No spreadsheet package is required, and the source workbook stays outside Git.
"""

import argparse
import collections
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile


NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def audit(path: Path) -> dict:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as book:
        shared = ["".join(item.itertext()) for item in ET.fromstring(book.read("xl/sharedStrings.xml"))]
        sheet = ET.fromstring(book.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//x:sheetData/x:row", NS):
            values = {}
            for cell in row.findall("x:c", NS):
                raw = cell.find("x:v", NS)
                if raw is None:
                    continue
                column = "".join(char for char in cell.attrib["r"] if char.isalpha())
                values[column] = shared[int(raw.text)] if cell.attrib.get("t") == "s" else raw.text
            rows.append(values)

    headers = rows[0]
    months = collections.Counter(row.get("A", "") for row in rows[1:])
    survival = {
        month: sorted({row.get("C", "") for row in rows[1:] if row.get("A") == month})
        for month in months
    }
    column_names = list(headers.values())
    return {
        "sha256": digest,
        "data_rows": len(rows) - 1,
        "columns": column_names,
        "rows_by_month": dict(sorted(months.items())),
        "survival_values_by_month": dict(sorted(survival.items())),
        "has_pond_or_batch_id": any("pond id" in name.lower() or "batch id" in name.lower() for name in column_names),
        "has_daily_death_count": any("dead fish" in name.lower() or "daily death" in name.lower() for name in column_names),
        "eligible_for_24_hour_mortality_validation": False,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    args = parser.parse_args()
    print(json.dumps(audit(args.workbook), indent=2, ensure_ascii=False))
