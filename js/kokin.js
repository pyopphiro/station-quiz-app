/**
 * kokin.js — 古今東西モード
 * onew_app の game.js をベースに、駅名データセット + フィルタ対応版
 */

const answerInput = document.getElementById("answerInput");
const judgeButton = document.getElementById("judgeButton");
const giveUpButton = document.getElementById("giveUpButton");
const resumeButton = document.getElementById("resumeButton");
const status = document.getElementById("status");
const count = document.getElementById("count");
const answeredList = document.getElementById("answeredList");
const allAnswersSection = document.getElementById("allAnswersSection");
const allAnswers = document.getElementById("allAnswers");
const hintToggle = document.getElementById("hintToggle");
const resultEl = document.getElementById("result");
const resultTitle = document.getElementById("resultTitle");
const resultSummary = document.getElementById("resultSummary");

let correctAnswers = [];  // 正解の駅名リスト (name)
let aliases = {};         // { name: [alias1, alias2, ...] }
let answeredSet = new Set();
let lastAnswered = null;
let duplicateAnswers = null;
let wrongCount = 0;
let isGameOver = false;
let filterUI = null;

/* ================================================
   初期化
   ================================================ */
StationApp.loadData().then(stations => {
  filterUI = new StationApp.FilterUI(
    document.getElementById("filterContainer"),
    stations
  );
});

/* ================================================
   スタート
   ================================================ */
document.getElementById("startButton").addEventListener("click", () => {
  if (!filterUI) return;

  const filtered = filterUI.getFilteredStations();
  if (filtered.length === 0) {
    alert("条件に一致する駅がありません。条件を変更してください。");
    return;
  }

  // ゲームデータ構築
  correctAnswers = filtered.map(s => s.name);
  aliases = {};
  filtered.forEach(s => {
    aliases[s.name] = s.aliases || [];
  });

  // UI切り替え
  document.getElementById("filterContainer").style.display = "none";
  document.getElementById("startButton").style.display = "none";
  document.getElementById("gameSection").style.display = "block";
  answerInput.focus();
  updateCount();
});

/* ================================================
   正規化
   ================================================ */
function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, "");
}

/* ================================================
   入力値から正解を解決
   ================================================ */
function resolveAnswers(input) {
  const normInput = normalize(input);
  const results = new Set();

  // 正式名一致
  for (const ans of correctAnswers) {
    if (normalize(ans) === normInput) {
      results.add(ans);
    }
  }

  // 別名一致
  for (const [official, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      if (normalize(alias) === normInput) {
        results.add(official);
      }
    }
  }

  return Array.from(results);
}

/* ================================================
   カウント更新
   ================================================ */
function updateCount() {
  count.textContent =
    `正解数: ${answeredSet.size} / ${correctAnswers.length}　誤答数: ${wrongCount}`;
}

/* ================================================
   解答済みリスト描画
   ================================================ */
function renderAnsweredList() {
  answeredList.innerHTML = "";

  correctAnswers.forEach(ans => {
    if (answeredSet.has(ans)) {
      const li = document.createElement("li");
      li.textContent = ans;

      if (lastAnswered && lastAnswered.includes(ans)) {
        li.classList.add("recent");
      } else if (duplicateAnswers && duplicateAnswers.includes(ans)) {
        li.classList.add("duplicate");
      }

      answeredList.appendChild(li);
    } else if (hintToggle.checked) {
      const li = document.createElement("li");
      li.classList.add("hint-placeholder");
      answeredList.appendChild(li);
    }
  });
}

/* ================================================
   判定
   ================================================ */
function judge() {
  if (isGameOver) return;

  const input = answerInput.value;
  if (!input.trim()) return;

  const resolvedList = resolveAnswers(input);

  if (resolvedList.length === 0) {
    wrongCount++;
    status.textContent = `不正解… : ${input}`;
    status.className = "status ng";
    answerInput.value = "";
    updateCount();
    return;
  }

  // 新しく正解になったものだけ追加
  const newlyAnswered = resolvedList.filter(ans => !answeredSet.has(ans));

  if (newlyAnswered.length === 0) {
    status.innerHTML = `すでに解答済みです : ${input}<br><small>${resolvedList.join("<br>")}</small>`;
    status.className = "status ng";
    duplicateAnswers = resolvedList;
    lastAnswered = null;
    renderAnsweredList();
  } else {
    newlyAnswered.forEach(ans => answeredSet.add(ans));
    lastAnswered = newlyAnswered;
    duplicateAnswers = null;
    renderAnsweredList();
    const resultMsg = newlyAnswered.length > 1
      ? `${newlyAnswered.length} 件正解！ : ${input}`
      : `正解！ : ${input}`;
    status.innerHTML = `${resultMsg}<br><small>${resolvedList.join("<br>")}</small>`;
    status.className = "status ok";
  }

  answerInput.value = "";
  updateCount();

  // 全問正解チェック
  if (answeredSet.size === correctAnswers.length) {
    showResult("clear");
  }
}

/* ================================================
   IME 対応
   ================================================ */
let isComposing = false;

answerInput.addEventListener("compositionstart", () => {
  isComposing = true;
});

answerInput.addEventListener("compositionend", () => {
  isComposing = false;
});

answerInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !isComposing) {
    judge();
  }
});

judgeButton.addEventListener("click", judge);

/* ================================================
   ヒントトグル
   ================================================ */
hintToggle.addEventListener("change", renderAnsweredList);

/* ================================================
   ギブアップ
   ================================================ */
giveUpButton.addEventListener("click", () => {
  if (isGameOver) return;
  status.textContent = "ギブアップしました";
  status.className = "status ng";
  showResult("giveup");
});

/* ================================================
   続きから再開
   ================================================ */
resumeButton.addEventListener("click", () => {
  isGameOver = false;
  answerInput.disabled = false;
  judgeButton.disabled = false;
  hintToggle.disabled = false;
  answerInput.focus();

  status.textContent = "再開しました。続けて解答してください。";
  status.className = "status ok";

  allAnswersSection.style.display = "none";
  resultEl.style.display = "none";
  document.getElementById("answeredSection").style.display = "";
});

/* ================================================
   全解答表示
   ================================================ */
function renderAllAnswers() {
  allAnswersSection.style.display = "block";
  allAnswers.innerHTML = "";

  correctAnswers.forEach(a => {
    const li = document.createElement("li");
    li.textContent = a;
    li.classList.add(answeredSet.has(a) ? "answer-ok" : "answer-ng");
    allAnswers.appendChild(li);
  });
}

/* ================================================
   リザルト表示
   ================================================ */
function showResult(type) {
  isGameOver = true;
  answerInput.disabled = true;
  judgeButton.disabled = true;
  hintToggle.disabled = true;

  resultEl.style.display = "block";
  document.getElementById("answeredSection").style.display = "none";

  renderAllAnswers();

  if (type === "clear") {
    resultTitle.textContent = "🎉 全問正解！";
    resultSummary.textContent =
      `${correctAnswers.length} 問すべて正解！（誤答: ${wrongCount} 回）`;
    resumeButton.style.display = "none";
  }

  if (type === "giveup") {
    resultTitle.textContent = "ギブアップ";
    resultSummary.textContent =
      `${answeredSet.size} / ${correctAnswers.length} 問 正解（誤答: ${wrongCount} 回）`;
    resumeButton.style.display = "inline-block";
  }
}
