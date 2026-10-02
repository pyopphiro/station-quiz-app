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
     ユーティリティ
     ================================================ */
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
    const res = await fetch("station-dataset.json");
    return res.json();
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
     フィルタ評価
     ================================================ */
  function evaluateCondition(station, cond) {
    const name = getStationName(station);
    switch (cond.type) {
      case "prefecture":
        return cond.values && cond.values.includes(station.pref_cd);
      case "company":
        return cond.values && station.companies.some(c => cond.values.includes(c));
      case "line":
        return cond.values && station.lines.some(l => cond.values.includes(l));
      case "charCount":
        return name.length === parseInt(cond.value, 10);
      case "startsWith":
        return cond.value && name.startsWith(cond.value);
      case "endsWith":
        return cond.value && name.endsWith(cond.value);
      case "contains":
        return cond.value && name.includes(cond.value);
      default:
        return true;
    }
  }

  /** 条件が有効（値が入っている）か判定 */
  function isConditionValid(cond) {
    if (!cond.type) return false;
    if (cond.type === "prefecture" || cond.type === "company" || cond.type === "line") {
      return cond.values && cond.values.length > 0;
    }
    return cond.value !== undefined && cond.value !== null && String(cond.value).trim() !== "";
  }

  function filterStations(stations, conditions, combineMode) {
    const valid = conditions.filter(isConditionValid);
    if (valid.length === 0) return stations;
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
    { value: "prefecture", label: "都道府県" },
    { value: "company",    label: "鉄道会社" },
    { value: "line",       label: "路線" },
    { value: "charCount",  label: "文字数" },
    { value: "startsWith", label: "〜から始まる" },
    { value: "endsWith",   label: "〜で終わる" },
    { value: "contains",   label: "〜を含む" },
  ];

  class FilterUI {
    constructor(container, allStations, options = {}) {
      this.container = container;
      this.allStations = allStations;
      this.combineMode = "AND";
      this.conditionRows = [];
      this.onUpdateCallback = options.onUpdate || null;

      // 選択肢キャッシュ
      this._prefOptions = getUniquePrefCodes(allStations).map(cd => ({
        value: cd, label: getPrefName(cd)
      }));
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
      const row = { type: "", value: null, values: null, multiSelect: null };
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

      if (type === "prefecture" || type === "company" || type === "line") {
        let options;
        let placeholder;
        if (type === "prefecture") {
          options = this._prefOptions;
          placeholder = "都道府県を選択";
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
      } else if (type === "charCount") {
        const input = document.createElement("input");
        input.type = "number";
        input.min = "1";
        input.placeholder = "文字数を入力";
        input.addEventListener("input", () => {
          row.value = input.value;
          this.updatePreview();
        });
        container.appendChild(input);
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
      }
    }

    getConditions() {
      return this.conditionRows.map(r => ({
        type: r.type,
        value: r.value,
        values: r.values
      }));
    }

    getFilteredStations() {
      return filterStations(this.allStations, this.getConditions(), this.combineMode);
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
    loadData,
    getStationName,
    getPrefName,
    stripPrefSuffix,
    matchPrefecture,
    filterStations,
    getUniqueCompanies,
    getUniqueLines,
    getUniquePrefCodes,
    FilterUI
  };

})();
