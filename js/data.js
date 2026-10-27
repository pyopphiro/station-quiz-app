/**
 * data.js — 共通データ・フィルタモジュール
 * 駅名データの読み込み、フィルタリング、フィルタUI を提供する。
 */
const StationApp = (() => {

  /* ================================================
     都道府県コード → 名称マッピング
     ================================================ */
  const PREF_NAMES = {
    1:"北海道",2:"青森県",3:"岩手県",4:"宮城県",5:"秋田県",
    6:"山形県",7:"福島県",8:"茨城県",9:"栃木県",10:"群馬県",
    11:"埼玉県",12:"千葉県",13:"東京都",14:"神奈川県",15:"新潟県",
    16:"富山県",17:"石川県",18:"福井県",19:"山梨県",20:"長野県",
    21:"岐阜県",22:"静岡県",23:"愛知県",24:"三重県",25:"滋賀県",
    26:"京都府",27:"大阪府",28:"兵庫県",29:"奈良県",30:"和歌山県",
    31:"鳥取県",32:"島根県",33:"岡山県",34:"広島県",35:"山口県",
    36:"徳島県",37:"香川県",38:"愛媛県",39:"高知県",40:"福岡県",
    41:"佐賀県",42:"長崎県",43:"熊本県",44:"大分県",45:"宮崎県",
    46:"鹿児島県",47:"沖縄県"
  };

  /* ================================================
     地方区分 → 都道府県コードマッピング
     ================================================ */
  const REGION_PREFECTURES = {
    "東北": [2, 3, 4, 5, 6, 7],
    "関東": [8, 9, 10, 11, 12, 13, 14],
    "中部": [15, 16, 17, 18, 19, 20, 21, 22, 23],
    "北陸": [15, 16, 17, 18],
    "甲信越": [15, 19, 20],
    "東海": [21, 22, 23, 24],
    "近畿": [24, 25, 26, 27, 28, 29, 30],
    "中国": [31, 32, 33, 34, 35],
    "四国": [36, 37, 38, 39],
    "九州": [40, 41, 42, 43, 44, 45, 46, 47]
  };

  const REGION_OPTIONS = [
    { value: "東北",   label: "東北" },
    { value: "関東",   label: "関東" },
    { value: "中部",   label: "中部" },
    { value: "北陸",   label: "北陸" },
    { value: "甲信越", label: "甲信越" },
    { value: "東海",   label: "東海" },
    { value: "近畿",   label: "近畿" },
    { value: "中国",   label: "中国" },
    { value: "四国",   label: "四国" },
    { value: "九州",   label: "九州" },
  ];

  const OPERATOR_OPTIONS = [
    { value: "gte", label: "以上" },
    { value: "lte", label: "以下" },
    { value: "eq",  label: "等しい" },
  ];

  /* ================================================
     ユーティリティ
     ================================================ */
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getStationName(station) {
    return station.aliases[0];
  }

  function getPrefName(prefCd) {
    return PREF_NAMES[prefCd] || `不明(${prefCd})`;
  }

  /** 都/道/府/県 の接尾辞を除去 */
  function stripPrefSuffix(name) {
    return name.replace(/[都道府県]$/, "");
  }

  /** 都道府県の照合（接尾辞なしでもOK） */
  function matchPrefecture(input, prefCd) {
    const prefName = PREF_NAMES[prefCd];
    if (!prefName) return false;
    const trimmed = input.trim();
    return trimmed === prefName || trimmed === stripPrefSuffix(prefName);
  }

  /* ================================================
     データ読み込み
     ================================================ */
  async function loadData() {
    const [stationRes, ryoRes] = await Promise.all([
      fetch("station-dataset.json"),
      fetch("ryoseikoku.json").catch(err => {
        console.warn("Failed to fetch ryoseikoku.json", err);
        return null;
      })
    ]);
    if (ryoRes && ryoRes.ok) {
      try {
        const ryoData = await ryoRes.json();
        initRyoseikoku(ryoData);
      } catch (err) {
        console.warn("Failed to parse ryoseikoku.json", err);
      }
    }
    const stations = await stationRes.json();
    return stations;
  }

  /* ================================================
     データ抽出
     ================================================ */
  function getUniqueCompanies(stations) {
    const s = new Set();
    stations.forEach(st => st.companies.forEach(c => s.add(c)));
    return Array.from(s).sort();
  }

  function getUniqueLines(stations) {
    const s = new Set();
    stations.forEach(st => st.lines.forEach(l => s.add(l)));
    return Array.from(s).sort();
  }

  function getUniquePrefCodes(stations) {
    const s = new Set();
    stations.forEach(st => s.add(st.pref_cd));
    return Array.from(s).sort((a, b) => a - b);
  }

  /* ================================================
     令制国（旧国名）マスタ管理・正規表現
     ================================================ */
  const DEFAULT_RYOSEIKOKU_NAMES = [
    "陸奥", "出羽", "下野", "上野", "信濃", "飛騨", "美濃", "近江", "佐渡", "越後",
    "越中", "能登", "加賀", "越前", "若狭", "常陸", "下総", "上総", "安房", "武蔵",
    "甲斐", "相模", "伊豆", "駿河", "遠江", "三河", "尾張", "伊賀", "伊勢", "志摩",
    "山城", "大和", "河内", "和泉", "摂津", "丹波", "丹後", "但馬", "因幡", "伯耆",
    "出雲", "石見", "隠岐", "播磨", "美作", "備前", "備中", "備後", "安芸", "周防",
    "長門", "紀伊", "淡路", "讃岐", "阿波", "土佐", "伊予", "豊前", "豊後", "筑前",
    "筑後", "肥前", "肥後", "日向", "薩摩", "大隅", "対馬", "壱岐"
  ];

  function buildOldProvinceRegex(namesList) {
    const sorted = Array.from(new Set(namesList)).sort((a, b) => b.length - a.length);
    return new RegExp(sorted.map(escapeRegExp).join("|"));
  }

  let _oldProvinceRegex = buildOldProvinceRegex(DEFAULT_RYOSEIKOKU_NAMES);

  function initRyoseikoku(data) {
    if (!data || !data.answers) return;
    const names = new Set();
    data.answers.forEach(a => {
      if (Array.isArray(a.aliases)) {
        a.aliases.forEach(al => names.add(al));
      }
      if (a.name) {
        names.add(a.name.replace(/国$/, ""));
      }
    });
    if (names.size > 0) {
      _oldProvinceRegex = buildOldProvinceRegex(Array.from(names));
    }
  }

  /* ================================================
     都道府県名・他都道府県名判定
     ================================================ */
  const PREF_BASE_NAMES = {};
  for (const [cd, fullName] of Object.entries(PREF_NAMES)) {
    PREF_BASE_NAMES[cd] = fullName === "北海道" ? "北海道" : fullName.replace(/[都道府県]$/, "");
  }
  const sortedPrefBases = Object.values(PREF_BASE_NAMES).sort((a, b) => b.length - a.length);
  const PREF_NAME_REGEX = new RegExp(sortedPrefBases.map(escapeRegExp).join("|"));
  const PREF_NAME_GLOBAL_REGEX = new RegExp(sortedPrefBases.map(escapeRegExp).join("|"), "g");

  function getMatchedPrefCodes(name) {
    if (!name) return [];
    const matches = name.match(PREF_NAME_GLOBAL_REGEX);
    if (!matches) return [];
    const matchedSet = new Set(matches);
    const codes = [];
    for (const [cd, base] of Object.entries(PREF_BASE_NAMES)) {
      if (matchedSet.has(base)) {
        codes.push(Number(cd));
      }
    }
    return codes;
  }

  function containsOtherPref(station) {
    if (!station) return false;
    const name = getStationName(station);
    const matchedCodes = getMatchedPrefCodes(name);
    return matchedCodes.some(cd => cd !== station.pref_cd);
  }

  /* ================================================
     JR駅・非JR駅判定
     ================================================ */
  const JR_LINE_REGEX = /JR/;

  function isJrStation(station) {
    return Boolean(station && station.lines && station.lines.some(l => JR_LINE_REGEX.test(l)));
  }

  function isNonJrStation(station) {
    return Boolean(station && station.lines && station.lines.every(l => !JR_LINE_REGEX.test(l)));
  }

  /* ================================================
     その他条件 定義・評価
     ================================================ */
  const OTHER_CONDITIONS = [
    { value: "hiragana",      label: "ひらがなを含む" },
    { value: "katakana",      label: "カタカナを含む" },
    { value: "kanjiNumber",   label: "漢数字を含む" },
    { value: "duplicateChar", label: "同じ文字が二回以上含まれる" },
    { value: "direction",     label: "方角を含む（東/西/南/北）" },
    { value: "color",         label: "色の漢字を含む（赤/青/白/黒/金/銀/緑/紫/茶/黄）" },
    { value: "animal",        label: "動物の漢字を含む（馬/鹿/鶴/鳥/牛/熊/犬/猿/兎/龍/竜/蛇/鳩/雀/鷲/鷹/亀/虎/狸/鯉/鮎/鯖/鮫/鵜/鶯/鴨/鷺/猫/狐/蟹/豚/羊/鶏/鳳/鴻）" },
    { value: "plant",         label: "植物の漢字を含む（桜/松/竹/梅/杉/桂/藤/柳/桃/栗/楠/椿/萩/荻/蓮/菊/柏/桐/楓/椎/榎/柿/桑/蘭/芦/葦/菖/蒲/桧/檜/樫/楡/槙/柚/榊/樺/萱/茅/荏/蕨/芹/苔/葵）" },
    { value: "sameName",      label: "同名の駅が他にある" },
    { value: "otherPref",     label: "他都道府県名を含む" },
    { value: "containsPref",  label: "都道府県名を含む" },
    { value: "oldProvince",   label: "旧国名を含む" },
    { value: "nonJrStation",  label: "非JR駅（路線にJRが含まれない）" },
    { value: "jrStation",     label: "JR駅（路線にJRが含まれる）" },
  ];

  /**
   * 同名駅の名前セットを構築する（フィルタリング前に1回だけ呼ぶ）
   * @param {Array} stations - 全駅データ
   * @returns {Set<string>} 2回以上出現する駅名のセット
   */
  function buildSameNameSet(stations) {
    const counts = new Map();
    for (const st of stations) {
      const n = getStationName(st);
      counts.set(n, (counts.get(n) || 0) + 1);
    }
    const result = new Set();
    for (const [n, c] of counts) {
      if (c >= 2) result.add(n);
    }
    return result;
  }

  /** @type {Set<string>|null} 同名駅キャッシュ（loadData 後に構築） */
  let _sameNameSet = null;

  function evaluateOtherCondition(target, subType) {
    const station = typeof target === "object" && target !== null ? target : null;
    const name = station ? getStationName(station) : String(target || "");

    switch (subType) {
      case "hiragana":
        return /[ぁ-ん]/.test(name);
      case "katakana":
        return /[ァ-ヶー]/.test(name);
      case "kanjiNumber":
        return /[一二三四五六七八九十廿百千万億兆京]/.test(name);
      case "duplicateChar":
        return /(.).*\1/.test(name);
      case "direction":
        return /[東西南北]/.test(name);
      case "color":
        return /[赤青白黒金銀緑紫茶黄]/.test(name);
      case "animal":
        return /[馬鹿鶴鳥牛熊犬猿兎龍竜蛇鳩雀鷲鷹亀虎狸鯉鮎鯖鮫鵜鶯鴨鷺猫狐蟹豚羊鶏鳳鴻]/.test(name);
      case "plant":
        return /[桜松竹梅杉桂藤柳桃栗楠椿萩荻蓮菊柏桐楓椎榎柿桑蘭芦葦菖蒲桧檜樫楡槙柚榊樺萱茅荏蕨芹苔葵]/.test(name);
      case "sameName":
        return _sameNameSet ? _sameNameSet.has(name) : false;
      case "otherPref":
        return containsOtherPref(station);
      case "containsPref":
        return PREF_NAME_REGEX.test(name);
      case "oldProvince":
        return _oldProvinceRegex ? _oldProvinceRegex.test(name) : false;
      case "nonJrStation":
        return isNonJrStation(station);
      case "jrStation":
        return isJrStation(station);
      default:
        return true;
    }
  }

  /* ================================================
     数値比較 評価
     ================================================ */
  function evaluateNumberComparison(actualValue, targetValue, operator) {
    const target = parseInt(targetValue, 10);
    if (isNaN(target)) return true;
    switch (operator) {
      case "gte":
        return actualValue >= target;
      case "lte":
        return actualValue <= target;
      case "eq":
      default:
        return actualValue === target;
    }
  }

  /* ================================================
     フィルタ評価
     ================================================ */
  function evaluateCondition(station, cond) {
    const name = getStationName(station);
    switch (cond.type) {
      case "prefecture":
        return cond.values && cond.values.includes(station.pref_cd);
      case "region":
        return cond.values && cond.values.some(reg => {
          const prefs = REGION_PREFECTURES[reg];
          return prefs && prefs.includes(station.pref_cd);
        });
      case "company":
        return cond.values && station.companies.some(c => cond.values.includes(c));
      case "line":
        return cond.values && station.lines.some(l => cond.values.includes(l));
      case "lineCount":
        return evaluateNumberComparison((station.lines || []).length, cond.value, cond.operator || "gte");
      case "companyCount":
        return evaluateNumberComparison((station.companies || []).length, cond.value, cond.operator || "gte");
      case "charCount":
        return evaluateNumberComparison(name.length, cond.value, cond.operator || "eq");
      case "startsWith":
        return cond.value && name.startsWith(cond.value);
      case "endsWith":
        return cond.value && name.endsWith(cond.value);
      case "contains":
        return cond.value && name.includes(cond.value);
      case "other":
        return evaluateOtherCondition(station, cond.value);
      default:
        return true;
    }
  }

  /** 条件が有効（値が入っている）か判定 */
  function isConditionValid(cond) {
    if (!cond.type) return false;
    if (cond.type === "prefecture" || cond.type === "region" || cond.type === "company" || cond.type === "line") {
      return cond.values && cond.values.length > 0;
    }
    return cond.value !== undefined && cond.value !== null && String(cond.value).trim() !== "";
  }

  function filterStations(stations, conditions, combineMode) {
    const valid = conditions.filter(isConditionValid);
    if (valid.length === 0) return stations;

    // 「同名の駅が他にある」条件がある場合、キャッシュを構築
    if (!_sameNameSet && valid.some(c => c.type === "other" && c.value === "sameName")) {
      _sameNameSet = buildSameNameSet(stations);
    }

    return stations.filter(station => {
      const results = valid.map(c => evaluateCondition(station, c));
      return combineMode === "AND"
        ? results.every(r => r)
        : results.some(r => r);
    });
  }

  /* ================================================
     マルチセレクト コンポーネント
     ================================================ */
  class MultiSelect {
    constructor(container, options, placeholder) {
      this.container = container;
      this.allOptions = options; // [{value, label}]
      this.selected = new Set();
      this.onChangeCallback = null;
      this.isOpen = false;
      this.render(placeholder || "選択してください");
    }

    render(placeholder) {
      this.el = document.createElement("div");
      this.el.className = "multi-select";

      // トリガー
      this.trigger = document.createElement("button");
      this.trigger.type = "button";
      this.trigger.className = "multi-select-trigger";
      this.trigger.innerHTML = `<span class="ms-label">${placeholder}</span><span class="ms-arrow">▼</span>`;
      this.trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggle();
      });

      // パネル
      this.panel = document.createElement("div");
      this.panel.className = "multi-select-panel";
      this.panel.style.display = "none";
      this.panel.addEventListener("click", (e) => e.stopPropagation());

      // 検索
      const search = document.createElement("input");
      search.type = "text";
      search.className = "multi-select-search";
      search.placeholder = "検索...";
      search.addEventListener("input", () => this.filterOptions(search.value));

      // コントロール
      const controls = document.createElement("div");
      controls.className = "multi-select-controls";
      const selectAll = document.createElement("button");
      selectAll.type = "button";
      selectAll.textContent = "全選択";
      selectAll.addEventListener("click", () => this.selectAll());
      const clearAll = document.createElement("button");
      clearAll.type = "button";
      clearAll.textContent = "全解除";
      clearAll.addEventListener("click", () => this.clearAll());
      controls.appendChild(selectAll);
      controls.appendChild(clearAll);

      // オプション
      this.optionsContainer = document.createElement("div");
      this.optionsContainer.className = "multi-select-options";
      this.allOptions.forEach(opt => {
        const label = document.createElement("label");
        label.className = "ms-option";
        label.dataset.search = opt.label.toLowerCase();
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = typeof opt.value === "number" ? String(opt.value) : opt.value;
        cb.addEventListener("change", () => {
          if (cb.checked) this.selected.add(opt.value);
          else this.selected.delete(opt.value);
          this.updateTriggerText();
          if (this.onChangeCallback) this.onChangeCallback();
        });
        const span = document.createElement("span");
        span.textContent = opt.label;
        label.appendChild(cb);
        label.appendChild(span);
        this.optionsContainer.appendChild(label);
      });

      this.panel.appendChild(search);
      this.panel.appendChild(controls);
      this.panel.appendChild(this.optionsContainer);
      this.el.appendChild(this.trigger);
      this.el.appendChild(this.panel);
      this.container.appendChild(this.el);

      // 外部クリックで閉じる
      this._outsideClick = () => { if (this.isOpen) this.close(); };
      document.addEventListener("click", this._outsideClick);
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      this.isOpen = true;
      this.panel.style.display = "flex";
      this.el.classList.add("open");
    }

    close() {
      this.isOpen = false;
      this.panel.style.display = "none";
      this.el.classList.remove("open");
    }

    filterOptions(query) {
      const q = query.toLowerCase();
      this.optionsContainer.querySelectorAll(".ms-option").forEach(label => {
        label.classList.toggle("hidden", !label.dataset.search.includes(q));
      });
    }

    selectAll() {
      // 現在表示されているもののみ選択
      this.optionsContainer.querySelectorAll(".ms-option:not(.hidden) input").forEach(cb => {
        cb.checked = true;
        const val = this.parseValue(cb.value);
        this.selected.add(val);
      });
      this.updateTriggerText();
      if (this.onChangeCallback) this.onChangeCallback();
    }

    clearAll() {
      this.optionsContainer.querySelectorAll("input").forEach(cb => {
        cb.checked = false;
      });
      this.selected.clear();
      this.updateTriggerText();
      if (this.onChangeCallback) this.onChangeCallback();
    }

    parseValue(v) {
      // 数値の場合は数値に戻す
      const n = Number(v);
      return this.allOptions.some(o => o.value === n) ? n : v;
    }

    updateTriggerText() {
      const label = this.trigger.querySelector(".ms-label");
      if (this.selected.size === 0) {
        label.textContent = "選択してください";
      } else {
        label.textContent = `${this.selected.size} 件選択中`;
      }
    }

    getValues() {
      return Array.from(this.selected);
    }

    onChange(cb) {
      this.onChangeCallback = cb;
    }

    destroy() {
      document.removeEventListener("click", this._outsideClick);
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }
  }

  /* ================================================
     フィルタ UI クラス
     ================================================ */
  const CONDITION_TYPES = [
    { value: "prefecture",   label: "都道府県" },
    { value: "region",       label: "地方" },
    { value: "company",      label: "鉄道会社" },
    { value: "line",         label: "路線" },
    { value: "lineCount",    label: "路線数" },
    { value: "companyCount", label: "鉄道会社数" },
    { value: "charCount",    label: "文字数" },
    { value: "startsWith",   label: "〜から始まる" },
    { value: "endsWith",     label: "〜で終わる" },
    { value: "contains",     label: "〜を含む" },
    { value: "other",        label: "その他" },
  ];

  class FilterUI {
    constructor(container, allStations, options = {}) {
      this.container = container;
      this.allStations = allStations;
      this.combineMode = "AND";
      this.conditionRows = [];
      this.onUpdateCallback = options.onUpdate || null;

      // 同名駅キャッシュを構築（初回のみ）
      if (!_sameNameSet) {
        _sameNameSet = buildSameNameSet(allStations);
      }

      // 選択肢キャッシュ
      this._prefOptions = getUniquePrefCodes(allStations).map(cd => ({
        value: cd, label: getPrefName(cd)
      }));
      this._regionOptions = REGION_OPTIONS;
      this._companyOptions = getUniqueCompanies(allStations).map(c => ({
        value: c, label: c
      }));
      this._lineOptions = getUniqueLines(allStations).map(l => ({
        value: l, label: l
      }));

      this.render();
      this.addCondition();
      this.updatePreview();
    }

    render() {
      this.container.innerHTML = "";
      this.container.classList.add("filter-panel");

      // タイトル
      const title = document.createElement("h3");
      title.className = "filter-title";
      title.textContent = "🔍 フィルタ条件";
      this.container.appendChild(title);

      // AND/OR トグル
      const combineDiv = document.createElement("div");
      combineDiv.className = "combine-mode";
      ["AND", "OR"].forEach(mode => {
        const label = document.createElement("label");
        label.className = "combine-option";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "combineMode_" + Math.random().toString(36).slice(2);
        radio.value = mode;
        radio.checked = mode === "AND";
        radio.addEventListener("change", () => {
          this.combineMode = mode;
          this.updatePreview();
        });
        const span = document.createElement("span");
        span.textContent = mode === "AND" ? "AND（すべて満たす）" : "OR（いずれか満たす）";
        label.appendChild(radio);
        label.appendChild(span);
        combineDiv.appendChild(label);
      });
      this.container.appendChild(combineDiv);

      // 条件リスト
      this.conditionListEl = document.createElement("div");
      this.conditionListEl.className = "condition-list";
      this.container.appendChild(this.conditionListEl);

      // 追加ボタン
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "condition-add-btn";
      addBtn.textContent = "+ 条件を追加";
      addBtn.addEventListener("click", () => this.addCondition());
      this.container.appendChild(addBtn);

      // プレビュー
      this.previewEl = document.createElement("div");
      this.previewEl.className = "filter-preview";
      this.container.appendChild(this.previewEl);
    }

    addCondition() {
      const index = this.conditionRows.length;
      const row = { type: "", value: null, values: null, operator: "eq", multiSelect: null };
      this.conditionRows.push(row);

      const rowEl = document.createElement("div");
      rowEl.className = "condition-row";

      // タイプセレクト
      const typeSelect = document.createElement("select");
      typeSelect.className = "condition-type-select";
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "-- 条件を選択 --";
      typeSelect.appendChild(defaultOpt);
      CONDITION_TYPES.forEach(ct => {
        const opt = document.createElement("option");
        opt.value = ct.value;
        opt.textContent = ct.label;
        typeSelect.appendChild(opt);
      });

      // 値エリア
      const valueArea = document.createElement("div");
      valueArea.className = "condition-value-area";

      typeSelect.addEventListener("change", () => {
        row.type = typeSelect.value;
        row.value = null;
        row.values = null;
        row.operator = (row.type === "charCount") ? "eq" : "gte";
        if (row.multiSelect) {
          row.multiSelect.destroy();
          row.multiSelect = null;
        }
        this.renderValueArea(row, valueArea);
        this.updatePreview();
      });

      // 削除ボタン
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "condition-remove-btn";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        const idx = this.conditionRows.indexOf(row);
        if (idx !== -1) {
          this.conditionRows.splice(idx, 1);
          if (row.multiSelect) row.multiSelect.destroy();
          rowEl.remove();
          this.updatePreview();
        }
      });

      rowEl.appendChild(typeSelect);
      rowEl.appendChild(valueArea);
      rowEl.appendChild(removeBtn);
      this.conditionListEl.appendChild(rowEl);
    }

    renderValueArea(row, container) {
      container.innerHTML = "";
      const type = row.type;

      if (type === "prefecture" || type === "region" || type === "company" || type === "line") {
        let options;
        let placeholder;
        if (type === "prefecture") {
          options = this._prefOptions;
          placeholder = "都道府県を選択";
        } else if (type === "region") {
          options = this._regionOptions;
          placeholder = "地方を選択";
        } else if (type === "company") {
          options = this._companyOptions;
          placeholder = "鉄道会社を選択";
        } else {
          options = this._lineOptions;
          placeholder = "路線を選択";
        }
        const ms = new MultiSelect(container, options, placeholder);
        ms.onChange(() => {
          row.values = ms.getValues();
          this.updatePreview();
        });
        row.multiSelect = ms;
      } else if (type === "charCount" || type === "lineCount" || type === "companyCount") {
        const wrap = document.createElement("div");
        wrap.className = "number-condition-wrap";

        const input = document.createElement("input");
        input.type = "number";
        input.min = "1";
        const placeholders = {
          charCount: "文字数を入力",
          lineCount: "路線数を入力",
          companyCount: "会社数を入力"
        };
        input.placeholder = placeholders[type] || "数値を入力";
        if (row.value !== null && row.value !== undefined) {
          input.value = row.value;
        }

        const defaultOp = (type === "charCount") ? "eq" : "gte";
        row.operator = row.operator || defaultOp;

        const opSelect = document.createElement("select");
        opSelect.className = "condition-operator-select";
        OPERATOR_OPTIONS.forEach(op => {
          const opt = document.createElement("option");
          opt.value = op.value;
          opt.textContent = op.label;
          if (op.value === row.operator) opt.selected = true;
          opSelect.appendChild(opt);
        });

        input.addEventListener("input", () => {
          row.value = input.value;
          this.updatePreview();
        });

        opSelect.addEventListener("change", () => {
          row.operator = opSelect.value;
          this.updatePreview();
        });

        wrap.appendChild(input);
        wrap.appendChild(opSelect);
        container.appendChild(wrap);
      } else if (type === "startsWith" || type === "endsWith" || type === "contains") {
        const input = document.createElement("input");
        input.type = "text";
        const labels = { startsWith: "先頭の文字列", endsWith: "末尾の文字列", contains: "含む文字列" };
        input.placeholder = labels[type] || "文字列を入力";
        input.addEventListener("input", () => {
          row.value = input.value;
          this.updatePreview();
        });
        container.appendChild(input);
      } else if (type === "other") {
        const select = document.createElement("select");
        select.className = "condition-other-select";
        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        defaultOpt.textContent = "-- その他条件を選択 --";
        select.appendChild(defaultOpt);
        OTHER_CONDITIONS.forEach(oc => {
          const opt = document.createElement("option");
          opt.value = oc.value;
          opt.textContent = oc.label;
          if (row.value === oc.value) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener("change", () => {
          row.value = select.value;
          this.updatePreview();
        });
        container.appendChild(select);
      }
    }

    getConditions() {
      return this.conditionRows.map(r => ({
        type: r.type,
        value: r.value,
        values: r.values,
        operator: r.operator
      }));
    }

    getFilteredStations() {
      return filterStations(this.allStations, this.getConditions(), this.combineMode);
    }

    /**
     * 適用中フィルタ条件の概要を文字列配列で返す
     * 有効な条件が無い場合は ["（条件なし）"] を返す
     */
    getSummaryLines() {
      const TYPE_LABELS = {
        prefecture:   "都道府県",
        region:       "地方",
        company:      "鉄道会社",
        line:         "路線",
        lineCount:    "路線数",
        companyCount: "鉄道会社数",
        charCount:    "文字数",
        startsWith:   "〜から始まる",
        endsWith:     "〜で終わる",
        contains:     "〜を含む",
        other:        "その他",
      };
      const OP_LABELS = {
        gte: "以上",
        lte: "以下",
        eq:  "等しい"
      };
      const valid = this.conditionRows.filter(r => isConditionValid(r));
      if (valid.length === 0) return ["（条件なし・全駅対象）"];

      const lines = valid.map(r => {
        const label = TYPE_LABELS[r.type] || r.type;
        if (r.type === "prefecture" && r.values) {
          const names = r.values.map(cd => getPrefName(cd));
          return `${label}：${names.join("、")}`;
        }
        if (r.type === "region" && r.values) {
          return `${label}：${r.values.join("、")}`;
        }
        if ((r.type === "company" || r.type === "line") && r.values) {
          return `${label}：${r.values.join("、")}`;
        }
        if (r.type === "charCount" || r.type === "lineCount" || r.type === "companyCount") {
          const opText = OP_LABELS[r.operator] || "等しい";
          const unit = r.type === "charCount" ? "文字" : (r.type === "lineCount" ? "路線" : "社");
          return `${label}：${r.value} ${unit}（${opText}）`;
        }
        if (r.type === "other") {
          const target = OTHER_CONDITIONS.find(o => o.value === r.value);
          return `${label}：${target ? target.label : r.value}`;
        }
        return `${label}：${r.value}`;
      });

      const modeStr = this.combineMode === "AND" ? "AND（すべて満たす）" : "OR（いずれか満たす）";
      return [`結合条件：${modeStr}`, ...lines];
    }

    updatePreview() {
      const filtered = this.getFilteredStations();
      this.previewEl.innerHTML = `該当駅数: <strong>${filtered.length}</strong> 件`;
      if (this.onUpdateCallback) this.onUpdateCallback(filtered);
    }
  }

  /* ================================================
     公開API
     ================================================ */
  return {
    PREF_NAMES,
    REGION_PREFECTURES,
    REGION_OPTIONS,
    OPERATOR_OPTIONS,
    OTHER_CONDITIONS,
    loadData,
    initRyoseikoku,
    getStationName,
    getPrefName,
    stripPrefSuffix,
    matchPrefecture,
    filterStations,
    evaluateOtherCondition,
    buildSameNameSet,
    getMatchedPrefCodes,
    containsOtherPref,
    isJrStation,
    isNonJrStation,
    getUniqueCompanies,
    getUniqueLines,
    getUniquePrefCodes,
    FilterUI
  };

})();
