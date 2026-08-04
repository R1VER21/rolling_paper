"""롤링페이퍼 API — FastAPI."""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from db import DB, MESSAGE_MAX, NAME_MAX

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="롤링페이퍼")
db = DB()


# ══════════════════════════════════════════════════════════════════════════════
# 스키마
# ══════════════════════════════════════════════════════════════════════════════

class NoteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=NAME_MAX)
    message: str = Field(min_length=1, max_length=MESSAGE_MAX)
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")


class NoteUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=NAME_MAX)
    message: str = Field(min_length=1, max_length=MESSAGE_MAX)
    pin: str | None = Field(default=None, pattern=r"^\d{4}$")
    token: str | None = None


class NoteAuth(BaseModel):
    pin: str | None = Field(default=None, pattern=r"^\d{4}$")
    token: str | None = None


def _clean(text: str) -> str:
    return text.strip()


# ══════════════════════════════════════════════════════════════════════════════
# 엔드포인트
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/config")
def get_config() -> dict:
    """제목·부제는 환경변수로 바꿀 수 있다 (Railway Variables)."""
    return {
        "title": os.environ.get("PAPER_TITLE", "결혼을 축하합니다"),
        "subtitle": os.environ.get(
            "PAPER_SUBTITLE", "두 사람의 새로운 시작에 따뜻한 한마디를 남겨주세요"
        ),
        "couple": os.environ.get("PAPER_COUPLE", ""),
        "date": os.environ.get("PAPER_DATE", ""),
        "name_max": NAME_MAX,
        "message_max": MESSAGE_MAX,
    }


@app.get("/api/messages")
def list_messages() -> dict:
    notes = db.list_notes()
    return {"messages": [n.to_dict() for n in notes], "count": len(notes)}


@app.post("/api/messages", status_code=201)
def create_message(payload: NoteCreate) -> dict:
    name, message = _clean(payload.name), _clean(payload.message)
    if not name or not message:
        raise HTTPException(400, "이름과 메시지를 입력해 주세요.")
    note, token = db.create(name, message, payload.pin)
    return {"message": note.to_dict(), "token": token}


@app.put("/api/messages/{note_id}")
def update_message(note_id: int, payload: NoteUpdate) -> dict:
    if not db.exists(note_id):
        raise HTTPException(404, "메시지를 찾을 수 없습니다.")
    if not db.authorize(note_id, payload.pin, payload.token):
        raise HTTPException(403, "비밀번호가 맞지 않습니다.")
    name, message = _clean(payload.name), _clean(payload.message)
    if not name or not message:
        raise HTTPException(400, "이름과 메시지를 입력해 주세요.")
    note = db.update(note_id, name, message)
    return {"message": note.to_dict()}


@app.post("/api/messages/{note_id}/verify")
def verify_message(note_id: int, payload: NoteAuth) -> dict:
    if not db.exists(note_id):
        raise HTTPException(404, "메시지를 찾을 수 없습니다.")
    if not db.authorize(note_id, payload.pin, payload.token):
        raise HTTPException(403, "비밀번호가 맞지 않습니다.")
    return {"ok": True}


@app.post("/api/messages/{note_id}/delete")
def delete_message(note_id: int, payload: NoteAuth) -> dict:
    if not db.exists(note_id):
        raise HTTPException(404, "메시지를 찾을 수 없습니다.")
    if not db.authorize(note_id, payload.pin, payload.token):
        raise HTTPException(403, "비밀번호가 맞지 않습니다.")
    db.delete(note_id)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# 정적 파일
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
