"""롤링페이퍼 저장소 — SQLite."""
from __future__ import annotations

import logging
import os
import sqlite3
import threading
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("uvicorn.error")

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


class DB:
    def __init__(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if not os.environ.get("DATA_DIR"):
            log.warning(
                "DATA_DIR가 설정되지 않아 %s에 저장합니다. "
                "배포 환경이라면 영구 볼륨 경로를 DATA_DIR로 지정하세요. "
                "그러지 않으면 재배포할 때 메시지가 모두 사라집니다.",
                DATA_DIR,
            )
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
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._migrate_drop_pin()
            self._conn.commit()

    def _migrate_drop_pin(self) -> None:
        """비밀번호 도입 이전 버전의 테이블에서 인증 컬럼을 걷어낸다."""
        cols = {r["name"] for r in self._conn.execute("PRAGMA table_info(notes)")}
        if "pin_hash" not in cols:
            return
        self._conn.executescript(
            """
            CREATE TABLE notes_new (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                message    TEXT NOT NULL,
                color      INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            INSERT INTO notes_new (id, name, message, color, created_at, updated_at)
                SELECT id, name, message, color, created_at, updated_at FROM notes;
            DROP TABLE notes;
            ALTER TABLE notes_new RENAME TO notes;
            """
        )

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

    def get(self, note_id: int) -> Note | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT id, name, message, color, created_at, updated_at "
                "FROM notes WHERE id = ?",
                (note_id,),
            ).fetchone()
        return Note(**dict(row)) if row else None

    def exists(self, note_id: int) -> bool:
        return self.get(note_id) is not None

    # ──────────────────────────────────────────────────────────────────────
    # 쓰기
    # ──────────────────────────────────────────────────────────────────────

    def create(self, name: str, message: str) -> Note:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            color = self._conn.execute(
                "SELECT COUNT(*) FROM notes"
            ).fetchone()[0] % COLOR_COUNT
            cur = self._conn.execute(
                "INSERT INTO notes (name, message, color, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (name, message, color, now, now),
            )
            self._conn.commit()
            note_id = cur.lastrowid
        return Note(note_id, name, message, color, now, now)

    def update(self, note_id: int, name: str, message: str) -> Note | None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._conn.execute(
                "UPDATE notes SET name = ?, message = ?, updated_at = ? WHERE id = ?",
                (name, message, now, note_id),
            )
            self._conn.commit()
        return self.get(note_id)

    def delete(self, note_id: int) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
            self._conn.commit()
