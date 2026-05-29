// 英語動詞クイズ アプリ本体
// 成績は localStorage に保存（ログイン不要）。
// 解答方法: typing（入力） / choice（選択肢・ワンクッション付き）

const STORE_KEY = "verbQuiz.v2";

const state = {
  mode: "mixed",         // mixed | daily | business | misses
  answerMethod: "typing", // typing | choice
  pool: [],
  index: 0,
  score: 0,
  wrong: 0,
  streak: 0,
  bestStreak: 0,
  times: [],
  misses: [],
  answered: false,
  choices: [],
  currentStartedAt: 0,
};

const els = {};
function bind(id) { return document.getElementById(id); }
[
  "startScreen", "quizScreen", "endScreen",
  "modeSeg", "answerSeg", "lengthSelect",
  "questionCountBadge", "overallBadge",
  "startBtn", "resetHistoryBtn",
  "progressText", "progressBar", "timerText",
  "catTag", "jpText", "firstWord", "answerInput", "blankBox", "tailText", "sentenceLabel",
  "hintLine", "revealBox", "revealBtn", "choiceGrid",
  "checkBtn", "hintBtn", "skipBtn", "nextBtn", "quitBtn", "feedback",
  "statScore", "statWrong", "statStreak", "statAvg",
  "ovTotal", "ovRate", "ovMiss", "ovBest",
  "missList", "endTitle", "endSummary", "retryMissesBtn", "newSessionBtn",
].forEach(id => { els[id] = bind(id); });

/* ---------- storage ---------- */
function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return { questions: raw.questions || {}, overall: raw.overall || { total: 0, correct: 0, bestStreak: 0 } };
  } catch {
    return { questions: {}, overall: { total: 0, correct: 0, bestStreak: 0 } };
  }
}
function saveStore(store) { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }

/* ---------- helpers ---------- */
function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[.!?,;]/g, "")
    .replace(/\s+/g, " ")
    .replace(/'/g, "");
}
function acceptedAnswers(q) {
  return [q.answer, ...(q.alts || [])].map(normalize);
}
function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

/* ---------- question sources ---------- */
function questionsForMode(mode) {
  const store = loadStore();
  let source = QUESTIONS;
  if (mode === "daily") source = source.filter(q => q.cat === "daily");
  if (mode === "business") source = source.filter(q => q.cat === "business");
  if (mode === "misses") {
    // 「苦手」= 最後に間違えた問題（通算成績の苦手数と一致）
    source = source.filter(q => store.questions[q.id]?.lastWrong);
  }
  return source;
}

function updateQuestionCount() {
  const count = questionsForMode(state.mode).length;
  els.questionCountBadge.textContent = `${count}問`;
}

function buildPool(fixedPool) {
  let source = fixedPool ? [...fixedPool] : questionsForMode(state.mode);
  source = shuffle(source);
  const lengthValue = els.lengthSelect.value;
  if (lengthValue !== "all") source = source.slice(0, Number(lengthValue));
  return source;
}

/* ---------- choices (選択モード用ダミー生成) ---------- */
function buildChoices(q) {
  // 同カテゴリの他問題の answer からダミーを集める（重複は除外）
  const correct = q.answer;
  const correctNorm = normalize(correct);
  const samePool = QUESTIONS.filter(x => x.cat === q.cat && normalize(x.answer) !== correctNorm);
  const distractorWords = [];
  const seen = new Set([correctNorm]);
  for (const x of shuffle(samePool)) {
    const n = normalize(x.answer);
    if (seen.has(n)) continue;
    seen.add(n);
    distractorWords.push(x.answer);
    if (distractorWords.length >= 3) break;
  }
  // 同カテゴリで足りなければ全体から補う
  if (distractorWords.length < 3) {
    for (const x of shuffle(QUESTIONS)) {
      const n = normalize(x.answer);
      if (seen.has(n)) continue;
      seen.add(n);
      distractorWords.push(x.answer);
      if (distractorWords.length >= 3) break;
    }
  }
  return shuffle([correct, ...distractorWords]);
}

/* ---------- screen control ---------- */
function show(section) {
  els.startScreen.classList.toggle("hidden", section !== "start");
  els.quizScreen.classList.toggle("hidden", section !== "quiz");
  els.endScreen.classList.toggle("hidden", section !== "end");
}

/* ---------- session ---------- */
function startSession(fixedPool = null) {
  if (state.mode === "misses" && !fixedPool && questionsForMode("misses").length === 0) {
    alert("苦手な問題はまだありません。まずは他のモードで練習しましょう。");
    return;
  }
  state.pool = buildPool(fixedPool);
  if (state.pool.length === 0) { alert("出題できる問題がありません。"); return; }
  state.index = 0;
  state.score = 0;
  state.wrong = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.times = [];
  state.misses = [];
  state.answered = false;
  updateSessionStats();
  renderMisses();
  show("quiz");
  renderQuestion();
}

function currentQuestion() { return state.pool[state.index]; }

function renderQuestion() {
  const q = currentQuestion();
  if (!q) return endSession();

  state.answered = false;
  state.currentStartedAt = performance.now();

  els.progressText.textContent = `${state.index + 1} / ${state.pool.length}`;
  els.progressBar.style.width = `${(state.index / state.pool.length) * 100}%`;
  els.timerText.textContent = "0.0秒";
  els.catTag.textContent = `${q.cat === "daily" ? "日常" : "ビジネス"} / ${q.sub || ""}`;
  els.jpText.textContent = q.jp;
  els.firstWord.textContent = q.subject;
  els.tailText.textContent = q.tail;
  els.feedback.className = "feedback";
  els.feedback.innerHTML = "";
  els.hintLine.textContent = "ヒントは必要なときだけ表示できます。";
  els.nextBtn.classList.add("hidden");
  els.hintBtn.disabled = false;
  els.skipBtn.disabled = false;

  if (state.answerMethod === "typing") {
    els.sentenceLabel.textContent = "英文：動詞（句）を入力";
    els.answerInput.classList.remove("hidden");
    els.answerInput.value = "";
    els.answerInput.className = "verb-input";
    els.answerInput.disabled = false;
    els.blankBox.classList.add("hidden");
    els.revealBox.classList.add("hidden");
    els.choiceGrid.classList.add("hidden");
    els.checkBtn.classList.remove("hidden");
    els.hintBtn.classList.remove("hidden");
    setTimeout(() => els.answerInput.focus(), 30);
  } else {
    els.sentenceLabel.textContent = "英文：動詞（句）を選ぶ";
    els.answerInput.classList.add("hidden");
    els.blankBox.classList.remove("hidden");
    els.blankBox.textContent = "？";
    els.blankBox.style.color = "";
    // ワンクッション: まず reveal だけ表示
    els.revealBox.classList.remove("hidden");
    els.choiceGrid.classList.add("hidden");
    els.choiceGrid.innerHTML = "";
    els.checkBtn.classList.add("hidden");
    els.hintBtn.classList.add("hidden"); // 選択モードはヒント不要
  }
}

function revealChoices() {
  const q = currentQuestion();
  state.choices = buildChoices(q);
  els.revealBox.classList.add("hidden");
  els.choiceGrid.classList.remove("hidden");
  els.choiceGrid.innerHTML = state.choices.map((c, i) =>
    `<button type="button" class="choice" data-choice="${i}"><span style="opacity:.5">${i + 1}.</span> ${escapeHtml(c)}</button>`
  ).join("");
  els.choiceGrid.querySelectorAll(".choice").forEach(btn => {
    btn.addEventListener("click", () => selectChoice(Number(btn.dataset.choice)));
  });
  // 表示までの時間はカウント継続（思い出す時間も含める）
}

function elapsedForCurrent() {
  return Math.max(0, (performance.now() - state.currentStartedAt) / 1000);
}

/* ---------- judging ---------- */
function recordResult(q, ok, elapsed, typedLabel) {
  state.answered = true;
  state.times.push(elapsed);

  const store = loadStore();
  const rec = store.questions[q.id] || { seen: 0, correct: 0, wrong: 0 };
  rec.seen += 1;
  rec.last = new Date().toISOString();
  store.overall.total += 1;

  if (ok) {
    state.score += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    rec.correct += 1;
    rec.lastWrong = false;
    store.overall.correct += 1;
  } else {
    state.wrong += 1;
    state.streak = 0;
    rec.wrong += 1;
    rec.lastWrong = true;
    state.misses.push({ ...q, typed: typedLabel });
  }
  store.overall.bestStreak = Math.max(store.overall.bestStreak || 0, state.bestStreak);
  store.questions[q.id] = rec;
  saveStore(store);

  updateSessionStats();
  updateOverallStats();
  renderMisses();
}

function finishUI(ok, forceSkip, typedLabel, q) {
  els.hintBtn.disabled = true;
  els.skipBtn.disabled = true;
  els.checkBtn.classList.add("hidden");
  els.nextBtn.classList.remove("hidden");
  els.progressBar.style.width = `${((state.index + 1) / state.pool.length) * 100}%`;

  const head = forceSkip ? "スキップ" : (ok ? "正解" : "ミス");
  const type = forceSkip ? "warn" : (ok ? "good" : "bad");
  const line = ok ? `答え：${q.answer}` : `${typedLabel} / 正解：${q.answer}`;
  renderFeedback(type, head, line, q);
  setTimeout(() => els.nextBtn.focus(), 10);
}

// typing判定
function checkAnswer(forceSkip = false) {
  if (state.answered) return nextQuestion();
  if (state.answerMethod !== "typing") return;
  const q = currentQuestion();
  const input = els.answerInput.value;

  if (!forceSkip && !normalize(input)) {
    els.feedback.className = "feedback show warn";
    els.feedback.innerHTML = `<strong>まだ判定していません</strong><div>入力欄が空です。動詞（句）を入力してから Enter または判定を押してください。</div>`;
    els.answerInput.focus();
    return;
  }

  const elapsed = elapsedForCurrent();
  const ok = !forceSkip && acceptedAnswers(q).includes(normalize(input));
  els.answerInput.disabled = true;
  els.answerInput.classList.add(ok ? "good" : "bad");
  const typedLabel = normalize(input) ? `あなたの答え：${input}` : "未入力";
  recordResult(q, ok, elapsed, typedLabel);
  finishUI(ok, forceSkip, typedLabel, q);
}

// choice判定
function selectChoice(i) {
  if (state.answered) return;
  const q = currentQuestion();
  const chosen = state.choices[i];
  const ok = normalize(chosen) === normalize(q.answer) || acceptedAnswers(q).includes(normalize(chosen));
  const elapsed = elapsedForCurrent();

  els.blankBox.textContent = chosen;
  els.blankBox.style.color = ok ? "var(--good)" : "var(--bad)";

  els.choiceGrid.querySelectorAll(".choice").forEach((btn, idx) => {
    btn.disabled = true;
    const c = state.choices[idx];
    if (acceptedAnswers(q).includes(normalize(c))) btn.classList.add("good");
    else if (idx === i) btn.classList.add("bad");
  });

  const typedLabel = `あなたの答え：${chosen}`;
  recordResult(q, ok, elapsed, typedLabel);
  finishUI(ok, false, typedLabel, q);
}

// choiceでスキップ
function skipChoice() {
  if (state.answered) return;
  const q = currentQuestion();
  if (els.choiceGrid.classList.contains("hidden")) {
    // 選択肢未表示でも答えを見せて先へ
    revealChoices();
  }
  els.choiceGrid.querySelectorAll(".choice").forEach(btn => {
    btn.disabled = true;
    if (acceptedAnswers(q).includes(normalize(state.choices[Number(btn.dataset.choice)]))) btn.classList.add("good");
  });
  els.blankBox.textContent = q.answer;
  els.blankBox.style.color = "var(--warn)";
  recordResult(q, false, elapsedForCurrent(), "スキップ");
  finishUI(false, true, "スキップ", q);
}

function renderFeedback(type, title, line, q) {
  els.feedback.className = `feedback show ${type}`;
  els.feedback.innerHTML = `
    <strong>${title}</strong>
    <div>${escapeHtml(line)}</div>
    <div class="full">${escapeHtml(q.full)}</div>
    <div class="small">${escapeHtml(q.note || "")}</div>
  `;
}

function showHint() {
  if (state.answerMethod !== "typing") return;
  const q = currentQuestion();
  const first = q.answer.slice(0, 1);
  const len = q.answer.replace(/[^a-zA-Z]/g, "").length;
  els.hintLine.textContent = `ヒント：${first} で始まる ${len} 文字。${q.note || ""}`;
  els.answerInput.focus();
}

function nextQuestion() {
  if (!state.answered) {
    if (state.answerMethod === "typing") return checkAnswer();
    return; // choiceは選択待ち
  }
  state.index += 1;
  if (state.index >= state.pool.length) return endSession();
  renderQuestion();
}

/* ---------- stats rendering ---------- */
function updateSessionStats() {
  const avg = state.times.length ? state.times.reduce((a, b) => a + b, 0) / state.times.length : 0;
  els.statScore.textContent = state.score;
  els.statWrong.textContent = state.wrong;
  els.statStreak.textContent = state.streak;
  els.statAvg.textContent = avg.toFixed(1);
}

function updateOverallStats() {
  const store = loadStore();
  const o = store.overall;
  const rate = o.total ? Math.round((o.correct / o.total) * 100) : 0;
  const missCount = QUESTIONS.filter(q => store.questions[q.id]?.lastWrong).length;
  els.ovTotal.textContent = o.total;
  els.ovRate.textContent = `${rate}%`;
  els.ovMiss.textContent = missCount;
  els.ovBest.textContent = o.bestStreak || 0;
  els.overallBadge.textContent = `通算 ${o.total}問`;
}

function renderMisses() {
  if (!state.misses.length) {
    els.missList.innerHTML = '<p class="small">ミスした問題がここに出ます。</p>';
    return;
  }
  els.missList.innerHTML = state.misses.map(m => `
    <div class="miss-item">
      <b>${escapeHtml(m.jp)}</b>
      <span>${escapeHtml(m.typed)} → ${escapeHtml(m.answer)}</span>
    </div>
  `).join("");
}

function endSession() {
  show("end");
  const total = state.pool.length;
  const rate = total ? Math.round((state.score / total) * 100) : 0;
  const avg = state.times.length ? state.times.reduce((a, b) => a + b, 0) / state.times.length : 0;
  els.endTitle.textContent = `${state.score} / ${total} 正解（${rate}%）`;
  els.endSummary.textContent = `平均 ${avg.toFixed(1)} 秒。ミスは ${state.misses.length} 問。最高連続正解は ${state.bestStreak} です。`;
  els.retryMissesBtn.disabled = state.misses.length === 0;
}

/* ---------- timer ---------- */
setInterval(() => {
  if (!els.quizScreen.classList.contains("hidden") && !state.answered) {
    els.timerText.textContent = `${elapsedForCurrent().toFixed(1)}秒`;
  }
}, 100);

/* ---------- events ---------- */
els.modeSeg.querySelectorAll("[data-mode]").forEach(btn => {
  btn.addEventListener("click", () => {
    els.modeSeg.querySelectorAll("[data-mode]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.mode = btn.dataset.mode;
    updateQuestionCount();
  });
});
els.answerSeg.querySelectorAll("[data-answer]").forEach(btn => {
  btn.addEventListener("click", () => {
    els.answerSeg.querySelectorAll("[data-answer]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.answerMethod = btn.dataset.answer;
  });
});

els.lengthSelect.addEventListener("change", updateQuestionCount);
els.startBtn.addEventListener("click", () => startSession());
els.resetHistoryBtn.addEventListener("click", () => {
  if (confirm("通算成績と苦手記録をすべてリセットしますか？")) {
    localStorage.removeItem(STORE_KEY);
    updateQuestionCount();
    updateOverallStats();
    alert("成績をリセットしました。");
  }
});

els.revealBtn.addEventListener("click", revealChoices);
els.checkBtn.addEventListener("click", () => checkAnswer());
els.hintBtn.addEventListener("click", showHint);
els.skipBtn.addEventListener("click", () => {
  if (state.answered) return;
  if (state.answerMethod === "typing") checkAnswer(true);
  else skipChoice();
});
els.nextBtn.addEventListener("click", nextQuestion);
els.quitBtn.addEventListener("click", () => { show("start"); updateQuestionCount(); updateOverallStats(); });
els.newSessionBtn.addEventListener("click", () => { show("start"); updateQuestionCount(); updateOverallStats(); });
els.retryMissesBtn.addEventListener("click", () => {
  const pool = state.misses.map(m => QUESTIONS.find(q => q.id === m.id)).filter(Boolean);
  // 重複除去
  const uniq = [...new Map(pool.map(q => [q.id, q])).values()];
  startSession(uniq);
});

els.answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    setTimeout(() => { state.answered ? nextQuestion() : checkAnswer(); }, 0);
  }
  if (e.key === "Escape") { els.answerInput.value = ""; e.preventDefault(); }
});

document.addEventListener("keydown", (e) => {
  if (els.quizScreen.classList.contains("hidden")) return;

  if (e.key === "?" ) { showHint(); return; }

  // 選択モードの数字キー
  if (state.answerMethod === "choice" && !state.answered && !els.choiceGrid.classList.contains("hidden")) {
    const n = Number(e.key);
    if (n >= 1 && n <= state.choices.length) { e.preventDefault(); selectChoice(n - 1); return; }
  }
  // Enter→選択肢表示 or 次へ。
  // ただし「次へ」ボタンにフォーカスがある場合はボタン自身のクリックに任せる（二重進行を防ぐ）。
  if (e.key === "Enter" && document.activeElement !== els.answerInput && document.activeElement !== els.nextBtn) {
    e.preventDefault();
    if (state.answered) { nextQuestion(); return; }
    if (state.answerMethod === "choice" && els.choiceGrid.classList.contains("hidden") && !els.revealBox.classList.contains("hidden")) {
      revealChoices();
    }
  }
});

/* ---------- init ---------- */
updateQuestionCount();
updateOverallStats();
