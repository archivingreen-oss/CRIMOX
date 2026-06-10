// =============================================================
// archive.js — 형사소송법 OX 퀴즈 공통 아카이브 모듈
// · Google 로그인 / Firestore 동기화
// · 오답 자동 저장 + 헷갈림 수동 토글
// · 우측 하단 🏷️ 버튼으로 8개 파일 통합 모아보기
// =============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, deleteDoc, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────
// const firebaseConfig = {
  apiKey: "AIzaSyCz-QziDKUKmYAIlXigd3GlTaM_oyzj2dQ",
  authDomain: "studymap-89c09.firebaseapp.com",
  projectId: "studymap-89c09",
  storageBucket: "studymap-89c09.firebasestorage.app",
  messagingSenderId: "20865447129",
  appId: "1:20865447129:web:419f96f419b4cba0a43ac8",
  measurementId: "G-L7LW590E8Q"
};

const HAS_CONFIG = !firebaseConfig.apiKey.startsWith("PASTE_");

let app, auth, db, provider;
if (HAS_CONFIG) {
  app      = initializeApp(firebaseConfig);
  auth     = getAuth(app);
  db       = getFirestore(app);
  provider = new GoogleAuthProvider();
}

// ─── 상수 ────────────────────────────────────────────────────
const SUBJECT  = 'criminalProcedure';
const COL_NAME = 'quizArchive';
const FILE_ID    = window.FILE_ID    || 'unknown';
const FILE_TITLE = window.FILE_TITLE || '';
const LS_KEY     = 'crimQuizArchive_' + FILE_ID;

let currentUid = null;
let archive    = {}; // { 'q0': {wrong, confused, q, a, ex, cite, tag, file, fileTitle, ...} }

// ─── 로컬 저장 ───────────────────────────────────────────────
function loadLocal(){
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function saveLocal(){
  localStorage.setItem(LS_KEY, JSON.stringify(archive));
}

// ─── Firestore 동기화 ───────────────────────────────────────
async function syncFromCloud(){
  if(!currentUid || !db) return;
  const col = collection(db, 'users', currentUid, COL_NAME);
  const snap = await getDocs(col);
  // 현재 파일에 해당하는 것만 archive 객체에 로드
  archive = {};
  snap.forEach(d => {
    const data = d.data();
    if(data.file === FILE_ID){
      archive['q' + data.qIdx] = data;
    }
  });
  saveLocal();
  refreshAllChips();
}

async function persist(qid, data){
  const empty = !data.wrong && !data.confused;
  if(empty){
    delete archive[qid];
  } else {
    archive[qid] = data;
  }
  saveLocal();
  refreshChip(qid);

  if(currentUid && db){
    const docId = `${FILE_ID}__${qid}`;
    const ref = doc(db, 'users', currentUid, COL_NAME, docId);
    if(empty){
      try { await deleteDoc(ref); } catch(e){ console.warn(e); }
    } else {
      try {
        await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge:true });
      } catch(e){ console.warn(e); }
    }
  }
}

// ─── 외부 API ───────────────────────────────────────────────
window.ArchiveAPI = {
  markWrong(qIdx, payload){
    const qid = 'q' + qIdx;
    const cur = archive[qid] || {};
    const next = {
      ...cur, ...payload,
      subject: SUBJECT, file: FILE_ID, fileTitle: FILE_TITLE,
      qIdx, wrong: true,
      confused: !!cur.confused
    };
    persist(qid, next);
  },
  toggleConfused(qIdx, payload){
    const qid = 'q' + qIdx;
    const cur = archive[qid] || {};
    const next = {
      ...cur, ...payload,
      subject: SUBJECT, file: FILE_ID, fileTitle: FILE_TITLE,
      qIdx,
      wrong: !!cur.wrong,
      confused: !cur.confused
    };
    persist(qid, next);
    return next.confused;
  },
  getStatus(qIdx){
    return archive['q' + qIdx] || { wrong:false, confused:false };
  }
};

// ─── 스타일 주입 ────────────────────────────────────────────
function injectStyles(){
  const s = document.createElement('style');
  s.textContent = `
    .auth-bar{
      position:fixed; top:64px; right:10px;
      z-index:60;
      display:flex; gap:6px; align-items:center;
      background:rgba(244,241,234,.94);
      backdrop-filter:blur(8px);
      border:1px solid var(--line, #d8d2c4);
      border-radius:99px; padding:5px 12px;
      font-size:12px; font-weight:500;
      box-shadow:0 2px 10px rgba(40,30,20,.08);
      max-width:calc(100vw - 20px);
    }
    @media (min-width:900px){
      .auth-bar{ top:14px; right:14px; }
    }
    .auth-bar button{
      border:none; background:none; cursor:pointer;
      font:inherit; color:var(--accent, #7a1f2b);
      padding:3px 8px; border-radius:99px;
    }
    .auth-bar button:hover{ background:rgba(122,31,43,.08); }
    .auth-bar .user-photo{
      width:20px; height:20px; border-radius:50%; vertical-align:middle;
    }
    .auth-bar .uname{
      max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      color:var(--ink, #1a1d24);
    }
    .auth-bar .muted{ color:var(--muted, #6f6a5e); font-weight:400; }

    .confused-btn{
      margin-left:10px; padding:7px 13px;
      border:1.5px dashed var(--gold, #9a7b2e);
      background:transparent; color:var(--gold, #9a7b2e);
      border-radius:8px; cursor:pointer; font-size:13px;
      font-family:inherit; font-weight:500;
      transition:all .18s; vertical-align:middle;
    }
    .confused-btn:hover{ background:rgba(154,123,46,.08); }
    .confused-btn.active{
      background:var(--gold, #9a7b2e); color:#fff;
      border-style:solid;
    }
    .q.has-wrong{ box-shadow:inset 3px 0 0 var(--x-color, #b03030); }
    .q.has-confused{ background:rgba(154,123,46,.05); }

    .archive-fab{
      position:fixed; bottom:22px; right:22px; z-index:80;
      width:54px; height:54px; border-radius:50%;
      background:var(--ink, #1a1d24); color:var(--paper, #f4f1ea);
      border:none; cursor:pointer;
      box-shadow:0 6px 20px rgba(40,30,20,.28);
      font-size:22px; transition:transform .2s;
      display:flex; align-items:center; justify-content:center;
    }
    .archive-fab:hover{ transform:scale(1.08); }
    .archive-fab .count{
      position:absolute; top:-4px; right:-4px;
      background:var(--accent, #7a1f2b); color:#fff;
      font-size:11px; font-weight:700; min-width:20px; height:20px;
      border-radius:99px; padding:0 6px; line-height:20px;
      box-sizing:border-box;
    }

    .modal-backdrop{
      position:fixed; inset:0; background:rgba(0,0,0,.5);
      z-index:200; display:none;
      backdrop-filter:blur(3px);
    }
    .modal-backdrop.show{
      display:flex; align-items:center; justify-content:center; padding:20px;
    }
    .arc-modal{
      background:var(--paper, #f4f1ea); border-radius:16px;
      max-width:760px; width:100%; max-height:84vh; overflow:auto;
      padding:28px 24px; position:relative;
    }
    .arc-modal h2{
      font-family:'Gowun Batang', serif; font-size:22px; margin-bottom:6px;
    }
    .arc-modal .sub{
      font-size:12.5px; color:var(--muted, #6f6a5e); margin-bottom:18px;
    }
    .arc-modal .close{
      position:absolute; top:14px; right:18px;
      background:none; border:none; font-size:24px; cursor:pointer;
      color:var(--muted, #6f6a5e);
    }
    .arc-filters{
      display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;
    }
    .arc-filters button{
      padding:5px 12px; border-radius:99px;
      border:1px solid var(--line, #d8d2c4);
      background:transparent; color:var(--ink, #1a1d24);
      font:inherit; font-size:12px; font-weight:500; cursor:pointer;
    }
    .arc-filters button.active{
      background:var(--ink, #1a1d24); color:var(--paper, #f4f1ea);
      border-color:var(--ink, #1a1d24);
    }
    .arc-item{
      border-top:1px solid var(--line, #d8d2c4); padding:14px 0;
    }
    .arc-item .meta{
      display:flex; gap:6px; font-size:11.5px; margin-bottom:6px;
      flex-wrap:wrap; align-items:center;
    }
    .arc-item .badge{
      padding:2px 8px; border-radius:99px; font-weight:600;
    }
    .arc-item .badge.wrong{ background:var(--x-color,#b03030); color:#fff; }
    .arc-item .badge.confused{ background:var(--gold,#9a7b2e); color:#fff; }
    .arc-item .badge.file{ background:var(--paper-2,#ece7db); color:var(--ink,#1a1d24); }
    .arc-item .badge.tag{
      background:transparent; color:var(--accent,#7a1f2b);
      border:1px solid var(--accent,#7a1f2b);
    }
    .arc-item .qt{ font-size:14px; line-height:1.6; margin-bottom:4px; }
    .arc-item .ans{ font-size:12.5px; color:#3a3a3a; }
    .arc-item .ans b{ color:var(--ink, #1a1d24); }
    .arc-item .cite{
      display:inline-block; font-size:11.5px; color:var(--accent,#7a1f2b);
      background:rgba(122,31,43,.08); border-radius:5px; padding:1px 6px;
      margin-left:6px;
    }
    .arc-actions{
      margin-top:8px; display:flex; gap:8px;
    }
    .arc-actions button{
      font:inherit; font-size:11.5px; padding:4px 10px;
      border:1px solid var(--line, #d8d2c4); background:transparent;
      color:var(--muted, #6f6a5e); border-radius:6px; cursor:pointer;
    }
    .arc-actions button:hover{ background:rgba(0,0,0,.04); color:var(--ink, #1a1d24); }
    .arc-empty{
      padding:36px 12px; text-align:center; color:var(--muted, #6f6a5e); font-size:13.5px;
    }
  `;
  document.head.appendChild(s);
}

// ─── UI 컴포넌트 주입 ───────────────────────────────────────
function injectAuthBar(){
  const bar = document.createElement('div');
  bar.className = 'auth-bar';
  bar.id = 'authBar';
  bar.innerHTML = `<span id="authStatus" class="muted">로딩 중…</span>`;
  document.body.appendChild(bar);
}

function injectArchiveFab(){
  const btn = document.createElement('button');
  btn.className = 'archive-fab';
  btn.title = '오답·헷갈림 모아보기';
  btn.innerHTML = `🏷️<span class="count" id="archCount" style="display:none">0</span>`;
  btn.onclick = openArchiveModal;
  document.body.appendChild(btn);
}

function injectModal(){
  const m = document.createElement('div');
  m.className = 'modal-backdrop';
  m.id = 'archiveModal';
  m.innerHTML = `
    <div class="arc-modal" onclick="event.stopPropagation()">
      <button class="close" aria-label="닫기">×</button>
      <h2>오답 · 헷갈림 모아보기</h2>
      <p class="sub" id="arcSub">8개 파일 통합 · 로그인 시 기기 간 동기화</p>
      <div class="arc-filters">
        <button data-filter="all" class="active">전체</button>
        <button data-filter="wrong">오답만</button>
        <button data-filter="confused">헷갈림만</button>
        <button data-filter="thisFile">이 파일만</button>
      </div>
      <div id="archList"></div>
    </div>
  `;
  m.addEventListener('click', ()=>m.classList.remove('show'));
  m.querySelector('.close').addEventListener('click', (e)=>{
    e.stopPropagation();
    m.classList.remove('show');
  });
  m.querySelectorAll('.arc-filters button').forEach(b=>{
    b.addEventListener('click', (e)=>{
      e.stopPropagation();
      m.querySelectorAll('.arc-filters button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      renderArchiveList(b.dataset.filter);
    });
  });
  document.body.appendChild(m);
}

// ─── 카드별 칩/버튼 갱신 ────────────────────────────────────
function refreshChip(qid){
  const idx = qid.replace('q','');
  const card = document.getElementById('q' + idx);
  if(!card) return;
  const data = archive[qid] || {};
  card.classList.toggle('has-wrong', !!data.wrong);
  card.classList.toggle('has-confused', !!data.confused);
  const btn = card.querySelector('.confused-btn');
  if(btn) btn.classList.toggle('active', !!data.confused);
  updateCount();
}

function refreshAllChips(){
  document.querySelectorAll('.q').forEach(card=>{
    const qid = 'q' + card.id.replace('q','');
    refreshChip(qid);
  });
  updateCount();
}

function updateCount(){
  const c = Object.keys(archive).filter(k =>
    archive[k].wrong || archive[k].confused
  ).length;
  const el = document.getElementById('archCount');
  if(el){
    el.textContent = c;
    el.style.display = c > 0 ? '' : 'none';
  }
}

// ─── 카드 내용 추출 헬퍼 ────────────────────────────────────
function extractCardData(card){
  const qText = (card.querySelector('.q-text')?.textContent || '')
    .replace(/^Q\d+\.\s*/, '').trim();
  const tag = card.querySelector('.q-tag')?.textContent.trim() || '';
  const exInner = card.querySelector('.explain-inner');
  let a = '', ex = '', cite = '';
  if(exInner){
    const verdict = exInner.querySelector('.verdict');
    a = verdict ? verdict.textContent.replace('정답', '').trim() : '';
    cite = exInner.querySelector('.cite')?.textContent.trim() || '';
    // verdict + cite 텍스트를 제외한 나머지 = 해설
    const clone = exInner.cloneNode(true);
    clone.querySelectorAll('.verdict, .cite, br').forEach(n=>n.remove());
    ex = clone.textContent.trim();
  }
  return { q: qText, tag, a, ex, cite };
}

// ─── 헷갈림 버튼 + pick 후킹 ────────────────────────────────
function injectConfusedButtons(){
  document.querySelectorAll('.q').forEach(card=>{
    if(card.querySelector('.confused-btn')) return;
    const idx = parseInt(card.id.replace('q',''), 10);
    const choices = card.querySelector('.choices');
    if(!choices) return;
    const btn = document.createElement('button');
    btn.className = 'confused-btn';
    btn.type = 'button';
    btn.innerHTML = '⚑ 헷갈림';
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      const payload = extractCardData(card);
      window.ArchiveAPI.toggleConfused(idx, payload);
    });
    choices.appendChild(btn);
  });
  refreshAllChips();
}

function hookPick(){
  const orig = window.pick;
  if(typeof orig !== 'function'){
    setTimeout(hookPick, 60);
    return;
  }
  if(window._pickHooked) return;
  window._pickHooked = true;
  window.pick = function(idx, choice){
    orig.call(this, idx, choice);
    setTimeout(()=>{
      const card = document.getElementById('q'+idx);
      if(card && card.querySelector('.sel-wrong')){
        const payload = extractCardData(card);
        payload.userPick = choice;
        window.ArchiveAPI.markWrong(idx, payload);
      }
    }, 30);
  };
}

// resetQuiz 후킹 → 칩/버튼 다시 주입
function hookReset(){
  const orig = window.resetQuiz;
  if(typeof orig !== 'function') return;
  if(window._resetHooked) return;
  window._resetHooked = true;
  window.resetQuiz = function(){
    orig.call(this);
    setTimeout(()=>{
      injectConfusedButtons();
      refreshAllChips();
    }, 30);
  };
}

// ─── 모아보기 모달 ──────────────────────────────────────────
let _allItems = []; // 전체 파일 통합 캐시

async function fetchAllItems(){
  let items = [];
  if(currentUid && db){
    const col = collection(db, 'users', currentUid, COL_NAME);
    const snap = await getDocs(col);
    snap.forEach(d => items.push(d.data()));
  } else {
    // 비로그인 시: 모든 파일의 localStorage 키 훑기
    for(let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.startsWith('crimQuizArchive_')){
        try {
          const data = JSON.parse(localStorage.getItem(k) || '{}');
          Object.values(data).forEach(v => items.push(v));
        } catch {}
      }
    }
  }
  return items.filter(x => x.wrong || x.confused);
}

async function openArchiveModal(){
  document.getElementById('archiveModal').classList.add('show');
  document.getElementById('archList').innerHTML =
    '<div class="arc-empty">불러오는 중…</div>';
  _allItems = await fetchAllItems();
  renderArchiveList('all');
}

function renderArchiveList(filter){
  const list = document.getElementById('archList');
  let items = _allItems.slice();
  if(filter === 'wrong')    items = items.filter(x => x.wrong);
  if(filter === 'confused') items = items.filter(x => x.confused);
  if(filter === 'thisFile') items = items.filter(x => x.file === FILE_ID);

  // 파일별 → 문제 번호 정렬
  items.sort((a,b)=>{
    if(a.file !== b.file) return (a.file||'').localeCompare(b.file||'');
    return (a.qIdx||0) - (b.qIdx||0);
  });

  if(items.length === 0){
    list.innerHTML = '<div class="arc-empty">아직 모은 문제가 없습니다.</div>';
    return;
  }
  list.innerHTML = items.map(x => {
    const docId = `${x.file}__q${x.qIdx}`;
    return `
      <div class="arc-item" data-doc-id="${docId}">
        <div class="meta">
          <span class="badge file">${x.fileTitle || x.file || ''}</span>
          ${x.tag ? `<span class="badge tag">${x.tag}</span>` : ''}
          ${x.wrong    ? '<span class="badge wrong">오답</span>' : ''}
          ${x.confused ? '<span class="badge confused">헷갈림</span>' : ''}
        </div>
        <div class="qt">${escapeHtml(x.q || '')}</div>
        <div class="ans">
          <b>정답 ${escapeHtml(x.a || '?')}</b>
          ${x.userPick ? ` <span style="color:#b03030">(선택: ${escapeHtml(x.userPick)})</span>` : ''}
          · ${escapeHtml(x.ex || '')}
          ${x.cite ? `<span class="cite">${escapeHtml(x.cite)}</span>` : ''}
        </div>
        <div class="arc-actions">
          ${x.wrong    ? `<button data-act="unwrong"   data-doc="${docId}">오답 해제</button>` : ''}
          ${x.confused ? `<button data-act="unconfused" data-doc="${docId}">헷갈림 해제</button>` : ''}
          <button data-act="remove" data-doc="${docId}">완전 삭제</button>
        </div>
      </div>
    `;
  }).join('');

  // 액션 핸들러
  list.querySelectorAll('.arc-actions button').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const docId = btn.dataset.doc;
      const act = btn.dataset.act;
      handleArchiveAction(docId, act);
    });
  });
}

async function handleArchiveAction(docId, act){
  // docId = "{fileId}__q{idx}"
  const [fileId, qPart] = docId.split('__');
  const idx = parseInt(qPart.replace('q',''),10);

  // _allItems 에서 해당 아이템 찾기
  const item = _allItems.find(x => x.file === fileId && x.qIdx === idx);
  if(!item) return;

  if(act === 'unwrong')    item.wrong = false;
  if(act === 'unconfused') item.confused = false;
  if(act === 'remove'){ item.wrong = false; item.confused = false; }

  // 현재 파일이면 archive 객체도 갱신
  if(fileId === FILE_ID){
    const qid = 'q' + idx;
    archive[qid] = { ...archive[qid], ...item };
    saveLocal();
    refreshChip(qid);
  }

  // Firestore + 다른 파일 localStorage 직접 갱신
  if(currentUid && db){
    const ref = doc(db, 'users', currentUid, COL_NAME, docId);
    if(!item.wrong && !item.confused){
      try { await deleteDoc(ref); } catch(e){ console.warn(e); }
    } else {
      try { await setDoc(ref, { ...item, updatedAt: serverTimestamp() }, { merge:true }); }
      catch(e){ console.warn(e); }
    }
  } else if(fileId !== FILE_ID){
    // 다른 파일의 localStorage 항목 직접 수정
    const lsKey = 'crimQuizArchive_' + fileId;
    try{
      const data = JSON.parse(localStorage.getItem(lsKey) || '{}');
      const qid = 'q' + idx;
      if(!item.wrong && !item.confused){
        delete data[qid];
      } else {
        data[qid] = item;
      }
      localStorage.setItem(lsKey, JSON.stringify(data));
    } catch {}
  }

  // 리스트 새로고침
  _allItems = await fetchAllItems();
  const active = document.querySelector('.arc-filters button.active');
  renderArchiveList(active ? active.dataset.filter : 'all');
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ─── 인증 ──────────────────────────────────────────────────
function updateAuthBar(user){
  const status = document.getElementById('authStatus');
  if(!status) return;

  if(!HAS_CONFIG){
    status.innerHTML = `
      <span class="muted">Firebase 미설정 · 로컬 저장만 동작</span>
    `;
    return;
  }

  if(user){
    status.innerHTML = `
      ${user.photoURL ? `<img src="${user.photoURL}" class="user-photo">` : ''}
      <span class="uname">${escapeHtml(user.displayName || user.email || '')}</span>
      <button id="signOutBtn">로그아웃</button>
    `;
    document.getElementById('signOutBtn').onclick = () => signOut(auth);
  } else {
    status.innerHTML = `
      <span class="muted">로컬 저장 중</span>
      <button id="signInBtn">Google 로그인</button>
    `;
    document.getElementById('signInBtn').onclick = () => signInWithPopup(auth, provider);
  }
}

if(HAS_CONFIG){
  onAuthStateChanged(auth, async (user)=>{
    currentUid = user ? user.uid : null;
    updateAuthBar(user);
    if(user){
      await syncFromCloud();
    } else {
      archive = loadLocal();
      refreshAllChips();
    }
  });
}

// ─── 초기화 ────────────────────────────────────────────────
function boot(){
  archive = loadLocal();
  injectStyles();
  injectAuthBar();
  injectArchiveFab();
  injectModal();
  injectConfusedButtons();
  hookPick();
  hookReset();
  refreshAllChips();
  if(!HAS_CONFIG){
    updateAuthBar(null);
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  // 모듈 스크립트는 defer 동작이라 보통 여기로 옴
  boot();
}
