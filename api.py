"""롤링페이퍼 API — FastAPI."""
from __future__ import annotations

import os
from html import escape
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from db import DB, MESSAGE_MAX, NAME_MAX

STATIC_DIR = Path(__file__).parent / "static"
ASSETS = ("style.css", "app.js")


def _asset_version() -> str:
    """정적 파일이 바뀌면 브라우저가 옛 캐시를 쓰지 않도록 붙이는 값."""
    latest = max((STATIC_DIR / name).stat().st_mtime_ns for name in ASSETS)
    return str(latest // 1_000_000_000)

app = FastAPI(title="롤링페이퍼")
db = DB()


# ══════════════════════════════════════════════════════════════════════════════
# 스키마
# ══════════════════════════════════════════════════════════════════════════════

class NotePayload(BaseModel):
    name: str = Field(min_length=1, max_length=NAME_MAX)
    message: str = Field(min_length=1, max_length=MESSAGE_MAX)


def _clean(text: str) -> str:
    return text.strip()


# ══════════════════════════════════════════════════════════════════════════════
# 엔드포인트
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/messages")
def list_messages() -> dict:
    notes = db.list_notes()
    return {"messages": [n.to_dict() for n in notes], "count": len(notes)}


@app.post("/api/messages", status_code=201)
def create_message(payload: NotePayload) -> dict:
    name, message = _clean(payload.name), _clean(payload.message)
    if not name or not message:
        raise HTTPException(400, "이름과 메시지를 입력해 주세요.")
    return {"message": db.create(name, message).to_dict()}


@app.put("/api/messages/{note_id}")
def update_message(note_id: int, payload: NotePayload) -> dict:
    if not db.exists(note_id):
        raise HTTPException(404, "메시지를 찾을 수 없습니다.")
    name, message = _clean(payload.name), _clean(payload.message)
    if not name or not message:
        raise HTTPException(400, "이름과 메시지를 입력해 주세요.")
    return {"message": db.update(note_id, name, message).to_dict()}


@app.delete("/api/messages/{note_id}")
def delete_message(note_id: int) -> dict:
    if not db.exists(note_id):
        raise HTTPException(404, "메시지를 찾을 수 없습니다.")
    db.delete(note_id)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# 페이지 — 문구를 환경변수로 채워서 내보낸다 (Railway Variables)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    """첫 화면부터 설정한 문구가 보이도록 서버에서 치환한다.

    JS로 나중에 덮어쓰면 새로고침 직후 잠깐 기본 문구가 보이기 때문.
    """
    fields = {
        "title": os.environ.get("PAPER_TITLE", "결혼을 축하합니다"),
        "subtitle": os.environ.get(
            "PAPER_SUBTITLE", "두 사람의 새로운 시작에 따뜻한 한마디를 남겨주세요"
        ),
        "couple": os.environ.get("PAPER_COUPLE", ""),
        "date": os.environ.get("PAPER_DATE", ""),
        "count": str(len(db.list_notes())),
        "v": _asset_version(),
    }
    html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    for key, value in fields.items():
        html = html.replace("{{" + key + "}}", escape(value.strip()))
    return HTMLResponse(html, headers={"Cache-Control": "no-cache"})


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
