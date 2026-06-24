const STORAGE_KEY = "local-ledger-pwa-state-v1";
const INCOME_LEDGER_ID = "system-income-ledger";

const defaultCategories = {
  expense: ["餐饮", "交通", "服装", "住房", "购物", "娱乐", "医疗", "学习", "其他"],
  income: ["工资", "奖金", "报销", "投资", "兼职", "其他"],
};

const chartColors = ["#2f6f73", "#d88d4a", "#6e5ca8", "#bf4b45", "#3f7cac", "#7a8f3f", "#ad6a6c", "#595959"];

const els = {
  monthBalance: document.querySelector("#monthBalance"),
  monthExpense: document.querySelector("#monthExpense"),
  monthIncome: document.querySelector("#monthIncome"),
  ledgerSelect: document.querySelector("#ledgerSelect"),
  entryLedgerSelect: document.querySelector("#entryLedgerSelect"),
  monthFilter: document.querySelector("#monthFilter"),
  monthLedgerSpend: document.querySelector("#monthLedgerSpend"),
  newLedgerButton: document.querySelector("#newLedgerButton"),
  deleteLedgerButton: document.querySelector("#deleteLedgerButton"),
  entryForm: document.querySelector("#entryForm"),
  amountInput: document.querySelector("#amountInput"),
  dateInput: document.querySelector("#dateInput"),
  noteInput: document.querySelector("#noteInput"),
  categoryGrid: document.querySelector("#categoryGrid"),
  expenseTypeButton: document.querySelector("#expenseTypeButton"),
  incomeTypeButton: document.querySelector("#incomeTypeButton"),
  categoryChart: document.querySelector("#categoryChart"),
  trendChart: document.querySelector("#trendChart"),
  categoryLegend: document.querySelector("#categoryLegend"),
  trendLegend: document.querySelector("#trendLegend"),
  categoryChartTitle: document.querySelector("#categoryChartTitle"),
  trendChartTitle: document.querySelector("#trendChartTitle"),
  trendChartHint: document.querySelector("#trendChartHint"),
  chartHint: document.querySelector("#chartHint"),
  recordList: document.querySelector("#recordList"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  importButton: document.querySelector("#importButton"),
  importInput: document.querySelector("#importInput"),
  ledgerDialog: document.querySelector("#ledgerDialog"),
  ledgerForm: document.querySelector("#ledgerForm"),
  ledgerNameInput: document.querySelector("#ledgerNameInput"),
  cancelLedgerButton: document.querySelector("#cancelLedgerButton"),
  toast: document.querySelector("#toast"),
};

let state = loadState();
let currentType = "expense";
let selectedCategory = defaultCategories.expense[0];
let selectedLedgerId = state.activeLedgerId;
let toastTimer = 0;
let lastRenderWidth = window.innerWidth;
let resizeFrame = 0;

function createInitialState() {
  const ledgerId = makeId();
  const today = new Date();
  return {
    activeLedgerId: ledgerId,
    ledgers: [
      { id: ledgerId, name: "生活账本", type: "expense", createdAt: today.toISOString() },
      { id: INCOME_LEDGER_ID, name: "收入账本", type: "income", system: true, createdAt: today.toISOString() },
    ],
    entries: [
      {
        id: makeId(),
        ledgerId,
        type: "expense",
        amount: 28,
        category: "餐饮",
        date: toDateInputValue(today),
        note: "示例：午餐",
        createdAt: today.toISOString(),
      },
      {
        id: makeId(),
        ledgerId,
        type: "expense",
        amount: 6,
        category: "交通",
        date: toDateInputValue(today),
        note: "示例：地铁",
        createdAt: today.toISOString(),
      },
    ],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.ledgers) || !Array.isArray(parsed.entries)) {
      return createInitialState();
    }
    return normalizeState(parsed);
  } catch {
    return createInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeState(nextState) {
  const today = new Date().toISOString();
  nextState.ledgers = nextState.ledgers.map((ledger) => ({
    ...ledger,
    type: ledger.id === INCOME_LEDGER_ID || ledger.type === "income" ? "income" : "expense",
    system: ledger.id === INCOME_LEDGER_ID || ledger.system === true,
  }));

  const hasIncomeLedger = nextState.ledgers.some((ledger) => ledger.id === INCOME_LEDGER_ID);
  if (!hasIncomeLedger) {
    nextState.ledgers.push({
      id: INCOME_LEDGER_ID,
      name: "收入账本",
      type: "income",
      system: true,
      createdAt: today,
    });
  }

  const expenseLedgersList = nextState.ledgers.filter((ledger) => ledger.type !== "income");
  if (!expenseLedgersList.length) {
    const ledgerId = makeId();
    nextState.ledgers.unshift({ id: ledgerId, name: "生活账本", type: "expense", createdAt: today });
  }

  nextState.entries = nextState.entries.map((entry) => ({
    ...entry,
    ledgerId: entry.type === "income" ? INCOME_LEDGER_ID : entry.ledgerId,
  }));

  const validLedgerIds = new Set(nextState.ledgers.map((ledger) => ledger.id));
  const firstExpenseId = nextState.ledgers.find((ledger) => ledger.type !== "income")?.id;
  nextState.entries = nextState.entries.map((entry) => ({
    ...entry,
    ledgerId: validLedgerIds.has(entry.ledgerId) ? entry.ledgerId : firstExpenseId,
  }));

  if (!validLedgerIds.has(nextState.activeLedgerId)) {
    nextState.activeLedgerId = firstExpenseId;
  }

  return nextState;
}

function makeId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `id-${Date.now().toString(36)}-${random}`;
}

function money(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthInputValue(date) {
  return toDateInputValue(date).slice(0, 7);
}

function currentEntries() {
  const month = els.monthFilter.value;
  return state.entries
    .filter((entry) => entry.ledgerId === selectedLedgerId && entry.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function monthEntries() {
  const month = els.monthFilter.value;
  return state.entries.filter((entry) => entry.date.startsWith(month));
}

function expenseLedgers() {
  return state.ledgers.filter((ledger) => ledger.type !== "income");
}

function incomeLedger() {
  return state.ledgers.find((ledger) => ledger.id === INCOME_LEDGER_ID);
}

function selectedLedger() {
  return state.ledgers.find((ledger) => ledger.id === selectedLedgerId);
}

function render() {
  syncModeWithSelectedLedger();
  renderLedgers();
  renderModeLabels();
  renderCategories();
  renderSummary();
  renderCategoryChart();
  renderTrendChart();
  renderRecords();
}

function syncModeWithSelectedLedger() {
  if (selectedLedger()?.type === "income") {
    currentType = "income";
  }
}

function renderModeLabels() {
  const isIncomeLedger = selectedLedger()?.type === "income";
  els.entryForm.classList.toggle("income-ledger-mode", isIncomeLedger);
  els.entryForm.classList.toggle("expense-ledger-mode", !isIncomeLedger);
  els.expenseTypeButton.classList.toggle("active", currentType === "expense");
  els.incomeTypeButton.classList.toggle("active", currentType === "income");
  els.categoryChartTitle.textContent = isIncomeLedger ? "收入来源" : "支出去向";
  els.trendChartTitle.textContent = isIncomeLedger ? "收入月度趋势" : "月度趋势";
  els.trendChartHint.textContent = isIncomeLedger ? "最近 6 个月收入" : "最近 6 个月";
}

function renderLedgers() {
  const options = state.ledgers.map((ledger) => `<option value="${ledger.id}">${escapeHtml(ledger.name)}</option>`).join("");
  const expenseOptions = expenseLedgers()
    .map((ledger) => `<option value="${ledger.id}">${escapeHtml(ledger.name)}</option>`)
    .join("");
  const incomeOption = `<option value="${INCOME_LEDGER_ID}">${escapeHtml(incomeLedger()?.name || "收入账本")}</option>`;
  els.ledgerSelect.innerHTML = options;
  els.entryLedgerSelect.innerHTML = currentType === "income" ? incomeOption : expenseOptions;
  els.entryLedgerSelect.disabled = currentType === "income";
  els.ledgerSelect.value = selectedLedgerId;
  els.entryLedgerSelect.value = currentType === "income" ? INCOME_LEDGER_ID : getExpenseLedgerIdForEntry();
  els.deleteLedgerButton.disabled = selectedLedger()?.type === "income" || expenseLedgers().length <= 1;
}

function getExpenseLedgerIdForEntry() {
  if (selectedLedger()?.type !== "income") return selectedLedgerId;
  return expenseLedgers()[0]?.id;
}

function renderCategories() {
  const categories = defaultCategories[currentType];
  if (!categories.includes(selectedCategory)) {
    selectedCategory = categories[0];
  }
  els.categoryGrid.innerHTML = categories
    .map(
      (category) =>
        `<button type="button" data-category="${escapeAttr(category)}" class="${category === selectedCategory ? "active" : ""}">${escapeHtml(category)}</button>`,
    )
    .join("");
}

function renderSummary() {
  const entries = monthEntries();
  const expense = sumEntries(entries.filter((entry) => entry.type === "expense"));
  const income = sumEntries(entries.filter((entry) => entry.type === "income"));
  const isIncomeLedger = selectedLedger()?.type === "income";
  const currentLedgerAmount = sumEntries(currentEntries().filter((entry) => entry.type === (isIncomeLedger ? "income" : "expense")));
  els.monthExpense.textContent = money(expense);
  els.monthIncome.textContent = money(income);
  els.monthBalance.textContent = money(income - expense);
  els.monthLedgerSpend.textContent = `${selectedLedger()?.name || "该账本"} · 该月${isIncomeLedger ? "收入" : "支出"} ${money(currentLedgerAmount)}`;
}

function sumEntries(entries) {
  return entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
}

function renderRecords() {
  const entries = currentEntries();
  if (!entries.length) {
    els.recordList.innerHTML = `<div class="empty-state">这个月份还没有记录</div>`;
    return;
  }

  els.recordList.innerHTML = entries
    .map((entry) => {
      const ledger = state.ledgers.find((item) => item.id === entry.ledgerId);
      const sign = entry.type === "expense" ? "-" : "+";
      const amountClass = entry.type === "expense" ? "expense" : "income";
      const note = entry.note ? ` · ${entry.note}` : "";
      return `
        <article class="record-card">
          <div class="record-main">
            <div class="record-title">
              <span>${escapeHtml(entry.category)}</span>
            </div>
            <div class="record-meta">${escapeHtml(entry.date)} · ${escapeHtml(ledger?.name || "账本")}${escapeHtml(note)}</div>
          </div>
          <div>
            <div class="record-amount ${amountClass}">${sign}${money(entry.amount)}</div>
            <button class="record-delete" type="button" data-delete="${entry.id}" title="删除记录" aria-label="删除记录">删</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCategoryChart() {
  const { ctx, width, height } = prepareCanvas(els.categoryChart);
  const isIncomeLedger = selectedLedger()?.type === "income";
  const chartType = isIncomeLedger ? "income" : "expense";
  const entries = currentEntries().filter((entry) => entry.type === chartType);
  const totals = groupByCategory(entries);
  const total = totals.reduce((sum, item) => sum + item.amount, 0);
  ctx.clearRect(0, 0, width, height);

  if (!total) {
    drawEmptyChart(ctx, width, height, isIncomeLedger ? "暂无收入" : "暂无支出");
    els.categoryLegend.innerHTML = "";
    els.chartHint.textContent = `${selectedLedger()?.name || "账本"} · 暂无${isIncomeLedger ? "收入" : "支出"}`;
    return;
  }

  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(width, height) * 0.38;
  const innerRadius = outerRadius * 0.58;
  let startAngle = -Math.PI / 2;

  totals.forEach((item, index) => {
    const slice = (item.amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerRadius, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = chartColors[index % chartColors.length];
    ctx.fill();
    startAngle += slice;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#fffdfa";
  ctx.fill();

  ctx.fillStyle = "#22201c";
  ctx.font = "800 21px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(money(total), cx, cy - 4);
  ctx.fillStyle = "#726b61";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.fillText(isIncomeLedger ? "本月收入" : "本月支出", cx, cy + 18);

  els.chartHint.textContent = `${selectedLedger()?.name || "账本"} · ${totals.length} 个分类`;
  els.categoryLegend.innerHTML = totals
    .map(
      (item, index) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${chartColors[index % chartColors.length]}"></span>
          <span>${escapeHtml(item.category)} ${money(item.amount)}</span>
        </div>
      `,
    )
    .join("");
}

function renderTrendChart() {
  const { ctx, width, height } = prepareCanvas(els.trendChart);
  ctx.clearRect(0, 0, width, height);

  const months = lastSixMonths(els.monthFilter.value);
  const isIncomeLedger = selectedLedger()?.type === "income";
  const series = isIncomeLedger ? incomeTrendSeries(months) : expenseTrendSeries(months);
  const monthlyTotals = months.map((_, monthIndex) => series.reduce((sum, item) => sum + item.values[monthIndex], 0));
  const max = Math.max(...monthlyTotals, 1);
  const chartLeft = 30;
  const chartRight = width - 14;
  const chartBottom = height - 26;
  const chartTop = 12;
  const barGap = Math.max(6, Math.min(10, width * 0.025));
  const barWidth = (chartRight - chartLeft - barGap * (months.length - 1)) / months.length;

  ctx.strokeStyle = "#e5ded2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chartLeft, chartBottom);
  ctx.lineTo(chartRight, chartBottom);
  ctx.stroke();

  months.forEach((month, index) => {
    const x = chartLeft + index * (barWidth + barGap);
    let y = chartBottom;
    series.forEach((item) => {
      const segmentHeight = ((chartBottom - chartTop) * item.values[index]) / max;
      if (!segmentHeight) return;
      y -= segmentHeight;
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y, barWidth, Math.max(2, segmentHeight));
    });
    if (!monthlyTotals[index]) {
      ctx.fillStyle = "#2f6f73";
      ctx.fillRect(x, chartBottom - 2, barWidth, 2);
    }
    ctx.fillStyle = "#726b61";
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(month.label, x + barWidth / 2, height - 8);
  });

  const ledgersWithData = series.filter((item) => item.values.some((value) => value > 0));
  els.trendLegend.innerHTML = (ledgersWithData.length ? ledgersWithData : series)
    .map(
      (item) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${item.color}"></span>
          <span>${escapeHtml(item.label)}</span>
        </div>
      `,
    )
    .join("");
}

function expenseTrendSeries(months) {
  return expenseLedgers().map((ledger, ledgerIndex) => ({
    label: ledger.name,
    color: chartColors[ledgerIndex % chartColors.length],
    values: months.map((month) =>
      sumEntries(
        state.entries.filter(
          (entry) => entry.ledgerId === ledger.id && entry.type === "expense" && entry.date.startsWith(month.value),
        ),
      ),
    ),
  }));
}

function incomeTrendSeries(months) {
  return defaultCategories.income.map((category, index) => ({
    label: category,
    color: chartColors[index % chartColors.length],
    values: months.map((month) =>
      sumEntries(
        state.entries.filter(
          (entry) => entry.type === "income" && entry.category === category && entry.date.startsWith(month.value),
        ),
      ),
    ),
  }));
}

function groupByCategory(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    map.set(entry.category, (map.get(entry.category) || 0) + Number(entry.amount || 0));
  });
  return Array.from(map, ([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

function lastSixMonths(baseMonth) {
  const [year, month] = baseMonth.split("-").map(Number);
  const base = new Date(year, month - 1, 1);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - (5 - index), 1);
    const value = toMonthInputValue(date);
    return { value, label: `${date.getMonth() + 1}月` };
  });
}

function prepareCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height || Number(canvas.dataset.chartHeight) || 180));
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  return { ctx, width, height };
}

function drawEmptyChart(ctx, width, height, text) {
  ctx.fillStyle = "#f1ece3";
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#726b61";
  ctx.font = "800 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height / 2 + 5);
}

function roundRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function setType(type) {
  if (selectedLedger()?.type === "income" && type === "expense") return;
  currentType = type;
  els.expenseTypeButton.classList.toggle("active", type === "expense");
  els.incomeTypeButton.classList.toggle("active", type === "income");
  selectedCategory = defaultCategories[type][0];
  renderLedgers();
  renderCategories();
}

function addEntry(event) {
  event.preventDefault();
  const amount = Number(els.amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("请输入有效金额");
    return;
  }

  const entry = {
    id: makeId(),
    ledgerId: currentType === "income" ? INCOME_LEDGER_ID : els.entryLedgerSelect.value,
    type: currentType,
    amount: Math.round(amount * 100) / 100,
    category: selectedCategory,
    date: els.dateInput.value,
    note: els.noteInput.value.trim(),
    createdAt: new Date().toISOString(),
  };
  state.entries.push(entry);
  selectedLedgerId = entry.ledgerId;
  state.activeLedgerId = selectedLedgerId;
  saveState();
  els.amountInput.value = "";
  els.noteInput.value = "";
  render();
  showToast("已保存");
}

function createLedger(event) {
  event.preventDefault();
  const name = els.ledgerNameInput.value.trim();
  if (!name) return;
  const ledger = {
    id: makeId(),
    name,
    type: "expense",
    createdAt: new Date().toISOString(),
  };
  state.ledgers.push(ledger);
  selectedLedgerId = ledger.id;
  state.activeLedgerId = ledger.id;
  saveState();
  els.ledgerNameInput.value = "";
  els.ledgerDialog.hidden = true;
  render();
  showToast("账本已创建");
}

function deleteCurrentLedger() {
  if (selectedLedger()?.type === "income") {
    showToast("收入账本不能删除");
    return;
  }
  if (expenseLedgers().length <= 1) {
    showToast("至少保留一个账本");
    return;
  }
  const ledger = state.ledgers.find((item) => item.id === selectedLedgerId);
  if (!ledger) return;
  const ok = confirm(`删除“${ledger.name}”？这个账本下的记录也会删除。`);
  if (!ok) return;
  state.ledgers = state.ledgers.filter((item) => item.id !== selectedLedgerId);
  state.entries = state.entries.filter((entry) => entry.ledgerId !== selectedLedgerId);
  selectedLedgerId = expenseLedgers()[0].id;
  state.activeLedgerId = selectedLedgerId;
  saveState();
  render();
  showToast("账本已删除");
}

function deleteEntry(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  saveState();
  render();
  showToast("已删除");
}

function exportCsv() {
  const headers = ["账本", "类型", "分类", "金额", "日期", "备注", "创建时间"];
  const rows = state.entries.map((entry) => {
    const ledger = state.ledgers.find((item) => item.id === entry.ledgerId);
    return [
      ledger?.name || "",
      entry.type === "expense" ? "支出" : "收入",
      entry.category,
      entry.amount,
      entry.date,
      entry.note || "",
      entry.createdAt,
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile(`小账本-${toDateInputValue(new Date())}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function exportJson() {
  downloadFile(`小账本备份-${toDateInputValue(new Date())}.json`, JSON.stringify(state, null, 2), "application/json");
}

function importJson(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(String(reader.result || ""));
      if (!Array.isArray(imported.ledgers) || !Array.isArray(imported.entries)) {
        throw new Error("Invalid backup");
      }
      state = normalizeState(imported);
      selectedLedgerId = state.activeLedgerId || state.ledgers[0]?.id;
      state.activeLedgerId = selectedLedgerId;
      saveState();
      render();
      showToast("已导入备份");
    } catch {
      showToast("导入失败，请选择小账本 JSON 备份");
    }
  });
  reader.readAsText(file);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.hidden = false;
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2200);
}

setDefaultDates();

function setDefaultDates() {
  const now = new Date();
  els.monthFilter.value = toMonthInputValue(now);
  els.dateInput.value = toDateInputValue(now);
}

els.ledgerSelect.addEventListener("change", (event) => {
  selectedLedgerId = event.target.value;
  currentType = selectedLedger()?.type === "income" ? "income" : "expense";
  state.activeLedgerId = selectedLedgerId;
  saveState();
  render();
});

els.entryLedgerSelect.addEventListener("change", (event) => {
  selectedLedgerId = event.target.value;
  state.activeLedgerId = selectedLedgerId;
  saveState();
  render();
});

els.monthFilter.addEventListener("change", render);
els.entryForm.addEventListener("submit", addEntry);
els.expenseTypeButton.addEventListener("click", () => setType("expense"));
els.incomeTypeButton.addEventListener("click", () => setType("income"));

els.categoryGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  renderCategories();
});

els.recordList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  deleteEntry(button.dataset.delete);
});

els.newLedgerButton.addEventListener("click", () => {
  els.ledgerDialog.hidden = false;
  els.ledgerNameInput.focus();
});

els.deleteLedgerButton.addEventListener("click", deleteCurrentLedger);

els.cancelLedgerButton.addEventListener("click", () => {
  els.ledgerDialog.hidden = true;
});

els.ledgerDialog.addEventListener("click", (event) => {
  if (event.target === els.ledgerDialog) {
    els.ledgerDialog.hidden = true;
  }
});

els.ledgerForm.addEventListener("submit", createLedger);
els.exportCsvButton.addEventListener("click", exportCsv);
els.exportJsonButton.addEventListener("click", exportJson);
els.importButton.addEventListener("click", () => els.importInput.click());
els.importInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importJson(file);
  event.target.value = "";
});

window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const nextWidth = window.innerWidth;
    if (Math.abs(nextWidth - lastRenderWidth) < 4) return;
    lastRenderWidth = nextWidth;
    render();
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

render();
