/**
 * quiz.js — クイズモード
 * 駅名から都道府県/路線/鉄道会社を答えるクイズ
 */

let filterUI = null;
let allStations = [];
let stationsByName = new Map();
let quizStations = [];
let currentIndex = 0;
let maxQuestions = 10;
let correctCount = 0;
let incorrectCount = 0;
let quizType = "pref_select";
let reviewLog = [];
let isAnswered = false;
let allFilteredStations = [];

StationApp.loadData().then(stations => {
    allStations = stations;
    stationsByName = new Map();
    for (const s of stations) {
        const name = StationApp.getStationName(s);
        let list = stationsByName.get(name);
        if (!list) {
            list = [];
            stationsByName.set(name, list);
        }
        list.push(s);
    }
    filterUI = new StationApp.FilterUI(
        document.getElementById("filterContainer"),
        stations
    );
}).catch(e => {
    console.error("Failed to load data", e);
});

document.getElementById("startQuizButton").addEventListener("click", () => {
    if (!filterUI) {
        console.error("filterUI not initialized");
        return;
    }

    const filtered = filterUI.getFilteredStations();
    if (filtered.length === 0) {
        alert("条件に一致する駅がありません。条件を変更してください。");
        return;
    }

    const qtChecked = document.querySelector('input[name="quizType"]:checked');
    if (!qtChecked) {
        alert("出題形式を選択してください。");
        return;
    }
    quizType = qtChecked.value;

    const qcChecked = document.querySelector('input[name="questionCount"]:checked');
    const countVal = qcChecked ? parseInt(qcChecked.value, 10) : 10;
    maxQuestions = countVal;

    allFilteredStations = filtered;
    quizStations = shuffle([...filtered]);

    if (maxQuestions > 0 && quizStations.length > maxQuestions) {
        quizStations = quizStations.slice(0, maxQuestions);
    }

    currentIndex = 0;
    correctCount = 0;
    incorrectCount = 0;
    reviewLog = [];

    document.getElementById("setupSection").style.display = "none";
    document.getElementById("quizSection").style.display = "block";

    // フィルタ確認ボタンを使えるようにする
    setupFilterModal(filterUI);

    showQuestion();
});

/* ================================================
   フィルタ確認モーダル
   ================================================ */
function setupFilterModal(ui) {
    const btn = document.getElementById("filterInfoBtn");
    const modal = document.getElementById("filterModal");
    const closeBtn = document.getElementById("filterModalClose");
    const list = document.getElementById("filterModalList");
    const countEl = document.getElementById("filterModalCount");

    btn.addEventListener("click", () => {
        // 条件一覧を構築
        const lines = ui.getSummaryLines();
        list.innerHTML = lines.map(l => `<li>${l}</li>`).join("");
        const filtered = ui.getFilteredStations();
        countEl.textContent = `対象駅数：${filtered.length} 駅`;
        modal.style.display = "flex";
    });

    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.style.display !== "none") {
            modal.style.display = "none";
        }
    });
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getAnswerDisplay(station) {
    switch (quizType) {
        case "pref_select":
        case "pref_text":
            return StationApp.getPrefName(station.pref_cd);
        case "line":
            return station.lines.join(" / ");
        case "company":
            return station.companies.join(" / ");
        default:
            return "";
    }
}

function normalizeAnswer(answerStr) {
    if (!answerStr) return "";
    return answerStr.split(" / ").sort().join("/");
}

function getPromptText() {
    switch (quizType) {
        case "pref_select": return "この駅がある都道府県は？";
        case "pref_text": return "この駅がある都道府県を入力してください";
        case "line": return "この駅の路線は？";
        case "company": return "この駅の鉄道会社は？";
        default: return "解答してください";
    }
}

function generateChoices(correctStation) {
    const correctDisplay = getAnswerDisplay(correctStation);
    const normalizedCorrect = normalizeAnswer(correctDisplay);
    const targetName = StationApp.getStationName(correctStation);

    const choices = [correctDisplay];
    const usedNormalized = new Set([normalizedCorrect]);

    // 全国の同名駅（出題駅自身を含む）を取得
    const sameNameStations = stationsByName.get(targetName) || [correctStation];

    // 同名駅が持つ正答要素（都道府県/路線/鉄道会社）を禁止セットに収集
    const forbiddenPrefs = new Set();
    const forbiddenCompanies = new Set();
    const forbiddenLines = new Set();

    sameNameStations.forEach(s => {
        forbiddenPrefs.add(StationApp.getPrefName(s.pref_cd));
        if (s.companies) {
            s.companies.forEach(c => forbiddenCompanies.add(c));
        }
        if (s.lines) {
            s.lines.forEach(l => forbiddenLines.add(l));
        }
    });

    // 候補駅が不適切（同名駅の正解要素を含む）かどうかを判定
    function isForbiddenStation(other) {
        // 同名駅そのものは除外
        if (StationApp.getStationName(other) === targetName) {
            return true;
        }

        switch (quizType) {
            case "pref_select":
                // 同名駅が存在するいずれかの都道府県と一致する場合は除外
                return forbiddenPrefs.has(StationApp.getPrefName(other.pref_cd));

            case "company":
                // 同名駅が所属する鉄道会社のいずれかを1つでも含む場合は除外
                return other.companies && other.companies.some(c => forbiddenCompanies.has(c));

            case "line":
                // 同名駅を通る路線のいずれかを1つでも含む場合は除外
                return other.lines && other.lines.some(l => forbiddenLines.has(l));

            default:
                return false;
        }
    }

    // 候補配列から重複しない選択肢を収集
    function collectChoices(candidates) {
        for (const other of candidates) {
            if (choices.length >= 4) break;
            if (isForbiddenStation(other)) continue;

            const otherDisplay = getAnswerDisplay(other);
            const otherNormalized = normalizeAnswer(otherDisplay);

            if (otherNormalized && !usedNormalized.has(otherNormalized)) {
                choices.push(otherDisplay);
                usedNormalized.add(otherNormalized);
            }
        }
    }

    // まずは現在のフィルタ結果からシャッフルして候補を探索
    const filteredCandidates = shuffle([...allFilteredStations]);
    collectChoices(filteredCandidates);

    // フィルタ内の駅だけでは4択が埋まらなかった場合、全国の全駅から探索
    if (choices.length < 4) {
        const allCandidates = shuffle([...allStations]);
        collectChoices(allCandidates);
    }

    return shuffle(choices);
}

function showQuestion() {
    if (currentIndex >= quizStations.length) {
        showQuizResult();
        return;
    }

    isAnswered = false;
    const station = quizStations[currentIndex];
    const stationName = StationApp.getStationName(station);

    const totalQ = maxQuestions > 0 ? Math.min(maxQuestions, quizStations.length) : quizStations.length;
    document.getElementById("quizProgress").textContent = `問題 ${currentIndex + 1} / ${totalQ}`;
    document.getElementById("quizScore").textContent = `⭕ ${correctCount}　❌ ${incorrectCount}`;

    document.getElementById("quizStationName").textContent = stationName;
    document.getElementById("quizPrompt").textContent = getPromptText();

    const feedback = document.getElementById("quizFeedback");
    feedback.style.display = "none";
    feedback.className = "quiz-feedback";

    const choicesArea = document.getElementById("choicesArea");
    choicesArea.innerHTML = "";

    if (quizType === "pref_text") {
        renderTextInput(choicesArea, station);
    } else {
        renderChoiceButtons(choicesArea, station);
    }
}

function renderChoiceButtons(container, station) {
    const choices = generateChoices(station);
    const correctDisplay = getAnswerDisplay(station);
    const normalizedCorrect = normalizeAnswer(correctDisplay);

    const grid = document.createElement("div");
    grid.className = "choices-grid";

    choices.forEach(choice => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice-btn";
        btn.textContent = choice;
        btn.addEventListener("click", () => {
            if (isAnswered) return;
            isAnswered = true;

            const chosenNormalized = normalizeAnswer(choice);
            const isCorrect = chosenNormalized === normalizedCorrect;

            grid.querySelectorAll(".choice-btn").forEach(b => {
                b.disabled = true;
                const bNormalized = normalizeAnswer(b.textContent);
                if (bNormalized === normalizedCorrect) {
                    b.classList.add("correct");
                }
            });

            if (isCorrect) {
                correctCount++;
                btn.classList.add("correct");
                showFeedback(true, station, choice);
            } else {
                incorrectCount++;
                btn.classList.add("incorrect");
                showFeedback(false, station, choice);
            }
        });
        grid.appendChild(btn);
    });

    container.appendChild(grid);
}

function renderTextInput(container, station) {
    const area = document.createElement("div");
    area.className = "text-answer-area";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "都道府県を入力";
    input.autocomplete = "off";

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "primary";
    submitBtn.textContent = "回答";

    const doSubmit = () => {
        if (isAnswered) return;
        const val = input.value.trim();
        if (!val) return;
        isAnswered = true;

        const isCorrect = StationApp.matchPrefecture(val, station.pref_cd);
        input.disabled = true;
        submitBtn.disabled = true;

        if (isCorrect) {
            correctCount++;
            showFeedback(true, station, val);
        } else {
            incorrectCount++;
            showFeedback(false, station, val);
        }
    };

    submitBtn.addEventListener("click", doSubmit);

    let composing = false;
    input.addEventListener("compositionstart", () => { composing = true; });
    input.addEventListener("compositionend", () => { composing = false; });
    input.addEventListener("keydown", e => {
        if (e.key === "Enter" && !composing) doSubmit();
    });

    area.appendChild(input);
    area.appendChild(submitBtn);
    container.appendChild(area);

    input.focus();
}

function showFeedback(isCorrect, station, userAnswer) {
    const feedback = document.getElementById("quizFeedback");
    const feedbackText = document.getElementById("quizFeedbackText");
    const correctAnswerEl = document.getElementById("correctAnswerText");

    feedback.style.display = "block";

    if (isCorrect) {
        feedback.className = "quiz-feedback ok";
        feedbackText.textContent = "⭕ 正解！";
        correctAnswerEl.style.display = "none";
    } else {
        feedback.className = "quiz-feedback ng";
        feedbackText.textContent = "❌ 不正解";
        correctAnswerEl.style.display = "block";
        correctAnswerEl.textContent = `正解: ${getAnswerDisplay(station)}`;
    }

    document.getElementById("quizScore").textContent = `⭕ ${correctCount}　❌ ${incorrectCount}`;

    reviewLog.push({
        stationName: StationApp.getStationName(station),
        correctAnswer: getAnswerDisplay(station),
        userAnswer: userAnswer,
        isCorrect: isCorrect
    });
}

document.getElementById("nextButton").addEventListener("click", () => {
    currentIndex++;
    showQuestion();
});

document.getElementById("quitQuizBtn").addEventListener("click", () => {
    const answered = reviewLog.length;
    if (answered === 0) {
        if (confirm("まだ一問も回答していません。終了してセットアップ画面に戻りますか？")) {
            location.reload();
        }
        return;
    }
    if (confirm(`現時点で${answered}問回答済みです。途中終了して結果を表示しますか？`)) {
        showQuizResult(true);
    }
});

function showQuizResult(isEarlyExit = false) {
    document.getElementById("quizSection").style.display = "none";
    document.getElementById("quizResult").style.display = "block";

    const total = reviewLog.length;
    const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    if (isEarlyExit) {
        document.getElementById("quizResultTitle").textContent = "🛑 途中終了";
        document.getElementById("quizResultSubtitle").textContent =
            `（${currentIndex + 1} 問目を回答中に途中終了しました）`;
    } else {
        document.getElementById("quizResultTitle").textContent = rate === 100 ? "🎉 パーフェクト！" : "📊 結果発表";
        document.getElementById("quizResultSubtitle").textContent = "";
    }
    document.getElementById("quizResultSummary").textContent = `${correctCount} / ${total} 問正解（正答率: ${rate}%）`;

    const reviewList = document.getElementById("quizReviewList");
    reviewList.innerHTML = "";

    reviewLog.forEach((entry, i) => {
        const li = document.createElement("li");
        li.className = `quiz-review-item ${entry.isCorrect ? "review-ok" : "review-ng"}`;

        const qDiv = document.createElement("div");
        qDiv.className = "review-question";
        qDiv.textContent = `${i + 1}. ${entry.stationName}`;

        const dDiv = document.createElement("div");
        dDiv.className = "review-detail";
        if (entry.isCorrect) {
            dDiv.textContent = `⭕ ${entry.userAnswer}`;
        } else {
            dDiv.textContent = `❌ ${entry.userAnswer} → 正解: ${entry.correctAnswer}`;
        }

        li.appendChild(qDiv);
        li.appendChild(dDiv);
        reviewList.appendChild(li);
    });
}
