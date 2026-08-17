#!/usr/bin/env python3
"""Stream ECDICT's CSV file into an indexed SQLite database."""

from __future__ import annotations

import argparse
import csv
import os
import sqlite3
import sys
from pathlib import Path


FIELDS = (
    "word", "phonetic", "definition", "translation", "pos", "collins",
    "oxford", "tag", "bnc", "frq", "exchange", "detail", "audio",
)


def build(source: Path, output: Path) -> int:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".sqlite.tmp")
    if temporary.exists():
        temporary.unlink()

    # Windows' C long is 32-bit even when Python integers are not.
    csv.field_size_limit(min(sys.maxsize, 2_147_483_647))
    connection = sqlite3.connect(temporary)
    connection.executescript(
        """
        PRAGMA journal_mode = OFF;
        PRAGMA synchronous = OFF;
        PRAGMA temp_store = MEMORY;
        CREATE TABLE entries (
            word TEXT NOT NULL COLLATE NOCASE,
            phonetic TEXT,
            definition TEXT,
            translation TEXT,
            pos TEXT,
            collins INTEGER,
            oxford INTEGER,
            tag TEXT,
            bnc INTEGER,
            frq INTEGER,
            exchange TEXT,
            detail TEXT,
            audio TEXT
        );
        """
    )
    insert = "INSERT OR REPLACE INTO entries VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
    total = 0
    batch: list[tuple[str, ...]] = []
    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            word = (row.get("word") or "").strip()
            if not word:
                continue
            batch.append(tuple((row.get(field) or "").strip() for field in FIELDS))
            if len(batch) >= 5000:
                connection.executemany(insert, batch)
                total += len(batch)
                batch.clear()
        if batch:
            connection.executemany(insert, batch)
            total += len(batch)

    connection.executescript(
        """
        CREATE UNIQUE INDEX idx_entries_word_nocase ON entries(word COLLATE NOCASE);
        ANALYZE;
        PRAGMA optimize;
        """
    )
    connection.commit()
    connection.close()
    os.replace(temporary, output)
    return total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    total = build(args.source, args.output)
    print(f"Imported {total:,} ECDICT rows into {args.output}")


if __name__ == "__main__":
    main()
