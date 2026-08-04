/* ══════════════════════════════════════════════════════════════════════
   결혼 축하 롤링페이퍼
   ═══════════════════════════════════════════════════════════════════ */

const TOKEN_KEY = 'rolling_paper_tokens';
const POLL_MS = 12000;

const $ = (id) => document.getElementById(id);

const el = {
  board: $('board'),
  empty: $('empty'),
  count: $('noteCount'),
  heroTitle: $('heroTitle'),
  heroSub: $('heroSub'),
  heroCouple: $('heroCouple'),
  heroDate: $('heroDate'),

  fab: $('fabWrite'),
  overlay: $('overlay'),
  sheetTitle: $('sheetTitle'),
  sheetClose: $('sheetClose'),
  form: $('noteForm'),
  fName: $('fName'),
  fMessage: $('fMessage'),
  msgLen: $('msgLen'),
  pinField: $('pinField'),
  fPin: $('fPin'),
  formError: $('formError'),
  btnSubmit: $('btnSubmit'),
  btnCancel: $('btnCancel'),
  btnDelete: $('btnDelete'),

  pinOverlay: $('pinOverlay'),
  pinForm: $('pinForm'),
  fVerifyPin: $('fVerifyPin'),
  pinError: $('pinError'),
  pinClose: $('pinClose'),
  pinCancel: $('pinCancel'),

  toast: $('toast'),
};

/** @type {{mode: 'create'|'edit', id: number|null, pin: string|null}} */
let editing = { mode: 'create', id: null, pin: null };
let notes = [];
let renderedKey = '';
let toastTimer = null;

/* ── 내 메시지 토큰 ────────────────────────────────────────────────── */

function readTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveToken(id, token) {
  const tokens = readTokens();
  tokens[id] = token;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } catch { /* 저장 실패해도 비밀번호로 수정 가능 */ }
}

function dropToken(id) {
  const tokens = readTokens();
  delete tokens[id];
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } catch { /* noop */ }
}

const tokenOf = (id) => readTokens()[id] || null;

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
    const mine = tokenOf(n.id) ? '<span class="note__mine">내 메시지</span>' : '';
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

async function loadConfig() {
  try {
    const cfg = await api('/api/config');
    document.title = `${cfg.title} · 롤링페이퍼`;
    el.heroTitle.textContent = cfg.title;
    el.heroSub.textContent = cfg.subtitle;
    el.heroCouple.textContent = cfg.couple || '';
    el.heroDate.textContent = cfg.date || '';
  } catch { /* 기본 문구 유지 */ }
}

/* ── 토스트 ───────────────────────────────────────────────────────── */

function toast(text) {
  el.toast.textContent = text;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2400);
}

/* ── 작성 · 수정 모달 ─────────────────────────────────────────────── */

function openSheet(mode, note = null, pin = null) {
  editing = { mode, id: note ? note.id : null, pin };

  el.sheetTitle.textContent = mode === 'create' ? '축하 메시지 남기기' : '메시지 수정하기';
  el.btnSubmit.textContent = mode === 'create' ? '남기기' : '수정 완료';
  el.btnDelete.hidden = mode === 'create';
  el.pinField.hidden = mode === 'edit';

  el.fName.value = note ? note.name : '';
  el.fMessage.value = note ? note.message : '';
  el.fPin.value = '';
  el.msgLen.textContent = el.fMessage.value.length;

  el.formError.hidden = true;
  el.overlay.hidden = false;
  setTimeout(() => el.fName.focus(), 60);
}

function closeSheet() {
  el.overlay.hidden = true;
  editing = { mode: 'create', id: null, pin: null };
}

function showFormError(text) {
  el.formError.textContent = text;
  el.formError.hidden = false;
}

el.fMessage.addEventListener('input', () => {
  el.msgLen.textContent = el.fMessage.value.length;
});

el.fPin.addEventListener('input', () => {
  el.fPin.value = el.fPin.value.replace(/\D/g, '').slice(0, 4);
});

el.fVerifyPin.addEventListener('input', () => {
  el.fVerifyPin.value = el.fVerifyPin.value.replace(/\D/g, '').slice(0, 4);
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
      const pin = el.fPin.value;
      if (!/^\d{4}$/.test(pin)) {
        showFormError('수정용 비밀번호를 숫자 4자리로 입력해 주세요.');
        return;
      }
      const data = await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ name, message, pin }),
      });
      saveToken(data.message.id, data.token);
      closeSheet();
      await load();
      toast('축하 메시지를 남겼어요 ✿');
    } else {
      await api(`/api/messages/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          message,
          pin: editing.pin,
          token: tokenOf(editing.id),
        }),
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

  el.btnDelete.disabled = true;
  try {
    await api(`/api/messages/${editing.id}/delete`, {
      method: 'POST',
      body: JSON.stringify({ pin: editing.pin, token: tokenOf(editing.id) }),
    });
    dropToken(editing.id);
    closeSheet();
    await load();
    toast('메시지를 삭제했어요');
  } catch (err) {
    showFormError(err.message);
  } finally {
    el.btnDelete.disabled = false;
  }
});

/* ── 비밀번호 확인 모달 ───────────────────────────────────────────── */

let pendingId = null;

function openPin(id) {
  pendingId = id;
  el.fVerifyPin.value = '';
  el.pinError.hidden = true;
  el.pinOverlay.hidden = false;
  setTimeout(() => el.fVerifyPin.focus(), 60);
}

function closePin() {
  el.pinOverlay.hidden = true;
  pendingId = null;
}

el.pinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = el.fVerifyPin.value;
  if (!/^\d{4}$/.test(pin)) {
    el.pinError.textContent = '숫자 4자리를 입력해 주세요.';
    el.pinError.hidden = false;
    return;
  }
  try {
    await api(`/api/messages/${pendingId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    const note = notes.find((n) => n.id === pendingId);
    closePin();
    if (note) openSheet('edit', note, pin);
  } catch (err) {
    el.pinError.textContent = err.message;
    el.pinError.hidden = false;
  }
});

/* ── 이벤트 연결 ──────────────────────────────────────────────────── */

el.board.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-edit]');
  if (!btn) return;
  const id = Number(btn.dataset.edit);
  const note = notes.find((n) => n.id === id);
  if (!note) return;

  if (tokenOf(id)) openSheet('edit', note, null);
  else openPin(id);
});

el.fab.addEventListener('click', () => openSheet('create'));
el.sheetClose.addEventListener('click', closeSheet);
el.btnCancel.addEventListener('click', closeSheet);
el.pinClose.addEventListener('click', closePin);
el.pinCancel.addEventListener('click', closePin);

el.overlay.addEventListener('mousedown', (e) => {
  if (e.target === el.overlay) closeSheet();
});
el.pinOverlay.addEventListener('mousedown', (e) => {
  if (e.target === el.pinOverlay) closePin();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!el.pinOverlay.hidden) closePin();
  else if (!el.overlay.hidden) closeSheet();
});

/* ── 자동 새로고침 ────────────────────────────────────────────────── */

setInterval(() => {
  const modalOpen = !el.overlay.hidden || !el.pinOverlay.hidden;
  if (modalOpen || document.hidden) return;
  load().catch(() => { /* 네트워크 일시 오류는 조용히 무시 */ });
}, POLL_MS);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) load().catch(() => {});
});

/* ── 시작 ─────────────────────────────────────────────────────────── */

loadConfig();
load().catch(() => toast('메시지를 불러오지 못했어요'));
