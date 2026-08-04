"""롤링페이퍼 저장소 — SQLite."""
from __future__ import annotations

import hashlib
import os
import sqlite3
import threading
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent / "data"))
DB_PATH = DATA_DIR / "rolling_paper.db"

NAME_MAX = 20
MESSAGE_MAX = 300
COLOR_COUNT = 6


@dataclass
class Note:
    id: int
    name: str
    message: str
    color: int
    created_at: str
    updated_at: str

    def to_dict(self) -> dict:
        return asdict(self)


def _hash_pin(pin: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{pin}".encode()).hexdigest()


class DB:
    def __init__(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    def _init_schema(self) -> None:
        with self._lock:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS notes (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    name       TEXT NOT NULL,
                    message    TEXT NOT NULL,
                    color      INTEGER NOT NULL DEFAULT 0,
                    pin_salt   TEXT NOT NULL,
                    pin_hash   TEXT NOT NULL,
                    token      TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.commit()

    # ──────────────────────────────────────────────────────────────────────
    # 조회
    # ──────────────────────────────────────────────────────────────────────

    def list_notes(self) -> list[Note]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT id, name, message, color, created_at, updated_at "
                "FROM notes ORDER BY id ASC"
            ).fetchall()
        return [Note(**dict(r)) for r in rows]

    def _get_raw(self, note_id: int) -> sqlite3.Row | None:
        with self._lock:
            return self._conn.execute(
                "SELECT * FROM notes WHERE id = ?", (note_id,)
            ).fetchone()

    # ──────────────────────────────────────────────────────────────────────
    # 쓰기
    # ──────────────────────────────────────────────────────────────────────

    def create(self, name: str, message: str, pin: str) -> tuple[Note, str]:
        now = datetime.now(timezone.utc).isoformat()
        salt = uuid.uuid4().hex
        token = uuid.uuid4().hex
        with self._lock:
            color = self._conn.execute(
                "SELECT COUNT(*) FROM notes"
            ).fetchone()[0] % COLOR_COUNT
            cur = self._conn.execute(
                "INSERT INTO notes (name, message, color, pin_salt, pin_hash, "
                "token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (name, message, color, salt, _hash_pin(pin, salt), token, now, now),
            )
            self._conn.commit()
            note_id = cur.lastrowid
        return Note(note_id, name, message, color, now, now), token

    def update(self, note_id: int, name: str, message: str) -> Note | None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._conn.execute(
                "UPDATE notes SET name = ?, message = ?, updated_at = ? WHERE id = ?",
                (name, message, now, note_id),
            )
            self._conn.commit()
        row = self._get_raw(note_id)
        if row is None:
            return None
        return Note(
            row["id"], row["name"], row["message"], row["color"],
            row["created_at"], row["updated_at"],
        )

    def delete(self, note_id: int) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
            self._conn.commit()

    # ──────────────────────────────────────────────────────────────────────
    # 권한
    # ──────────────────────────────────────────────────────────────────────

    def authorize(self, note_id: int, pin: str | None, token: str | None) -> bool:
        """토큰(같은 브라우저) 또는 비밀번호가 맞으면 수정·삭제 허용."""
        row = self._get_raw(note_id)
        if row is None:
            return False
        if token and token == row["token"]:
            return True
        if pin and _hash_pin(pin, row["pin_salt"]) == row["pin_hash"]:
            return True
        return False

    def exists(self, note_id: int) -> bool:
        return self._get_raw(note_id) is not None
