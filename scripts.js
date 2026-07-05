// ── STATE ──
let allTransactions = [];
let pendingRows = [];

const CATS = {
    food: { label: 'Food', icon: '🍜' },
    grocery: { label: 'Grocery', icon: '🧺' },
    travel: { label: 'Travel', icon: '✈️' },
    bills: { label: 'Bills', icon: '📋' },
    purchases: { label: 'Purchases', icon: '🛍️' },
    misc: { label: 'Misc', icon: '📦' },
    self: { label: 'Self', icon: '👤' },
};

// ── FILE PICK ──
document.getElementById('loaderFile').addEventListener('change', function () {
    const f = this.files[0]; if (!f) return;
    document.getElementById('fileChosenName').textContent = f.name;
    document.getElementById('fileChosen').classList.add('show');
    document.getElementById('loaderBtn').disabled = false;
});

const loaderZone = document.getElementById('loaderZone');
loaderZone.addEventListener('dragover', e => { e.preventDefault(); loaderZone.classList.add('drag'); });
loaderZone.addEventListener('dragleave', () => loaderZone.classList.remove('drag'));
loaderZone.addEventListener('drop', e => {
    e.preventDefault(); loaderZone.classList.remove('drag');
    const f = e.dataTransfer.files[0]; if (!f) return;
    document.getElementById('fileChosenName').textContent = f.name;
    document.getElementById('fileChosen').classList.add('show');
    document.getElementById('loaderBtn').disabled = false;
    const dt = new DataTransfer(); dt.items.add(f);
    document.getElementById('loaderFile').files = dt.files;
});

function handleLoaderFile() {
    const f = document.getElementById('loaderFile').files[0]; if (!f) return;
    f.name.toLowerCase().endsWith('.json') ? loadJSON(f) : parseCSV(f, rows => { pendingRows = rows; showCategorise(rows); });
}

// ── CSV PARSER ──
function parseCSVText(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const result = [];
    for (const line of lines) {
        if (!line.trim()) continue;
        const fields = []; let cur = '', inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { if (inQuote && line[i + 1] === '"') { cur += '"'; i++; } else inQuote = !inQuote; }
            else if (ch === ',' && !inQuote) { fields.push(cur.trim()); cur = ''; }
            else cur += ch;
        }
        fields.push(cur.trim()); result.push(fields);
    }
    return result;
}

function parseCSV(file, cb) {
    const reader = new FileReader();
    reader.onload = e => {
        const rows2d = parseCSVText(e.target.result);
        if (rows2d.length < 2) { alert('CSV appears empty or has no data rows.'); return; }
        const header = rows2d[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
        const idx = name => {
            const aliases = {
                date: ['date', 'dt'], party: ['party', 'payee', 'description', 'narration'],
                withdraw: ['withdraw', 'withdrawal', 'debit'], deposit: ['deposit', 'credit'], balance: ['balance', 'bal']
            };
            for (const a of (aliases[name] || [name])) { const i = header.indexOf(a); if (i !== -1) return i; }
            return -1;
        };
        const iDate = idx('date'), iParty = idx('party'), iWith = idx('withdraw'), iDep = idx('deposit'), iBal = idx('balance');
        const rows = [];
        for (let r = 1; r < rows2d.length; r++) {
            const cols = rows2d[r];
            const party = iParty !== -1 ? cols[iParty] || '' : '';
            const withdraw = iWith !== -1 ? parseNum(cols[iWith]) : 0;
            const deposit = iDep !== -1 ? parseNum(cols[iDep]) : 0;
            const balance = iBal !== -1 ? parseNum(cols[iBal]) : 0;
            if (!party && !withdraw && !deposit) continue;
            rows.push({
                id: Date.now() + '_' + r,
                date: iDate !== -1 ? cols[iDate] || '' : '',
                party, withdraw, deposit, balance,
                // auto-assign income if deposit row, else leave blank for user
                category: deposit > 0 && withdraw === 0 ? 'income' : '',
            });
        }
        if (rows.length === 0) { alert('No valid rows found. Check headers: date, party, withdraw, deposit, balance'); return; }
        cb(rows);
    };
    reader.readAsText(file);
}

function parseNum(v) {
    if (v === '' || v == null) return 0;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
}

// ── CATEGORISE ──
function showCategorise(rows, recat = false) {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('categorise').style.display = 'block';
    const withdrawCount = rows.filter(r => r.category !== 'income').length;
    document.getElementById('catSub').textContent =
        `${rows.length} transactions — ${rows.length - withdrawCount} detected as Income. ${withdrawCount} detected as Expenses.— Please categorise your expenses.`;
    document.getElementById('catTotal').textContent = rows.length;

    if (!recat) {
        document.getElementById('btnBack').style.display = 'none';
    }

    if (recat) { pendingRows = rows }

    const tbody = document.getElementById('catBody');
    tbody.innerHTML = '';
    rows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        const isIncome = row.category === 'income';
        tr.innerHTML = `
      <td style="white-space:nowrap;color:var(--muted);font-size:12px">${esc(row.date)}</td>
      <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(row.party)}</td>
      <td class="amount-neg">${row.withdraw ? fmt(row.withdraw) : '—'}</td>
      <td class="amount-pos">${row.deposit ? fmt(row.deposit) : '—'}</td>
      <td style="color:var(--muted)">${fmt(row.balance)}</td>
      <td>${isIncome
                ? `<span class="income-tag">💰 Income</span>`
                : `<select class="cat-select ${recat && row.category ? row.category : ''}" data-idx="${idx}" onchange="onCatChange(this)">
            <option value="">— pick —</option>
            <option value="food" ${recat && row.category === 'food' ? 'selected' : ''}>🍜 Food</option>
            <option value="grocery" ${recat && row.category === 'grocery' ? 'selected' : ''}>🧺 Grocery</option>
            <option value="travel" ${recat && row.category === 'travel' ? 'selected' : ''}>✈️ Travel</option>
            <option value="bills" ${recat && row.category === 'bills' ? 'selected' : ''}>📋 Bills</option>
            <option value="purchases" ${recat && row.category === 'purchases' ? 'selected' : ''}>🛍️ Purchases</option>
            <option value="misc" ${recat && row.category === 'misc' ? 'selected' : ''}>📦 Misc</option>
            <option value="self" ${recat && row.category === 'self' ? 'selected' : ''}>👤 Self</option>
           </select>`
            }</td>`;
        tbody.appendChild(tr);
    });
    updateProgress();
}

function onCatChange(sel) {
    pendingRows[parseInt(sel.dataset.idx)].category = sel.value;
    sel.className = 'cat-select ' + sel.value;
    updateProgress();
}

function updateProgress() {
    // income rows are already counted as categorised
    document.getElementById('catDone').textContent = pendingRows.filter(r => r.category).length;
}

function setAll(cat) {
    pendingRows.forEach((r, i) => {
        if (r.category === 'income') return; // never override income
        r.category = cat;
        const sel = document.querySelector(`.cat-select[data-idx="${i}"]`);
        if (sel) { sel.value = cat; sel.className = 'cat-select ' + cat; }
    });
    updateProgress();
}

function finishCategorise() {
    const un = pendingRows.filter(r => !r.category).length;
    if (un > 0) {
        if (!confirm(`${un} transactions are uncategorised. They'll be marked as Misc. Continue?`)) return;
        pendingRows.forEach(r => { if (!r.category) r.category = 'misc'; });
    }
    const existingIds = new Set(allTransactions.map(r => r.id));
    const newRows = pendingRows.filter(r => !existingIds.has(r.id));
    allTransactions = [...allTransactions, ...newRows];
    pendingRows = [];
    showDashboard();
    toast(`✅ ${newRows.length} transactions added`);
}

// ── DASHBOARD ──
function showDashboard() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('categorise').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    closeDrill();

    const txns = allTransactions;
    const sorted = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date));
    const first = sorted[0], last = sorted[sorted.length - 1];
    const openBal = first ? first.balance - first.deposit + first.withdraw : 0;
    const closeBal = last ? last.balance : 0;
    //self is neither income nor expense
    const moneyIn = txns.filter(r => r.category !== 'self').reduce((s, r) => s + r.deposit, 0);
    const moneyOut = txns.filter(r => r.category !== 'self').reduce((s, r) => s + r.withdraw, 0);

    document.getElementById('openBal').textContent = fmt(openBal);
    document.getElementById('closeBal').textContent = fmt(closeBal);
    document.getElementById('moneyIn').textContent = fmt(moneyIn);
    document.getElementById('moneyOut').textContent = fmt(moneyOut);
    document.getElementById('dashSub').textContent = `${txns.length} transactions across all statements`;

    const grid = document.getElementById('catGrid');
    grid.innerHTML = '';
    const cards = {};
    for (const [key, meta] of Object.entries(CATS)) {
        const rows = txns.filter(r => r.category === key);
        // income = sum of deposits; everything else = sum of withdrawals
        const total = key === 'income'
            ? rows.reduce((s, r) => s + r.deposit, 0)
            : rows.reduce((s, r) => s + r.withdraw, 0);
        cards[key] = { icon: meta.icon, label: meta.label, total: total, transactions: rows.length }
    }

    const sortedCards = Object.entries(cards).sort((a, b) => b[1].total - a[1].total);
    let self_card;
    sortedCards.forEach(r => {
        if (r[0] === 'self') {
            self_card = r;
            return;
        }
        const card = document.createElement('div');
        card.className = `cat-card ${r[0]}`;
        card.innerHTML = `
        <div class="cat-card-icon">${r[1].icon}</div>
        <div class="cat-card-name">${r[1].label}</div>
        <div class="cat-card-amount">${fmt(r[1].total)}</div>
        <div class="cat-card-count">${r[1].transactions} transaction${r[1].transactions !== 1 ? 's' : ''}</div>`;
        card.onclick = () => openDrill(r[0]);
        grid.appendChild(card);
    });

    if (!(self_card.length === 0)) {
        const card = document.createElement('div');
        card.className = `cat-card ${self_card[0]}`;
        card.innerHTML = `
        <div class="cat-card-icon">${self_card[1].icon}</div>
        <div class="cat-card-name">${self_card[1].label}</div>
        <div class="cat-card-amount">${fmt(self_card[1].total)}</div>
        <div class="cat-card-count">${self_card[1].transactions} transaction${self_card[1].transactions !== 1 ? 's' : ''}</div>`;
        card.onclick = () => openDrill(self_card[0]);
        grid.appendChild(card);
    }
}

function openDrill(cat) {
    const titleEl = document.getElementById('drillTitle');
    if (document.getElementById('drilldown').style.display === 'block' && titleEl.dataset.cat === cat) {
        closeDrill(); return;
    }
    document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('active'));
    document.querySelectorAll(`.cat-card.${cat}`).forEach(c => c.classList.add('active'));

    const meta = CATS[cat];
    const rows = allTransactions.filter(r => r.category === cat);
    const isIncome = cat === 'income';
    const amtOf = r => isIncome ? r.deposit : r.withdraw;
    const total = rows.reduce((s, r) => s + amtOf(r), 0);

    titleEl.textContent = `${meta.icon} ${meta.label}`;
    titleEl.dataset.cat = cat;
    document.getElementById('drillBadge').textContent = `${rows.length} transactions · ${fmt(total)}`;
    document.getElementById('drillMonthAmtHead').textContent = isIncome ? 'Income' : 'Spent';

    // ── build month buckets ──
    const [sortedKeys, buckets] = showMonthlyBuckets(rows, isIncome);

    // ── bar chart ──
    drawDrillChart(sortedKeys, buckets, monthLabel, cat, isIncome);

    // ── transactions table ──
    createTransactionTable(rows, isIncome);
    document.getElementById('drilldown').style.display = 'block';
    document.getElementById('drilldown').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    hideTransaction();
}

function showMonthlyBuckets(rows, isIncome, needChart = false) {
    const amtOf = r => isIncome ? r.deposit : r.withdraw;
    const total = rows.reduce((s, r) => s + amtOf(r), 0);

    const buckets = {};
    rows.forEach(r => {
        const k = monthKey(r.date);
        if (!buckets[k]) buckets[k] = { count: 0, amount: 0 };
        buckets[k].count++;
        buckets[k].amount += amtOf(r);
    });
    const sortedKeys = Object.keys(buckets).sort();
    document.getElementById('drillBadge2').textContent = `${sortedKeys.length} month Average · ${fmt(total / sortedKeys.length)}`;

    // ── monthly summary table ──
    const mTbody = document.getElementById('drillMonthBody');
    mTbody.innerHTML = '';
    sortedKeys.forEach(k => {
        const b = buckets[k];
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td style="font-weight:500">${monthLabel(k)}</td>
      <td style="color:var(--muted)">${b.count}</td>
      <td class="${isIncome ? 'amount-pos' : 'amount-neg'}">${fmt(b.amount)}</td>`;
        tr.addEventListener('click', () => { showMonthlyTransactions(rows, k, isIncome, needChart); });
        mTbody.appendChild(tr);
    });

    return [sortedKeys, buckets]

}

function createTransactionTable(rows, isIncome) {
    const amtOf = r => isIncome ? r.deposit : r.withdraw;
    const tbody = document.getElementById('drillBody');
    tbody.innerHTML = '';
    rows.forEach(r => {
        const amount = amtOf(r);
        const isLarge = amount > 999;
        const tr = document.createElement('tr');
        if (isLarge) {
            tr.style.background = 'linear-gradient(to right, #993300, #0f1117)';
            tr.style.borderLeft = '3px solid #fbbf24';
        }
        tr.innerHTML = `
           <td style="white-space:nowrap;color:var(--muted);font-size:12px">${esc(r.date)}</td>
          <td>${esc(r.party)}</td>
          <td class="cat-select.${r.category}" title="${CATS[r.category]?.label ?? 'Income'}">${esc(CATS[r.category]?.icon ?? '💰')}</td>
          <td class="amount-neg">${r.withdraw ? fmt(r.withdraw) : '—'}</td>
          <td class="amount-pos">${r.deposit ? fmt(r.deposit) : '—'}</td>
          <td style="color:var(--muted)">${fmt(r.balance)}</td>`;
        tbody.appendChild(tr);
    });
}

function drawDrillChart(keys, buckets, labelFn, cat, isIncome) {
    const svg = document.getElementById('drillChart');
    svg.innerHTML = '';

    if (keys.length === 0) return;

    const CAT_COLORS = {
        income: '#34d399', food: '#fb923c', grocery: '#a6c907', travel: '#60a5fa',
        bills: '#f87171', purchases: '#fbbf24', misc: '#a78bfa',
        self: '#747475'
    };
    const barColor = CAT_COLORS[cat] || '#6c63ff';

    const W = svg.getBoundingClientRect().width || 1018;
    const H = 160;
    const padL = 56, padR = 12, padT = 10, padB = 36;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const amounts = keys.map(k => buckets[k].amount);
    const maxVal = Math.max(...amounts) || 1;

    const nBars = keys.length;
    const gap = Math.max(4, Math.min(12, chartW / nBars * 0.2));
    const barW = (chartW - gap * (nBars - 1)) / nBars;

    // y-axis ticks
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
        const y = padT + chartH - (i / tickCount) * chartH;
        const val = (i / tickCount) * maxVal;
        // gridline
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', padL); line.setAttribute('x2', padL + chartW);
        line.setAttribute('y1', y); line.setAttribute('y2', y);
        line.setAttribute('stroke', '#2e3248'); line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
        // label
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', padL - 6); txt.setAttribute('y', y + 4);
        txt.setAttribute('text-anchor', 'end'); txt.setAttribute('font-size', '9');
        txt.setAttribute('fill', '#8b8fa8');
        txt.textContent = val >= 1000 ? (val / 1000).toFixed(0) + 'k' : Math.round(val);
        if (val >= 100000) { txt.textContent = (val / 100000).toFixed(0) + 'Lacs'; }
        svg.appendChild(txt);
    }
    // bars + labels
    keys.forEach((k, i) => {
        const amount = buckets[k].amount;
        const x = padL + i * (barW + gap);
        const bh = Math.max(2, (amount / maxVal) * chartH);
        const y = padT + chartH - bh;

        // bar
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x); rect.setAttribute('y', y);
        rect.setAttribute('width', barW); rect.setAttribute('height', bh);
        rect.setAttribute('rx', 3); rect.setAttribute('fill', barColor);
        rect.setAttribute('opacity', '0.85');
        svg.appendChild(rect);

        // x-axis label (short: "Jan", "Feb" etc or if few bars show year too)
        const label = labelFn(k);
        const shortLabel = nBars <= 6 ? label : label.split(' ')[0];
        const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lbl.setAttribute('x', x + barW / 2); lbl.setAttribute('y', padT + chartH + 18);
        lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('font-size', '9');
        lbl.setAttribute('fill', '#8b8fa8');
        lbl.textContent = shortLabel;
        svg.appendChild(lbl);

        // value on top of bar (only if bar is wide enough)
        if (barW > 28) {
            const valTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            valTxt.setAttribute('x', x + barW / 2); valTxt.setAttribute('y', y - 4);
            valTxt.setAttribute('text-anchor', 'middle'); valTxt.setAttribute('font-size', '9');
            valTxt.setAttribute('fill', barColor); valTxt.setAttribute('font-weight', '600');
            valTxt.textContent = amount >= 1000 ? (amount / 1000).toFixed(1) + 'k' : Math.round(amount);
            if (amount >= 100000) { valTxt.textContent = (amount / 100000).toFixed(1) + 'Lacs'; }
            svg.appendChild(valTxt);
        }
    });

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', H);
}

function closeDrill() {
    document.getElementById('drilldown').style.display = 'none';
    document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('active'));
    document.getElementById('statMoneyIn').classList.remove('active');
    document.getElementById('statMoneyOut').classList.remove('active');
}

function toggleTransaction(frombtn = false) {

    const btnStat = document.getElementById('toggleTransactionBtn').textContent;
    const showAll = 'Show All Transactions';
    const hideAll = 'Hide All Transactions';

    if (hideAll === btnStat) { // hide the transactions
        document.getElementById('toggleTransactionBtn').textContent = showAll;
        document.getElementById('allTransactionTable').style.display = 'none';
    } else if (showAll === btnStat) { //show the transactions
        document.getElementById('toggleTransactionBtn').textContent = hideAll;

        if(frombtn){showAllTransactions();}
        document.getElementById('allTransactionTable').style.display = 'block';
        document.getElementById('allTransactionTable').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

}

//this will only be called if you push the show all button
function showAllTransactions() {
    const cat = document.getElementById('drillTitle').dataset.cat;
    let filteredrows;
    let isIncome;

    document.getElementById('allTransactionTable').querySelector('.drill-section-label').textContent = "All Transactions";

    if (cat === "stat_in" || cat === "income")
        isIncome = true;
    else
        isIncome = false;

    if (cat === "stat_in" || cat === "stat_out") {

        filteredrows = allTransactions.filter(r => r.category !== 'self' && (isIncome ? r.deposit > 0 : r.withdraw > 0));
    }
    else {
        filteredrows = allTransactions.filter(r => r.category === cat);
    }

    if (cat === "stat_out")
    {
        document.getElementById('expensesChartDiv').style.display = 'none';
    }

    createTransactionTable(filteredrows, isIncome);
}

function hideTransaction() {

    const btnStat = document.getElementById('toggleTransactionBtn').textContent;
    const showAll = 'Show All Transactions';
    const hideAll = 'Hide All Transactions';

    if (hideAll === btnStat) {
        document.getElementById('toggleTransactionBtn').textContent = showAll;
        document.getElementById('allTransactionTable').style.display = 'none';
    }

}

function showMonthlyTransactions(rows, k, isIncome, needChart) {
    const dt = k.slice(5, 7) + '-' + k.slice(0, 4);
    const filteredrows = rows.filter(r => r.date.slice(3) === dt);
    document.getElementById('allTransactionTable').querySelector('.drill-section-label').textContent = "Transactions for : " + monthLabel(k);

    if (needChart) {
        document.getElementById('expensesChartDiv').style.display = "block";
        drawExpensesChart(filteredrows, isIncome)
    }
    else { document.getElementById('expensesChartDiv').style.display = 'none' }
    hideTransaction();
    createTransactionTable(filteredrows, isIncome);
    toggleTransaction();
    if (needChart) {
        document.getElementById('expensesChartDiv').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    toast("Transactions for : " + monthLabel(k));

}

function drawExpensesChart(rows, isIncome) {

    const amtOf = r => isIncome ? r.deposit : r.withdraw;
    const buckets = {};
    rows.forEach(r => {
        const k = r.category;
        if (!buckets[k]) buckets[k] = { count: 0, amount: 0 };
        buckets[k].count++;
        buckets[k].amount += amtOf(r);
    });

    const sortedBuckets = Object.entries(buckets).sort((a, b) => b[1].amount - a[1].amount);
    // keys = sortedbuckets

    const svg = document.getElementById('expensesChart');
    svg.innerHTML = '';

    if (sortedBuckets.length === 0) return;

    const CAT_COLORS = {
        income: '#34d399', food: '#fb923c', grocery: '#a6c907', travel: '#60a5fa',
        bills: '#f87171', purchases: '#fbbf24', misc: '#a78bfa',
        self: '#747475'
    };
    //const barColor = CAT_COLORS[cat] || '#6c63ff';

    const W = svg.getBoundingClientRect().width || 1018;
    const H = 360;
    const padL = 90, padR = 56, padT = 10, padB = 30;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const amounts = sortedBuckets.map(k => k[1].amount);
    const maxVal = Math.max(...amounts) || 1;

    const nBars = sortedBuckets.length;
    const gap = Math.max(4, Math.min(14, chartH / nBars * 0.25));
    const barH = (chartH - gap * (nBars - 1)) / nBars;

    // X-axis ticks
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
        const x = padL + (i / tickCount) * chartW;
        const val = (i / tickCount) * maxVal;
        // gridline
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x); line.setAttribute('x2', x);
        line.setAttribute('y1', padT); line.setAttribute('y2', padT + chartH);
        line.setAttribute('stroke', '#2e3248'); line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
        // label
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', x); txt.setAttribute('y', padT + chartH + 18);
        txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('font-size', '9');
        txt.setAttribute('fill', '#8b8fa8');
        txt.textContent = val >= 1000 ? (val / 1000).toFixed(0) + 'k' : Math.round(val);
        if (val >= 100000) { txt.textContent = (val / 100000).toFixed(0) + 'Lacs'; }
        svg.appendChild(txt);
    }
    // bars + labels
    sortedBuckets.forEach((k, i) => {
        const amount = k[1].amount;
        const y = padT + i * (barH + gap);
        const bw = Math.max(2, (amount / maxVal) * chartW);
        const x = padL;
        const barColor = CAT_COLORS[k[0]];
        // bar
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x); rect.setAttribute('y', y);
        rect.setAttribute('width', bw); rect.setAttribute('height', barH);
        rect.setAttribute('rx', 3); rect.setAttribute('fill', barColor);
        rect.setAttribute('opacity', '0.85');
        svg.appendChild(rect);

        // y-axis label 
        const label = CATS[k[0]].icon + " " + CATS[k[0]].label;
        const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lbl.setAttribute('x', padL - 8); lbl.setAttribute('y', y + barH / 2 + 3);
        lbl.setAttribute('text-anchor', 'end'); lbl.setAttribute('font-size', '9');
        lbl.setAttribute('fill', '#8b8fa8');
        lbl.textContent = label;
        svg.appendChild(lbl);

        // value on top of bar (only if bar is wide enough)
        if (barH > 10) {
            const valTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            valTxt.setAttribute('x', x + bw + 4); valTxt.setAttribute('y', y + barH / 2 + 3);
            valTxt.setAttribute('text-anchor', 'start'); valTxt.setAttribute('font-size', '9');
            valTxt.setAttribute('fill', barColor); valTxt.setAttribute('font-weight', '600');
            valTxt.textContent = amount >= 1000 ? (amount / 1000).toFixed(1) + 'k' : Math.round(amount);
            if (amount >= 100000) { valTxt.textContent = (amount / 100000).toFixed(1) + 'Lacs'; }
            svg.appendChild(valTxt);
        }
    });

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', H);






}

// ── STAT CARD DRILL (Money In / Money Out) ──
function openStatDrill(direction) {
    const isIn = direction === 'in';
    const amtOf = r => isIn ? r.deposit : r.withdraw;

    // toggle
    const activeCard = document.getElementById(isIn ? 'statMoneyIn' : 'statMoneyOut');
    const otherCard = document.getElementById(isIn ? 'statMoneyOut' : 'statMoneyIn');
    const titleEl = document.getElementById('drillTitle');

    if (document.getElementById('drilldown').style.display === 'block' && titleEl.dataset.cat === 'stat_' + direction) {
        closeDrill(); return;
    }

    // deactivate cat cards, activate the right stat card
    document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('active'));
    activeCard.classList.add('active');
    otherCard.classList.remove('active');

    const rows = allTransactions.filter(r => r.category !== 'self' && (isIn ? r.deposit > 0 : r.withdraw > 0));
    const total = rows.reduce((s, r) => s + amtOf(r), 0);

    titleEl.textContent = isIn ? '💰 Money In' : '💸 Money Out';
    titleEl.dataset.cat = 'stat_' + direction;
    document.getElementById('drillBadge').textContent = `${rows.length} transactions · ${fmt(total)}`;
    document.getElementById('drillMonthAmtHead').textContent = isIn ? 'Received' : 'Spent';

    // month buckets
    const [sortedKeys, buckets] = showMonthlyBuckets(rows, isIn, (!isIn));

    // chart — use income green for money-in, red for money-out
    drawDrillChart(sortedKeys, buckets, monthLabel, isIn ? 'income' : 'bills', isIn);

    // transactions
    createTransactionTable(rows, isIn);
    document.getElementById('drilldown').style.display = 'block';
    document.getElementById('drilldown').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    hideTransaction();
}

// ── SHARED MONTH HELPERS (outside openDrill so openStatDrill can use them) ──
function monthKey(dateStr) {
    if (!dateStr) return 'Unknown';
    const parts = dateStr.split(/[-\/\s]/);
    if (parts.length >= 3) {
        const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const m = months[parts[1].toLowerCase().slice(0, 3)];
        if (m !== undefined) return parts[2] + '-' + String(m + 1).padStart(2, '0');
        if (parts[1].length <= 2) return parts[2] + '-' + String(parseInt(parts[1])).padStart(2, '0');
    }
    return 'Unknown';
}
function monthLabel(key) {
    if (key === 'Unknown') return 'Unknown';
    const [y, m] = key.split('-');
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}


function handleAddMore(input) {
    const f = input.files[0]; if (!f) return;
    parseCSV(f, rows => { pendingRows = rows; showCategorise(rows); });
    input.value = '';
}

function reCategorise() {
    showCategorise(allTransactions, true);
}

// ── SAVE / LOAD ──
function saveAnalysis() {
    const blob = new Blob([JSON.stringify({ version: 1, transactions: allTransactions }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'budget-analysis.json'; a.click();
    URL.revokeObjectURL(a.href);
    toast('💾 Analysis saved to Downloads');
}

function loadJSON(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            allTransactions = data.transactions || [];
            showDashboard();
            toast(`📂 Loaded ${allTransactions.length} transactions`);
        } catch { alert("Couldn't read the file. Make sure it's a Budget Tracker .json file."); }
    };
    reader.readAsText(file);
}

// ── HELPERS ──
function fmt(n) {
    if (!n) return '0';
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}
function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}