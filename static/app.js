/* ══════════════════════════════════════════════════════════════════════
   결혼 축하 롤링페이퍼
   ═══════════════════════════════════════════════════════════════════ */

const MINE_KEY = 'rolling_paper_mine';
const POLL_MS = 12000;

const $ = (id) => document.getElementById(id);

const el = {
  board: $('board'),
  empty: $('empty'),
  count: $('noteCount'),

  fab: $('fabWrite'),
  overlay: $('overlay'),
  sheetTitle: $('sheetTitle'),
  sheetClose: $('sheetClose'),
  form: $('noteForm'),
  fName: $('fName'),
  fMessage: $('fMessage'),
  msgLen: $('msgLen'),
  formError: $('formError'),
  btnSubmit: $('btnSubmit'),
  btnCancel: $('btnCancel'),
  btnDelete: $('btnDelete'),

  toast: $('toast'),
};

/** @type {{mode: 'create'|'edit', id: number|null}} */
let editing = { mode: 'create', id: null };
let notes = [];
let renderedKey = '';
let toastTimer = null;

/* ── 내가 남긴 메시지 표시 (이 브라우저에서만 쓰는 목록) ──────────── */

function readMine() {
  try {
    const list = JSON.parse(localStorage.getItem(MINE_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeMine(list) {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(list));
  } catch { /* 표시용이라 실패해도 무방 */ }
}

function markMine(id) {
  const list = readMine();
  if (!list.includes(id)) writeMine([...list, id]);
}

function unmarkMine(id) {
  writeMine(readMine().filter((x) => x !== id));
}

const isMine = (id) => readMine().includes(id);

/* ── 통신 ─────────────────────────────────────────────────────────── */

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  try {
    body = await res.json();
  } catch { /* 본문 없음 */ }

  if (!res.ok) {
    const detail = body && body.detail;
    const message = typeof detail === 'string'
      ? detail
      : '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
    throw Object.assign(new Error(message), { status: res.status });
  }
  return body;
}

/* ── 렌더 ─────────────────────────────────────────────────────────── */

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function render() {
  const key = JSON.stringify(notes.map((n) => [n.id, n.name, n.message, n.updated_at]));
  if (key === renderedKey) return;
  renderedKey = key;

  el.count.textContent = notes.length;
  el.empty.hidden = notes.length > 0;

  el.board.innerHTML = notes.map((n, i) => {
    const mine = isMine(n.id) ? '<span class="note__mine">내 메시지</span>' : '';
    return `
      <article class="note note--${n.color}" style="animation-delay:${Math.min(i, 12) * 40}ms">
        ${mine}
        <p class="note__msg">${escapeHtml(n.message)}</p>
        <div class="note__foot">
          <p class="note__name">${escapeHtml(n.name)}</p>
          <button class="note__edit" type="button" data-edit="${n.id}">수정</button>
        </div>
      </article>`;
  }).join('');
}

async function load() {
  const data = await api('/api/messages');
  notes = data.messages;
  render();
}

/* ── 토스트 ───────────────────────────────────────────────────────── */

function toast(text) {
  el.toast.textContent = text;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2400);
}

/* ── 작성 · 수정 모달 ─────────────────────────────────────────────── */

function openSheet(mode, note = null) {
  editing = { mode, id: note ? note.id : null };

  el.sheetTitle.textContent = mode === 'create' ? '축하 메시지 남기기' : '메시지 수정하기';
  el.btnSubmit.textContent = mode === 'create' ? '남기기' : '수정 완료';
  el.btnDelete.hidden = mode === 'create';

  el.fName.value = note ? note.name : '';
  el.fMessage.value = note ? note.message : '';
  el.msgLen.textContent = el.fMessage.value.length;

  el.formError.hidden = true;
  el.overlay.hidden = false;
  setTimeout(() => el.fName.focus(), 60);
}

function closeSheet() {
  el.overlay.hidden = true;
  editing = { mode: 'create', id: null };
}

function showFormError(text) {
  el.formError.textContent = text;
  el.formError.hidden = false;
}

el.fMessage.addEventListener('input', () => {
  el.msgLen.textContent = el.fMessage.value.length;
});

el.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = el.fName.value.trim();
  const message = el.fMessage.value.trim();

  if (!name) return showFormError('이름을 입력해 주세요.');
  if (!message) return showFormError('메시지를 입력해 주세요.');

  el.formError.hidden = true;
  el.btnSubmit.disabled = true;

  try {
    if (editing.mode === 'create') {
      const data = await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ name, message }),
      });
      markMine(data.message.id);
      closeSheet();
      await load();
      toast('축하 메시지를 남겼어요 ✿');
    } else {
      await api(`/api/messages/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, message }),
      });
      closeSheet();
      await load();
      toast('메시지를 수정했어요');
    }
  } catch (err) {
    showFormError(err.message);
  } finally {
    el.btnSubmit.disabled = false;
  }
});

el.btnDelete.addEventListener('click', async () => {
  if (!editing.id) return;
  if (!confirm('이 메시지를 삭제할까요? 되돌릴 수 없어요.')) return;

  const id = editing.id;
  el.btnDelete.disabled = true;
  try {
    await api(`/api/messages/${id}`, { method: 'DELETE' });
    unmarkMine(id);
    closeSheet();
    await load();
    toast('메시지를 삭제했어요');
  } catch (err) {
    showFormError(err.message);
  } finally {
    el.btnDelete.disabled = false;
  }
});

/* ── 이벤트 연결 ──────────────────────────────────────────────────── */

el.board.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-edit]');
  if (!btn) return;
  const note = notes.find((n) => n.id === Number(btn.dataset.edit));
  if (note) openSheet('edit', note);
});

el.fab.addEventListener('click', () => openSheet('create'));
el.sheetClose.addEventListener('click', closeSheet);
el.btnCancel.addEventListener('click', closeSheet);

el.overlay.addEventListener('mousedown', (e) => {
  if (e.target === el.overlay) closeSheet();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !el.overlay.hidden) closeSheet();
});

/* ── 자동 새로고침 ────────────────────────────────────────────────── */

setInterval(() => {
  if (!el.overlay.hidden || document.hidden) return;
  load().catch(() => { /* 네트워크 일시 오류는 조용히 무시 */ });
}, POLL_MS);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) load().catch(() => {});
});

/* ── 시작 ─────────────────────────────────────────────────────────── */

load().catch(() => toast('메시지를 불러오지 못했어요'));
