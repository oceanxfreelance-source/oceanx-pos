/* Theyo Fihaara — clickable demo. SAMPLE DATA only. Nothing is sent anywhere. */
const TODAY = '2026-10-28';
const PET = '#0e7490', DIE = '#b45309';
const FUELC = { petrol: PET, diesel: DIE };
const STORE = 'theyo-demo-v1';

// ---------- helpers
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r2 = (n) => Math.round(n * 100) / 100;
const fmtN = (n, d = 2) => (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (n, d = 2) => `<bdi>${fmtN(n, d)}</bdi>`;
const L = (n, d = 0) => `<bdi>${fmtN(n, d)}</bdi> ${t('L')}`;
const money = (n) => `${t('MVR')} <bdi>${fmtN(n)}</bdi>`;
const ic = (n, s = 15, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;
const pill = (c, txt) => `<span class="pill p-${c}">${txt}</span>`;
const nowTime = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const dayDiff = (a, b = TODAY) => Math.round((new Date(b) - new Date(a)) / 864e5);
const addDays = (a, n) => { const d = new Date(a); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dShort = (iso) => { const d = new Date(iso); return `<bdi>${d.getDate()}</bdi> ${t(MONTHS[d.getMonth()])}`; };
function cnt(n, one, many) { return tf(n === 1 ? one : many, { n }); }
function t(s) { return S.lang === 'dv' && DV[s] ? DV[s] : s; }
function tf(s, o) { let r = t(s); for (const k in o) r = r.split('{' + k + '}').join(o[k]); return r; }

// ---------- sample data
function seed() {
  const s = {
    lang: 'en', role: 'owner', route: 'overview', staff: 'Ahmed',
    set: { mode: 'shifts', nozzles: 4, stock: 'tanks', delivery: { on: true, type: 'fixed', amount: 150 }, printer: 'off', receipt: 'none', tillLimit: 500, quotes: true, credit: true, cashTol: 100, varTol: 1 },
    prices: { petrol: 17.21, diesel: 17.54 }, priceLog: [{ date: '2026-10-01', petrol: 17.21, diesel: 17.54, note: 'October prices' }],
    cost: { petrol: 15.78, diesel: 15.72 },
    pumps: [{ id: 'P1', fuel: 'petrol', tank: 'T1', meter: 482604.9 }, { id: 'P2', fuel: 'petrol', tank: 'T1', meter: 392158.2 }, { id: 'P3', fuel: 'diesel', tank: 'T2', meter: 655931.3 }, { id: 'P4', fuel: 'diesel', tank: 'T2', meter: 209131.6 }],
    tanks: [{ id: 'T1', fuel: 'petrol', cap: 20000, reorder: 5000, level: 6884, dia: 240, dip: { time: '07:00', cm: 90.0, measured: 6850, book: 6884 } },
            { id: 'T2', fuel: 'diesel', cap: 25000, reorder: 5000, level: 3305, dia: 260, dip: { time: '07:00', cm: 47.4, measured: 3120, book: 3305 } }],
    drums: { full: 6, open: 100, size: 200, counted: '17:50' },
    customers: [
      { id: 'c1', name: 'Sample Island Council', type: 'government', phone: '300-0000', vehicle: 'Council pickup P-2231', limit: 40000, terms: 30, opening: 0, openingDate: TODAY, paid: 0, approved: true },
      { id: 'c2', name: 'Sample Health Centre', type: 'government', phone: '300-0001', vehicle: 'Ambulance boat', limit: 20000, terms: 30, opening: 0, openingDate: TODAY, paid: 0, approved: true },
      { id: 'c3', name: 'Sample Fisheries Co.', type: 'company', phone: '300-0002', vehicle: '3 fishing vessels', limit: 30000, terms: 15, opening: 12340, openingDate: '2026-10-05', paid: 0, approved: true },
      { id: 'c4', name: 'Sample Resort Supplies', type: 'company', phone: '300-0003', vehicle: 'Supply boat', limit: 50000, terms: 30, opening: 0, openingDate: TODAY, paid: 0, approved: true },
      { id: 'c5', name: 'FV Sample Raiymaa', type: 'person', phone: '700-0004', vehicle: 'Fishing vessel, 72 ft', limit: 60000, terms: 15, opening: 37520, openingDate: '2026-10-20', paid: 0, approved: true },
      { id: 'c6', name: 'Hussain · dhoni “Sample Dhonis”', type: 'person', phone: '700-0005', vehicle: 'Dhoni', limit: 5000, terms: 7, opening: 1290, openingDate: '2026-10-22', paid: 0, approved: true },
      { id: 'c7', name: 'Sample School', type: 'government', phone: '300-0006', vehicle: 'School van', limit: 15000, terms: 30, opening: 0, openingDate: TODAY, paid: 0, approved: true },
    ],
    quotes: [
      { id: 'Q-2026-011', cust: 'c1', fuel: 'petrol', litres: 800, price: 17.21, delMax: 0, valid: '2026-10-31', status: 'invoiced', po: 'PO 097', usedBefore: 800, date: '2026-09-20' },
      { id: 'Q-2026-014', cust: 'c1', fuel: 'diesel', litres: 2000, price: 17.54, delMax: 6, valid: '2026-11-30', status: 'approved', po: 'PO 118', usedBefore: 600, date: '2026-10-08' },
      { id: 'Q-2026-015', cust: 'c2', fuel: 'diesel', litres: 600, price: 17.54, delMax: 2, valid: '2026-11-15', status: 'sent', po: '', usedBefore: 0, date: '2026-10-25' },
      { id: 'Q-2026-016', cust: 'c7', fuel: 'petrol', litres: 300, price: 17.21, delMax: 0, valid: '2026-11-30', status: 'draft', po: '', usedBefore: 0, date: '2026-10-27' },
    ],
    invoices: [
      { id: 'INV-2026-027', cust: 'c2', quote: '', amount: 9820.5, paid: 0, date: '2026-09-30', due: '2026-10-30' },
      { id: 'INV-2026-029', cust: 'c4', quote: '', amount: 24780, paid: 0, date: '2026-10-07', due: '2026-11-06' },
      { id: 'INV-2026-031', cust: 'c1', quote: 'Q-2026-014', amount: 10524 + 4 * 150, paid: 0, date: '2026-10-14', due: '2026-11-13' },
    ],
    payments: [],
    sales: [],
    expenses: [
      { id: 'e1', date: '2026-10-28', desc: 'Unloading workers', cat: 'Petty cash', from: 'till', amount: 200, staff: 'Ibrahim', shift: 'S-1028-1' },
      { id: 'e2', date: '2026-10-28', desc: 'Cleaning items', cat: 'Petty cash', from: 'till', amount: 150, staff: 'Ibrahim', shift: 'S-1028-1' },
      { id: 'e3', date: '2026-10-27', desc: 'Pump P4 nozzle repair', cat: 'Maintenance', from: 'bank', amount: 2850, staff: 'Ahmed', shift: '' },
      { id: 'e4', date: '2026-10-25', desc: 'Electricity, September', cat: 'Utilities', from: 'bank', amount: 6420, staff: 'Ahmed', shift: '' },
      { id: 'e5', date: '2026-10-25', desc: 'Staff salaries, October', cat: 'Salaries', from: 'bank', amount: 38500, staff: 'Ahmed', shift: '' },
      { id: 'e6', date: '2026-10-20', desc: 'Land rent, October', cat: 'Rent & licences', from: 'bank', amount: 12000, staff: 'Ahmed', shift: '' },
    ],
    deliveries: [
      { id: 'd1', date: '2026-10-21', fuel: 'petrol', tank: 'T1', supplier: 'Sample Fuel Supplier', invoiced: 12000, received: 12000, price: 15.80 },
      { id: 'd2', date: '2026-10-17', fuel: 'diesel', tank: 'T2', supplier: 'Sample Fuel Supplier', invoiced: 15000, received: 14940, price: 15.72 },
      { id: 'd3', date: '2026-10-09', fuel: 'petrol', tank: 'T1', supplier: 'Sample Fuel Supplier', invoiced: 10000, received: 9985, price: 15.75 },
      { id: 'd4', date: '2026-10-04', fuel: 'diesel', tank: 'T2', supplier: 'Sample Fuel Supplier', invoiced: 15000, received: 15000, price: 15.72 },
    ],
    items: [
      { id: 'i1', name: '2T engine oil 1 L', price: 95, cost: 70, stock: 24 },
      { id: 'i2', name: 'Engine oil 15W-40 1 L', price: 120, cost: 88, stock: 18 },
      { id: 'i3', name: 'Coolant 1 L', price: 65, cost: 45, stock: 10 },
      { id: 'i4', name: 'Drinking water 1.5 L', price: 10, cost: 6, stock: 60 },
    ],
    shifts: [
      { id: 'S-1027-2', staff: 'Rahim', start: '27 Oct 14:00', end: '22:00', status: 'closed', total: 24210.35, diff: 12.5, note: '' },
      { id: 'S-1027-3', staff: 'Ahmed', start: '27 Oct 22:00', end: '06:00', status: 'closed', total: 8930.10, diff: 0, note: '' },
      { id: 'S-1028-1', staff: 'Ibrahim', start: '28 Oct 06:00', end: '14:00', status: 'closed', total: 21640.50, diff: -340.31, note: 'Change given wrong to a boat captain, will collect' },
      { id: 'S-1028-2', staff: 'Ahmed', start: '28 Oct 14:00', end: '', status: 'open', openMeters: {}, total: 0, diff: 0, note: '' },
    ],
    seq: { sale: 104860, q: 16, inv: 31, cust: 7, exp: 6, del: 4, pay: 0 },
    till: null, modal: null, form: {}, tab: {}, anim: {},
  };
  s.shifts[3].openMeters = Object.fromEntries(s.pumps.map((p) => [p.id, p.meter]));
  // sales in the open shift (SAMPLE)
  const rows = [
    ['14:06', 'P2', 25, 'walkin', 'cash'], ['14:15', 'P3', 300, 'c5', 'credit'], ['14:22', 'P1', 10, 'walkin', 'qr'], ['14:40', 'P4', 45, 'walkin', 'cash'],
    ['14:58', 'P2', 15, 'walkin', 'card'], ['15:10', 'P3', 120, 'c1', 'credit', 'Q-2026-014', 150], ['15:26', 'P1', 20, 'c6', 'credit'], ['15:44', 'P2', 30, 'walkin', 'cash'],
    ['16:02', 'P4', 60, 'walkin', 'cash'], ['16:18', 'P1', 8, 'walkin', 'cash'], ['16:31', 'P3', 80, 'walkin', 'card'], ['16:41', 'P2', 12, 'walkin', 'cash'],
  ];
  for (const [time, pump, litres, cust, pay, quote, del] of rows) {
    const p = s.pumps.find((x) => x.id === pump);
    const price = quote ? s.quotes.find((q) => q.id === quote).price : s.prices[p.fuel];
    const amount = r2(litres * price), delivery = del || 0;
    s.sales.push({ id: 'R-' + (++s.seq.sale), date: TODAY, time, pump, fuel: p.fuel, litres, price, amount, delivery, items: [], total: r2(amount + delivery), cust, pay, quote: quote || '', shift: 'S-1028-2', staff: 'Ahmed', invoice: '' });
    p.meter = r2(p.meter + litres);
    s.tanks.find((x) => x.id === p.tank).level -= litres;
  }
  return s;
}
let S;
try { S = JSON.parse(localStorage.getItem(STORE)) || seed(); } catch (e) { S = seed(); }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify({ ...S, modal: null, anim: {} })); } catch (e) {} };

// ---------- derived numbers
const cust = (id) => S.customers.find((c) => c.id === id);
const custName = (id) => (id === 'walkin' ? t('Walk-in') : `<bdi>${esc(cust(id)?.name || '')}</bdi>`);
const openShift = () => S.shifts.find((x) => x.status === 'open');
const pumpsActive = () => (S.set.nozzles === 1 ? S.pumps.slice(0, 1) : S.pumps);
function balance(c) {
  const sales = S.sales.filter((x) => x.cust === c.id && x.pay === 'credit' && !x.invoice).reduce((a, x) => a + x.total, 0);
  const inv = S.invoices.filter((i) => i.cust === c.id).reduce((a, i) => a + i.amount - i.paid, 0);
  return r2(c.opening + sales + inv - c.paid);
}
function oldestOwed(c) {
  const d = [];
  if (c.opening > c.paid) d.push(c.openingDate);
  S.invoices.filter((i) => i.cust === c.id && i.amount > i.paid).forEach((i) => d.push(i.date));
  S.sales.filter((x) => x.cust === c.id && x.pay === 'credit' && !x.invoice).forEach((x) => d.push(x.date));
  return d.sort()[0];
}
function lateDays(c) {
  const inv = S.invoices.filter((i) => i.cust === c.id && i.amount > i.paid).map((i) => dayDiff(i.due));
  const acc = c.opening > c.paid || S.sales.some((x) => x.cust === c.id && x.pay === 'credit' && !x.invoice) ? dayDiff(addDays(oldestOwed(c), c.terms)) : -999;
  return Math.max(acc, ...inv, -999);
}
const quoteUsed = (q) => q.usedBefore + S.sales.filter((x) => x.quote === q.id).reduce((a, x) => a + x.litres, 0);
const quoteDeliveries = (q) => S.sales.filter((x) => x.quote === q.id && x.delivery > 0).length + (q.id === 'Q-2026-014' ? 4 : 0);
function shiftNums(sh) {
  const sales = S.sales.filter((x) => x.shift === sh.id);
  const by = (p) => r2(sales.filter((x) => x.pay === p).reduce((a, x) => a + x.total, 0));
  const exp = r2(S.expenses.filter((e) => e.shift === sh.id && e.from === 'till').reduce((a, e) => a + e.amount, 0));
  return { sales, total: r2(sales.reduce((a, x) => a + x.total, 0)), cash: by('cash'), card: by('card'), qr: by('qr'), credit: by('credit'), exp, expected: r2(by('cash') - exp) };
}
const todaySales = () => S.sales.filter((x) => x.date === TODAY);

// ---------- navigation
function navFor() {
  const one = S.set.mode === 'one', r = S.role;
  const all = [
    ['Operations', [['overview', 'home', one ? 'Today' : 'Overview'], ['till', 'fuel', one ? 'Sell' : 'Point of sale'], !one && ['shifts', 'clock', 'Shifts'], ['tanks', 'drop', S.set.stock === 'drums' ? 'Drums & stock' : 'Tanks & dips'], ['deliveries', 'truck', 'Deliveries'], ['expenses', 'receipt', 'Expenses']]],
    ['Customers', [S.set.credit && ['credit', 'anchor', 'Credit accounts'], S.set.credit && ['unpaid', 'clock', 'Unpaid'], S.set.quotes && ['quotes', 'doc', 'Quotations & invoices'], ['prices', 'tag', 'Price lists']]],
    ['Shop', [['items', 'cart', 'Shop items']]],
    ['Insights', [['reports', 'chart', 'Reports']]],
  ];
  const allow = { owner: null, manager: null, attendant: ['till', 'shifts', 'expenses', 'overview'], accountant: ['overview', 'credit', 'unpaid', 'quotes', 'reports', 'expenses', 'deliveries'] }[r];
  return all.map(([g, its]) => [g, its.filter(Boolean).filter((x) => !allow || allow.includes(x[0]))]).filter((g) => g[1].length);
}
function counts() {
  const late = S.customers.filter((c) => balance(c) > 0 && lateDays(c) > 0).length;
  return { shifts: openShift() ? tf('{n} open', { n: 1 }) : '', credit: S.customers.length, unpaid: late || '', quotes: S.quotes.filter((q) => q.status === 'sent' || q.status === 'approved').length || '' };
}
function sidebar() {
  const c = counts();
  let h = `<div class="sb"><div class="lg"><img src="${S.lang === 'dv' ? LOGO_DARK : LOGO_DARK}" style="height:24px"><span class="pr">by OceanX</span></div>
  <div class="site"><div><b>${t(S.set.mode === 'one' ? 'Sample Island Fuel' : 'Sample Harbour Fuel')}</b><small>${S.set.stock === 'drums' ? t('1 nozzle · drums') : tf('{p} nozzles · {t} tanks', { p: pumpsActive().length, t: 2 })}</small></div></div>`;
  for (const [g, its] of navFor()) {
    h += `<div class="gl">${t(g)}</div>`;
    for (const [r, i, n] of its) h += `<a class="it${S.route === r || (r === 'shifts' && S.route === 'closeShift') ? ' on' : ''}" data-a="go" data-r="${r}">${ic(i)}${t(n)}${c[r] ? `<span class="c">${c[r]}</span>` : ''}</a>`;
  }
  if (S.role === 'owner' || S.role === 'manager') h += `<a class="it${S.route === 'settings' ? ' on' : ''}" style="margin-top:6px" data-a="go" data-r="settings">${ic('set')}${t('Settings')}</a>`;
  const who = { owner: ['AR', 'Ahmed Rasheed', 'Owner'], manager: ['MS', 'Mariyam Saeed', 'Manager'], attendant: ['AH', 'Ahmed', 'Attendant'], accountant: ['FA', 'Fathimath Ali', 'Accountant'] }[S.role];
  h += `<a class="ft" data-a="role" title="${t('Switch role to check what each person sees')}"><div class="av">${who[0]}</div><div><b>${t(who[1])}</b><small>${t(who[2])} · ${t('switch')}</small></div></a></div>`;
  return h;
}
function topbar(crumb) {
  return `<div class="tb"><span class="crumb">${t(S.set.mode === 'one' ? 'Sample Island Fuel' : 'Sample Harbour Fuel')}&nbsp;&nbsp;/&nbsp;&nbsp;<b>${crumb}</b></span>
  <span class="demo-tag">${t('DEMO · SAMPLE DATA · nothing is saved online')}</span>
  <a class="bt sm" data-a="lang">${S.lang === 'en' ? 'ދިވެހި' : 'English'}</a>
  <a class="ib" data-a="go" data-r="overview">${ic('bell', 15)}${alerts().length ? '<span class="dot"></span>' : ''}</a></div>`;
}

// ---------- alerts
function alerts() {
  const a = [];
  if (S.set.stock === 'tanks') S.tanks.forEach((tk) => { if (tk.level < tk.reorder) a.push(['r', tf('{f} stock low · {l}', { f: t(cap(tk.fuel)), l: L(tk.level) }), tf('Below reorder level of {r}', { r: L(tk.reorder) }), 'tanks']); });
  else if (S.drums.full < 2) a.push(['r', t('Few drums left'), tf('{n} full drums', { n: S.drums.full }), 'tanks']);
  S.tanks.forEach((tk) => { const v = tk.dip.measured - tk.dip.book; if (S.set.stock === 'tanks' && Math.abs(v) / tk.dip.book * 100 > S.set.varTol) a.push(['a', tf('Tank {id} variance {v}', { id: tk.id, v: L(v) }), tf('Dip vs book stock above {p}%', { p: S.set.varTol }), 'tanks']); });
  const late = S.customers.filter((c) => balance(c) > 0 && lateDays(c) > 0);
  if (late.length && S.set.credit) a.push(['r', tf('Customers late to pay: {n}', { n: late.length }), money(late.reduce((x, c) => x + balance(c), 0)), 'unpaid']);
  const nw = S.customers.filter((c) => !c.approved);
  if (nw.length) a.push(['b', tf('New customers added at the till: {n}', { n: nw.length }), t('Check and approve'), 'unpaid']);
  const q = S.quotes.filter((x) => x.status === 'sent');
  if (q.length && S.set.quotes) a.push(['b', tf('Quotations waiting for approval: {n}', { n: q.length }), q.map((x) => x.id).join(', '), 'quotes']);
  const sh = S.shifts.filter((x) => x.status === 'closed' && Math.abs(x.diff) > S.set.cashTol).slice(-1)[0];
  if (sh) a.push(['a', tf('Shift {id} closed {d}', { id: sh.id, d: money(sh.diff) }), esc(sh.note), 'shifts']);
  return a;
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---------- pages
const P = {};
P.overview = () => {
  const ts = todaySales(), tot = ts.reduce((a, x) => a + x.total, 0);
  const lp = ts.filter((x) => x.fuel === 'petrol').reduce((a, x) => a + x.litres, 0), ld = ts.filter((x) => x.fuel === 'diesel').reduce((a, x) => a + x.litres, 0);
  const cr = ts.filter((x) => x.pay === 'credit').reduce((a, x) => a + x.total, 0);
  const owed = S.customers.reduce((a, c) => a + Math.max(0, balance(c)), 0);
  const al = alerts();
  const tanks = S.set.stock === 'tanks' ? S.tanks.map((tk) => `<div style="padding:10px 14px"><div class="row" style="justify-content:space-between"><span><span class="sw" style="background:${FUELC[tk.fuel]}"></span>${tk.id} · ${t(cap(tk.fuel))}</span><span class="n">${L(tk.level)} / ${num(tk.cap, 0)}</span></div><div class="bar"><i style="width:${(tk.level / tk.cap * 100).toFixed(1)}%;background:${tk.level < tk.reorder ? '#b91c1c' : FUELC[tk.fuel]}"></i></div></div>`).join('')
    : `<div style="padding:12px 14px">${tf('{n} full drums + open drum {o}', { n: S.drums.full, o: L(S.drums.open) })}</div>`;
  return `<div class="ph"><div><h1>${t(S.set.mode === 'one' ? 'Today' : 'Overview')}</h1><div class="s">${t('Tuesday 28 October 2026')}${openShift() && S.set.mode !== 'one' ? ' · ' + tf('Shift {id} open ({s})', { id: openShift().id, s: t(openShift().staff) }) : ''}</div></div>
  <div class="row">${S.set.mode === 'one' ? `<a class="bt" data-a="go" data-r="closeShift">${t('Close the day')}</a>` : ''}<a class="bt pr" data-a="go" data-r="till">${t('New sale')}</a></div></div>
  <div class="card kpis n" style="grid-template-columns:repeat(4,1fr)">
  <div class="kpi"><div class="l">${t('Sales today')}</div><div class="v">${money(tot)}</div><div class="dl">${cnt(ts.length, '{n} sale', '{n} sales')}</div></div>
  <div class="kpi"><div class="l">${t('Litres today')}</div><div class="v">${L(lp + ld)}</div><div class="dl">${t('Petrol')} ${num(lp, 0)} · ${t('Diesel')} ${num(ld, 0)}</div></div>
  <div class="kpi"><div class="l">${t('On credit today')}</div><div class="v">${money(cr)}</div><div class="dl">${cnt(ts.filter((x) => x.pay === 'credit').length, '{n} sale', '{n} sales')}</div></div>
  <div class="kpi"><div class="l">${t('Owed to you')}</div><div class="v">${money(owed)}</div><div class="dl">${cnt(S.customers.filter((c) => balance(c) > 0).length, '{n} customer', '{n} customers')}</div></div></div>
  <div class="g2" style="margin-top:14px"><div class="card"><div class="ch"><h3>${t('Needs attention')}</h3><span class="s">${al.length}</span></div>${al.map(([c, a, b, r]) => `<a class="alert" data-a="go" data-r="${r}"><span class="b" style="background:${{ r: '#dc2626', a: '#d97706', b: '#2563eb' }[c]}"></span><div><b>${a}</b><small>${b}</small></div></a>`).join('') || `<div class="empty">${t('All good')}</div>`}</div>
  <div class="card"><div class="ch"><h3>${t(S.set.stock === 'tanks' ? 'Tank levels' : 'Drums')}</h3><a class="s lnk" data-a="go" data-r="tanks">${t('Open')}</a></div>${tanks}</div></div>
  <div class="card" style="margin-top:14px"><div class="ch"><h3>${t('Recent sales')}</h3><span class="s">${tf('{n} today', { n: ts.length })}</span></div>${salesTable(ts.slice(-8).reverse())}</div>`;
};
function salesTable(rows) {
  return `<table class="t n"><tr><th>${t('Receipt')}</th><th>${t('Time')}</th><th>${t('Nozzle')}</th><th class="r">${t('Litres')}</th><th>${t('Customer')}</th><th>${t('Payment')}</th><th class="r">${t('MVR')}</th></tr>
  ${rows.map((x) => `<tr><td>${x.id}</td><td class="m"><bdi>${x.time}</bdi></td><td>${x.pump} · ${t(cap(x.fuel))}</td><td class="r">${num(x.litres)}</td><td>${custName(x.cust)}${x.quote ? `<small>${x.quote}</small>` : ''}</td><td>${payPill(x.pay)}</td><td class="r">${num(x.total)}</td></tr>`).join('') || `<tr><td colspan="7" class="empty">${t('No sales yet')}</td></tr>`}</table>`;
}
const payPill = (p) => pill({ cash: 'g', card: 'n', qr: 'b', credit: 'a' }[p], t({ cash: 'Cash', card: 'Card', qr: 'QR', credit: 'Credit' }[p]));

// ----- till
function tillReset() { S.till = { pump: pumpsActive()[0].id === 'P1' && S.set.nozzles === 1 ? 'P1' : 'P2', mode: 'litres', input: '', cust: 'walkin', pay: 'cash', delivery: null, receipt: S.set.receipt, quote: '', items: [], ok: false }; }
function tillCalc() {
  const T = S.till, p = S.pumps.find((x) => x.id === T.pump);
  const q = T.quote ? S.quotes.find((x) => x.id === T.quote) : null;
  const price = q && q.fuel === p.fuel ? q.price : S.prices[p.fuel];
  const v = parseFloat(T.input) || 0;
  const litres = T.mode === 'litres' ? v : r2(v / price);
  const amount = T.mode === 'litres' ? r2(v * price) : v;
  const del = T.delivery == null ? 0 : T.delivery;
  const items = T.items.reduce((a, i) => a + i.price * i.qty, 0);
  return { p, q: q && q.fuel === p.fuel ? q : null, price, litres, amount, del, items, total: r2(amount + del + items) };
}
P.till = () => {
  if (!S.till) tillReset();
  const T = S.till, c = tillCalc(), cu = T.cust !== 'walkin' ? cust(T.cust) : null;
  const pumps = pumpsActive();
  const over = cu ? balance(cu) + c.total - cu.limit : 0;
  const sh = openShift();
  const chip = (txt, on, act, extra = '', dis) => `<a class="chip${on ? ' on' : ''}${dis ? ' dis' : ''}" data-a="${dis ? '' : act}" ${extra}>${txt}</a>`;
  let pumpH = pumps.length > 1 ? `<div class="pumps n">${pumps.map((p) => `<a class="pump${p.id === T.pump ? ' on' : ''}" data-a="pump" data-id="${p.id}"><div class="row" style="justify-content:space-between"><b>${p.id}</b><span style="color:${p.fuel === 'petrol' ? '#22d3ee' : '#f59e0b'}">${t(cap(p.fuel))}</span></div><div class="mut">${money(S.prices[p.fuel])} / ${t('L')}</div><div class="mut">${t('Meter')} ${num(p.meter, 1)}</div></a>`).join('')}</div>`
    : `<div class="mut" style="font-size:15px">${t('Nozzle 1')} · ${t(cap(pumps[0].fuel))} · ${money(S.prices[pumps[0].fuel])} / ${t('L')}</div>`;
  const keys = ['1', '2', '3', '5', '4', '5', '6', '10', '7', '8', '9', '20', '.', '0', '⌫', '50'];
  const keyH = keys.map((k, i) => (i % 4 === 3 ? `<a class="key q" data-a="quick" data-v="${k}">${k} ${t(T.mode === 'litres' ? 'L' : 'MVR')}</a>` : `<a class="key" data-a="key" data-v="${k}">${k}</a>`)).join('');
  const custBox = cu ? `<div class="cbox"><div class="row" style="justify-content:space-between"><b>${esc(cu.name)}</b>${pill(cu.type === 'government' ? 'b' : cu.type === 'company' ? 'n' : 'g', t(cap(cu.type)))}</div>
    <div class="mut sm">${t('Owes')} ${money(balance(cu))} · ${t('limit')} ${num(cu.limit)}${cu.approved ? '' : ' · ' + t('new, not approved yet')}</div>
    ${c.q ? `<div class="mut sm">${tf('Quotation {id} · {po} · {l} left', { id: c.q.id, po: c.q.po, l: L(c.q.litres - quoteUsed(c.q)) })}</div>` : ''}
    <div class="mut sm">${esc(t(cu.vehicle))}</div><a class="lnk sm" data-a="pickCust">${t('Change')}</a></div>` : '';
  const delOn = S.set.delivery.on;
  const delAmt = S.set.delivery.type === 'fixed' ? S.set.delivery.amount : r2(S.set.delivery.amount * c.litres);
  return `<div class="till"><div class="ttop"><a class="bt dk" data-a="go" data-r="${S.role === 'attendant' ? 'till' : 'overview'}">${S.role === 'attendant' ? t('Till') : '← ' + t('Back')}</a><img src="${LOGO_WHITE}" style="height:22px"><span class="mut">${t('Till 1')}</span>
  <span class="mut n" style="margin-inline-start:auto">${sh && S.set.mode !== 'one' ? tf('Shift {id} · {s}', { id: sh.id, s: t(sh.staff) }) : t('Today')}</span>
  <a class="bt dk" data-a="modal" data-m="expense">${t('Expense')}</a><a class="bt dk" data-a="go" data-r="closeShift">${t(S.set.mode === 'one' ? 'Close the day' : 'Close shift')}</a><a class="bt dk" data-a="lang">${S.lang === 'en' ? 'ދިވެހި' : 'English'}</a></div>
  <div class="tgrid"><div class="tleft">${pumpH}
  <div class="row" style="justify-content:space-between;align-items:flex-end;margin-top:18px"><div class="tabs dk">${['litres', 'amount'].map((m) => `<a class="${T.mode === m ? 'on' : ''}" data-a="tmode" data-v="${m}">${t(m === 'litres' ? 'Litres' : 'Amount')}</a>`).join('')}</div>
  <div class="disp n">${T.mode === 'amount' ? t('MVR') + ' ' : ''}<bdi>${T.input || '0'}</bdi> ${T.mode === 'litres' ? `<small>${t('L')}</small>` : ''}</div></div>
  <div class="keys n">${keyH}</div>
  <div class="row" style="margin-top:12px"><a class="bt dk" data-a="modal" data-m="item">${ic('cart', 14)}${t('Add shop item')}</a><a class="bt dk" data-a="clearTill">${t('Clear')}</a></div></div>
  <div class="tright n"><div class="mut sm">${t('Customer')}</div>
  <div class="g3" style="margin-top:6px">${chip(t('Walk-in'), T.cust === 'walkin', 'walkin')}${S.set.credit ? chip(t('Credit customer…'), T.cust !== 'walkin', 'pickCust') + chip('+ ' + t('New customer'), false, 'modal', 'data-m="newcust"') : ''}</div>${custBox}
  <div class="row mut" style="justify-content:space-between;margin-top:14px"><span>${t('Current sale')}</span><span>R-${S.seq.sale + 1} · <bdi>${nowTime()}</bdi></span></div>
  <div class="line"><div>${t(cap(c.p.fuel))} · ${c.p.id}<div class="mut sm">${num(c.litres)} ${t('L')} × ${num(c.price)}${c.q ? ' (' + t('quotation price') + ')' : ''}</div></div><b>${num(c.amount)}</b></div>
  ${T.items.map((i, k) => `<div class="line"><div>${esc(t(i.name))}<div class="mut sm">${i.qty} × ${num(i.price)}</div></div><div class="row"><b>${num(i.price * i.qty)}</b><a class="x" data-a="rmItem" data-k="${k}">✕</a></div></div>`).join('')}
  ${delOn ? (T.delivery == null ? `<a class="lnk sm" data-a="addDel" style="display:block;padding:8px 0">+ ${t('Delivery charge')} (${num(delAmt)})</a>` : `<div class="line"><div>${t('Delivery')}<div class="mut sm">${t('amount can be changed')}</div></div><div class="row"><input class="tin" id="tdel" data-live="tdel" value="${T.delivery}"><a class="x" data-a="rmDel">✕</a></div></div>`) : ''}
  <div style="margin-top:auto"><div class="row" style="justify-content:space-between;align-items:baseline;padding:10px 0"><span class="mut">${t('Total MVR')}</span><b class="tot">${num(c.total)}</b></div>
  <div class="mut sm">${t('Payment')}</div><div class="g4">${['cash', 'card', 'qr', 'credit'].map((p) => chip(t({ cash: 'Cash', card: 'Card', qr: 'QR', credit: 'On credit' }[p]), T.pay === p, 'pay', `data-v="${p}"`, p === 'credit' && !cu)).join('')}</div>
  <div class="mut sm" style="margin-top:8px">${t('Receipt')}</div><div class="g4">${['none', 'viber', 'pdf', 'print'].map((p) => chip(t({ none: 'None', viber: 'Viber', pdf: 'PDF', print: 'Print' }[p]), T.receipt === p, 'rcpt', `data-v="${p}"`, p === 'print' && S.set.printer === 'off')).join('')}</div>
  ${over > 0 && T.pay === 'credit' ? `<div class="warn">${tf('Over the limit by {a}.', { a: money(over) })} ${T.ok ? t('Owner approved.') : `<a class="lnk" data-a="ownerOk">${t('Owner approves')}</a>`}</div>` : ''}
  ${T.cust === 'walkin' ? `<div class="mut sm" style="margin:8px 0">${t('Walk-in pays now. To pay later, add the customer with + New customer.')}</div>` : ''}
  <a class="go" data-a="sell">${t('Complete sale')}${T.pay === 'credit' ? ' · ' + t('goes to Unpaid') : ''}</a></div></div></div>
  <span class="sample dk">${t('SAMPLE DATA')}</span></div>`;
};

// ----- shifts
P.shifts = () => {
  const sh = openShift(), n = sh ? shiftNums(sh) : null;
  const rows = S.shifts.slice().reverse().map((x) => { const tot = x.status === 'open' ? shiftNums(x).total : x.total; return `<tr><td>${x.id}</td><td>${t(x.staff)}</td><td class="m"><bdi>${x.start.replace('Oct', t('Oct'))}${x.end ? ' – ' + x.end : ''}</bdi></td><td class="r">${num(tot)}</td><td class="r ${x.diff < -S.set.cashTol ? 'dn' : ''}">${x.status === 'open' ? '—' : num(x.diff)}</td><td>${x.status === 'open' ? pill('b', t('Open')) : Math.abs(x.diff) > S.set.cashTol ? pill('r', t('Note required')) : pill('g', t('Closed'))}</td><td class="m">${esc(x.note)}</td></tr>`; }).join('');
  return `<div class="ph"><div><h1>${t('Shifts')}</h1><div class="s">${t('Each shift: opening meters, sales, closing meters and cash count')}</div></div>${sh ? `<a class="bt pr" data-a="go" data-r="closeShift">${tf('Close shift {id}', { id: sh.id })}</a>` : `<a class="bt pr" data-a="openShift">${t('Open new shift')}</a>`}</div>
  ${sh ? `<div class="card kpis n" style="grid-template-columns:repeat(4,1fr)"><div class="kpi"><div class="l">${t('Open shift')}</div><div class="v">${sh.id}</div><div class="dl">${t(sh.staff)} · ${t('since')} <bdi>${sh.start.replace('Oct', t('Oct'))}</bdi></div></div>
  <div class="kpi"><div class="l">${t('Sales so far')}</div><div class="v">${money(n.total)}</div><div class="dl">${cnt(n.sales.length, '{n} sale', '{n} sales')}</div></div>
  <div class="kpi"><div class="l">${t('Cash in till (expected)')}</div><div class="v">${money(n.expected)}</div><div class="dl">${t('cash sales − petty cash')}</div></div>
  <div class="kpi"><div class="l">${t('On credit')}</div><div class="v">${money(n.credit)}</div><div class="dl">${t('goes to Unpaid')}</div></div></div>` : ''}
  <div class="card" style="margin-top:14px"><table class="t n"><tr><th>${t('Shift')}</th><th>${t('Attendant')}</th><th>${t('Time')}</th><th class="r">${t('Sales (MVR)')}</th><th class="r">${t('Over / short')}</th><th>${t('Status')}</th><th>${t('Note')}</th></tr>${rows}</table></div>`;
};
P.closeShift = () => {
  let sh = openShift();
  if (!sh) return `<div class="ph"><div><h1>${t('No open shift')}</h1></div><a class="bt pr" data-a="openShift">${t('Open new shift')}</a></div>`;
  const n = shiftNums(sh), F = S.form;
  const pumps = pumpsActive();
  const pr = pumps.map((p) => {
    const sold = n.sales.filter((x) => x.pump === p.id).reduce((a, x) => a + x.litres, 0);
    const close = F['m_' + p.id] != null ? parseFloat(F['m_' + p.id]) || 0 : p.meter;
    const ml = r2(close - sh.openMeters[p.id]); const d = r2(ml - sold);
    return { p, sold, close, ml, d };
  });
  const counted = F.counted != null ? parseFloat(F.counted) || 0 : null;
  const diff = counted == null ? null : r2(counted - n.expected);
  const needNote = diff != null && Math.abs(diff) > S.set.cashTol;
  const one = S.set.mode === 'one';
  return `<div class="ph"><div><h1>${one ? t('Close the day') : tf('Close shift {id}', { id: sh.id })}</h1><div class="s">${one ? t('One person, no shifts · two minutes at closing time') : tf('{s} · since {t}', { s: t(sh.staff), t: `<bdi>${sh.start.replace('Oct', t('Oct'))}</bdi>` })}</div></div><a class="bt pr" data-a="closeShift">${t(one ? 'Close day' : 'Close shift')}</a></div>
  <div class="g2"><div class="card"><div class="ch"><h3>1 · ${t('Meter readings')}</h3><span class="s">${t('enter closing readings')}</span></div>
  <table class="t n"><tr><th>${t('Nozzle')}</th><th class="r">${t('Opening')}</th><th class="r">${t('Closing')}</th><th class="r">${t('By meter')}</th><th class="r">${t('In sales')}</th><th class="r">${t('Difference')}</th></tr>
  ${pr.map((x) => `<tr><td>${x.p.id} · ${t(cap(x.p.fuel))}</td><td class="r">${num(sh.openMeters[x.p.id], 1)}</td><td class="r"><input class="inp" id="m_${x.p.id}" data-live="m_${x.p.id}" value="${F['m_' + x.p.id] ?? x.p.meter}"></td><td class="r">${num(x.ml)}</td><td class="r">${num(x.sold)}</td><td class="r ${Math.abs(x.d) > 0.5 ? 'dn' : 'up'}">${num(x.d)}</td></tr>`).join('')}</table></div>
  <div class="card"><div class="ch"><h3>2 · ${t('Cash count')}</h3><span class="s">${t('count the cash in the till')}</span></div>
  <div class="kv"><span>${t('Cash sales')}</span><b>${num(n.cash)}</b></div><div class="kv"><span>${t('Petty cash taken from till')}</span><b>${num(-n.exp)}</b></div>
  <div class="kv"><span>${t('Cash expected')}</span><b>${num(n.expected)}</b></div>
  <div class="kv"><span>${t('Cash counted')}</span><input class="inp f" id="counted" data-live="counted" value="${F.counted ?? ''}" placeholder="0.00"></div>
  <div class="kv"><span>${t('Difference')}</span><b class="${diff != null && diff < 0 ? 'dn' : ''}">${diff == null ? '—' : num(diff)}</b></div>
  ${needNote ? `<div style="padding:10px 14px"><div class="warn" style="margin:0 0 8px">${tf('More than {a} difference · a note is required and the owner is told.', { a: money(S.set.cashTol) })}</div><input class="inp wide" id="note" data-live="note" value="${esc(F.note || '')}" placeholder="${t('Write why')}"></div>` : ''}
  <div class="kv"><span>${t('Card')}</span><b>${num(n.card)}</b></div><div class="kv"><span>${t('QR / transfer')}</span><b>${num(n.qr)}</b></div><div class="kv"><span>${t('On credit')}</span><b>${num(n.credit)}</b></div></div></div>
  ${S.set.stock === 'drums' ? `<div class="card" style="margin-top:14px"><div class="ch"><h3>3 · ${t('Drums')}</h3><span class="s">${t('optional')}</span></div><div class="kv"><span>${t('Full drums left')}</span><b>${S.drums.full}</b></div><div class="kv"><span>${t('Open drum')}</span><b>${L(S.drums.open)}</b></div><div style="padding:10px 14px"><a class="bt" data-a="modal" data-m="drums">${t('Count drums')}</a></div></div>` : ''}
  <div class="card" style="margin-top:14px"><div class="ch"><h3>${t('Sales in this shift')}</h3><span class="s">${n.sales.length}</span></div>${salesTable(n.sales.slice().reverse())}</div>`;
};

// ----- tanks & drums (animated)
function hFrac(f) { if (f <= 0) return 0; if (f >= 1) return 1; let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2, th = 2 * Math.acos(1 - 2 * m); ((th - Math.sin(th)) / (2 * Math.PI) < f) ? (lo = m) : (hi = m); } return (lo + hi) / 2; }
function vFrac(h) { if (h <= 0) return 0; if (h >= 1) return 1; const th = 2 * Math.acos(1 - 2 * h); return (th - Math.sin(th)) / (2 * Math.PI); }
function shade(hex, a) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const tt = a < 0 ? 0 : 255, p = Math.abs(a); r = Math.round((tt - r) * p + r); g = Math.round((tt - g) * p + g); b = Math.round((tt - b) * p + b); return `rgb(${r},${g},${b})`; }
function tankSVG(id, col, cap_, reorder, lv, tm, inflow) {
  const x0 = 24, y0 = 58, w = 472, h = 150, r = 75, ins = 7, ix = x0 + ins, iy = y0 + ins, iw = w - 2 * ins, ih = h - 2 * ins;
  const y = iy + ih - hFrac(lv / cap_) * ih, ry = iy + ih - hFrac(reorder / cap_) * ih, tc = lv < reorder ? '#b91c1c' : col;
  let wave = ''; const amp = lv > 1 ? 1.4 : 0;
  for (let i = 0; i <= 60; i++) { const xx = ix + i * iw / 60, yy = y + Math.sin(i / 60 * Math.PI * 5 + tm * 2.2) * amp + Math.sin(i / 60 * Math.PI * 9 - tm * 1.6) * amp * 0.5; wave += (i ? 'L' : 'M') + xx.toFixed(1) + ',' + yy.toFixed(1); }
  const surf = wave; wave += `L${ix + iw},${iy + ih + 2}L${ix},${iy + ih + 2}Z`;
  const fx = x0 + 150, vx = x0 + 372, mx = x0 + w / 2;
  let flow = '';
  if (inflow) { const off = (tm * 90) % 28; flow = `<rect x="${fx - 4}" y="${iy}" width="8" height="${Math.max(0, y - iy)}" fill="${shade(col, -0.15)}" opacity=".9"/><line x1="${fx}" y1="${iy}" x2="${fx}" y2="${y}" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-dasharray="10 18" stroke-dashoffset="${-off}"/>`;
    for (let k = 0; k < 12; k++) { const ph = (tm * 1.1 + k * 0.29) % 1, bx = fx + Math.sin(k * 1.7) * 26, by = y + 4 + ph * Math.min(40, iy + ih - y - 6); flow += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${1 + (k % 3) * 0.7}" fill="#fff" opacity="${(0.5 * (1 - ph)).toFixed(2)}"/>`; } }
  const ticks = [0.25, 0.5, 0.75].map((q) => { const yy = iy + ih - hFrac(q) * ih; return `<line x1="${ix + 41}" y1="${yy}" x2="${ix + 51}" y2="${yy}" stroke="#fff" stroke-opacity=".7"/><text x="${ix + 55}" y="${yy + 4}" font-size="12" fill="#fff" fill-opacity=".75">${q * 100}%</text>`; }).join('');
  return `<defs><linearGradient id="sh${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9cdd2"/><stop offset=".12" stop-color="#f7f8f9"/><stop offset=".3" stop-color="#e3e6e9"/><stop offset=".7" stop-color="#b8bdc3"/><stop offset="1" stop-color="#7d848c"/></linearGradient>
  <linearGradient id="in${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2025"/><stop offset=".5" stop-color="#2b3137"/><stop offset="1" stop-color="#15181b"/></linearGradient>
  <linearGradient id="lq${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(tc, 0.18)}"/><stop offset=".35" stop-color="${tc}"/><stop offset="1" stop-color="${shade(tc, -0.45)}"/></linearGradient>
  <linearGradient id="gl${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".22" stop-color="#fff" stop-opacity=".06"/><stop offset=".23" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
  <linearGradient id="pp${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a9097"/><stop offset=".4" stop-color="#eef0f2"/><stop offset="1" stop-color="#7a8088"/></linearGradient>
  <linearGradient id="sd${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b6168"/><stop offset="1" stop-color="#3a3f45"/></linearGradient>
  <radialGradient id="gs${id}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <clipPath id="c${id}"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="${r - ins}"/></clipPath></defs>
  <ellipse cx="${x0 + w / 2}" cy="${y0 + h + 22}" rx="${w * 0.52}" ry="9" fill="url(#gs${id})"/>
  ${[x0 + 95, x0 + w - 95].map((sx) => `<path d="M${sx - 34},${y0 + h + 20} L${sx - 22},${y0 + h - 14} L${sx + 22},${y0 + h - 14} L${sx + 34},${y0 + h + 20} Z" fill="url(#sd${id})"/><rect x="${sx - 40}" y="${y0 + h + 18}" width="80" height="5" rx="1" fill="#2f3439"/>`).join('')}
  <rect x="${fx - 7}" y="${y0 - 26}" width="14" height="30" fill="url(#pp${id})"/><rect x="${fx - 11}" y="${y0 - 30}" width="22" height="7" rx="2" fill="#5b6168"/>
  <path d="M${vx} ${y0 + 2} V${y0 - 40} q0 -12 12 -12 h6" fill="none" stroke="url(#pp${id})" stroke-width="7"/><rect x="${vx + 16}" y="${y0 - 56}" width="8" height="8" rx="1" fill="#5b6168"/>
  <rect x="${mx - 32}" y="${y0 - 14}" width="64" height="18" rx="3" fill="url(#pp${id})"/><rect x="${mx - 38}" y="${y0 - 18}" width="76" height="6" rx="2" fill="#6b7178"/>
  <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${r}" fill="url(#sh${id})"/><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="${r - ins}" fill="url(#in${id})"/>
  <g clip-path="url(#c${id})"><path d="${wave}" fill="url(#lq${id})" opacity=".96"/><path d="${surf}" fill="none" stroke="${shade(tc, 0.55)}" stroke-width="1.6" opacity=".9"/>${flow}${ticks}
  <line x1="${ix + 30}" y1="${ry}" x2="${ix + iw - 30}" y2="${ry}" stroke="#fca5a5" stroke-width="1.2" stroke-dasharray="6 5"/>
  <text x="${ix + iw - 40}" y="${ry + 17}" text-anchor="end" font-size="14" fill="#fecaca" font-weight="600">${t('Reorder')} ${fmtN(reorder, 0)} ${t('L')}</text>
  ${[1 / 3, 2 / 3].map((q) => `<line x1="${x0 + w * q}" y1="${iy}" x2="${x0 + w * q}" y2="${iy + ih}" stroke="#000" stroke-opacity=".25"/>`).join('')}</g>
  <rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="${r - ins}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.5"/>
  ${[1 / 3, 2 / 3].map((q) => `<line x1="${x0 + w * q}" y1="${y0 + 1}" x2="${x0 + w * q}" y2="${iy}" stroke="#8a9097"/><line x1="${x0 + w * q}" y1="${iy + ih}" x2="${x0 + w * q}" y2="${y0 + h - 1}" stroke="#6b7178"/>`).join('')}
  <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${r}" fill="url(#gl${id})"/><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="#6b7178" stroke-width="1.2"/>`;
}
function drumsSVG(tm) {
  const D = S.drums, total = Math.max(8, D.full + 2);
  let s = `<defs><linearGradient id="dbody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0f2238"/><stop offset=".18" stop-color="#2c5583"/><stop offset=".32" stop-color="#5d87b5"/><stop offset=".45" stop-color="#2f5a89"/><stop offset=".85" stop-color="#16304f"/><stop offset="1" stop-color="#0c1b2d"/></linearGradient>
  <linearGradient id="dtop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f79a6"/><stop offset="1" stop-color="#1a3657"/></linearGradient><linearGradient id="din" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#121417"/><stop offset=".5" stop-color="#2a2e33"/><stop offset="1" stop-color="#101214"/></linearGradient>
  <linearGradient id="dlq" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade(PET, -0.5)}"/><stop offset=".35" stop-color="${shade(PET, 0.15)}"/><stop offset="1" stop-color="${shade(PET, -0.55)}"/></linearGradient><linearGradient id="drib" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d1d30"/><stop offset=".3" stop-color="#7ea3cc"/><stop offset="1" stop-color="#0d1d30"/></linearGradient>
  <radialGradient id="dsh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>`;
  for (let k = 0; k < total; k++) {
    const cx = 58 + k * (1080 / total), w = Math.min(104, 1080 / total - 22), x = cx - w / 2, top = 40, h = 196, ey = 11;
    const full = k < D.full, isOpen = k === D.full && D.open > 0, f = full ? 1 : isOpen ? D.open / D.size : 0;
    s += `<ellipse cx="${cx}" cy="${top + h + 4}" rx="${w * 0.62}" ry="9" fill="url(#dsh)"/><path d="M${x},${top} V${top + h} A${w / 2},${ey} 0 0 0 ${x + w},${top + h} V${top} Z" fill="url(#dbody)"/>`;
    const wx = x + 16, ww = w - 32, wt = top + 22, wb = top + h - 14, wh = wb - wt, ly = wb - f * wh;
    let wave = ''; for (let i = 0; i <= 20; i++) { const xx = wx + i * ww / 20, yy = ly + (isOpen ? Math.sin(i / 20 * Math.PI * 2.5 + tm * 2.4) * 1.3 : 0); wave += (i ? 'L' : 'M') + xx.toFixed(1) + ',' + yy.toFixed(1); }
    s += `<rect x="${wx}" y="${wt}" width="${ww}" height="${wh}" rx="4" fill="url(#din)"/>`;
    if (f > 0) s += `<path d="${wave}L${wx + ww},${wb}L${wx},${wb}Z" fill="url(#dlq)"/><path d="${wave}" fill="none" stroke="${shade(PET, 0.6)}" stroke-width="1.4"/>`;
    s += `<rect x="${wx}" y="${wt}" width="${ww}" height="${wh}" rx="4" fill="none" stroke="#000" stroke-opacity=".5"/>`;
    for (const ry of [top + h * 0.34, top + h * 0.67]) s += `<path d="M${x - 2},${ry - 3} A${w / 2 + 2},${ey} 0 0 0 ${x + w + 2},${ry - 3} V${ry + 3} A${w / 2 + 2},${ey} 0 0 1 ${x - 2},${ry + 3} Z" fill="url(#drib)"/>`;
    s += `<ellipse cx="${cx}" cy="${top}" rx="${w / 2}" ry="${ey}" fill="url(#dtop)"/><ellipse cx="${cx}" cy="${top}" rx="${w / 2 - 4}" ry="${ey - 3}" fill="none" stroke="#0c1b2d" stroke-opacity=".6" stroke-width="2"/><ellipse cx="${cx - 24}" cy="${top - 1}" rx="8" ry="3" fill="#9aa1a9"/><ellipse cx="${cx + 26}" cy="${top + 1}" rx="5" ry="2" fill="#9aa1a9"/>
    ${isOpen ? `<rect x="${cx - 27}" y="${top - 28}" width="6" height="26" fill="#c7ccd1"/><rect x="${cx - 31}" y="${top - 34}" width="14" height="8" rx="2" fill="#6b7178"/>` : ''}
    <text x="${cx}" y="${top + h + 34}" text-anchor="middle" font-size="13" fill="${isOpen ? '#18181b' : '#71717a'}" font-weight="${isOpen ? 600 : 500}">${full ? t('Full') : isOpen ? t('Open') + ' · ' + Math.round(D.open) + ' ' + t('L') : t('Empty')}</text>`;
  }
  return s;
}
P.tanks = () => {
  if (S.set.stock === 'drums') {
    const D = S.drums, stock = D.full * D.size + D.open;
    return `<div class="ph"><div><h1>${t('Drums & stock')}</h1><div class="s">${tf('{s} L drums · count at closing', { s: D.size })}</div></div><div class="row"><a class="bt" data-a="modal" data-m="delivery">${t('Drums delivered')}</a><a class="bt pr" data-a="modal" data-m="drums">${t('Count drums')}</a></div></div>
    <div class="card"><div class="ch"><h3>${t('Petrol drums')}</h3>${pill('g', tf('Counted {t}', { t: `<bdi>${D.counted}</bdi>` }))}</div><div style="padding:22px 20px 10px"><svg id="dsvg" viewBox="0 0 1100 290" width="100%"></svg></div>
    <div class="kpis n" style="grid-template-columns:repeat(3,1fr);border-top:1px solid #f0f0ee"><div class="kpi"><div class="l">${t('Full drums')}</div><div class="v">${D.full}</div><div class="dl">× ${L(D.size)}</div></div>
    <div class="kpi"><div class="l">${t('Open drum')}</div><div class="v">${L(D.open)}</div><div class="dl">${t('goes down with each sale')}</div></div><div class="kpi"><div class="l">${t('Stock now')}</div><div class="v">${L(stock)}</div><div class="dl">${tf('lasts about {d} days', { d: num(stock / 310, 1) })}</div></div></div></div>`;
  }
  return `<div class="ph"><div><h1>${t('Tanks & dips')}</h1><div class="s">${t('Live level from the last dip, minus sales since then, plus deliveries')}</div></div><div class="row"><a class="bt" data-a="modal" data-m="delivery">${t('New delivery')}</a><a class="bt pr" data-a="modal" data-m="dip">${ic('drop', 14, '#fff')}${t('Record dip')}</a></div></div>
  <div class="g2">${S.tanks.map((tk) => { const a = S.anim[tk.id]; return `<div class="card"><div class="ch"><h3>${tk.id} · ${t(cap(tk.fuel))}</h3>${a ? pill('b', t('Delivery · receiving')) : tk.level < tk.reorder ? pill('r', t('Below reorder')) : pill('g', t('OK'))}</div>
  <div class="tk n"><div class="tkv"><svg id="svg${tk.id}" viewBox="0 0 520 250" width="100%"></svg></div><div class="tkm"><div class="mut">${t('In tank now')}</div><div class="big" id="lv${tk.id}">${L(tk.level)}</div><div class="mut" style="margin-bottom:8px"><bdi>${(tk.level / tk.cap * 100).toFixed(1)}%</bdi> · ${L(tk.cap)}</div>
  <div class="kv0"><span>${t('Space for')}</span><b>${L(tk.cap - tk.level)}</b></div><div class="kv0"><span>${t('Reorder at')}</span><b>${L(tk.reorder)}</b></div><div class="kv0"><span>${t('Lasts about')}</span><b>${tf('{d} days', { d: num(tk.level / (tk.fuel === 'petrol' ? 1957 : 1530), 1) })}</b></div></div></div>
  ${a ? `<div class="banner" id="bn${tk.id}"></div>` : ''}</div>`; }).join('')}</div>
  <div class="card" style="margin-top:14px"><div class="ch"><h3>${t('Dips')}</h3><span class="s">${tf('alert above {p}%', { p: S.set.varTol })}</span></div><table class="t n"><tr><th>${t('Tank')}</th><th>${t('Last dip')}</th><th class="r">${t('Measured')}</th><th class="r">${t('Book stock')}</th><th class="r">${t('Variance')}</th><th>${t('Status')}</th></tr>
  ${S.tanks.map((tk) => { const v = tk.dip.measured - tk.dip.book, p = v / tk.dip.book * 100; return `<tr><td>${tk.id} · ${t(cap(tk.fuel))}</td><td class="m"><bdi>${tk.dip.time}</bdi>${tk.dip.cm ? ' · ' + num(tk.dip.cm, 1) + ' ' + t('cm') : ''}</td><td class="r">${L(tk.dip.measured)}</td><td class="r">${L(tk.dip.book)}</td><td class="r ${Math.abs(p) > S.set.varTol ? 'dn' : ''}">${L(v)} (<bdi>${p.toFixed(2)}%</bdi>)</td><td>${Math.abs(p) > S.set.varTol ? pill('r', t('Investigate')) : pill('g', t('Within tolerance'))}</td></tr>`; }).join('')}</table></div>`;
};
let raf = 0;
function animate() {
  cancelAnimationFrame(raf);
  const t0 = performance.now();
  const loop = (now) => {
    const tm = (now - t0) / 1000;
    if (S.route !== 'tanks') return;
    if (S.set.stock === 'drums') { const el = $('#dsvg'); if (el) el.innerHTML = drumsSVG(tm); }
    else S.tanks.forEach((tk) => {
      const el = $('#svg' + tk.id); if (!el) return;
      const a = S.anim[tk.id]; let lv = tk.level, inflow = false;
      if (a) { const p = Math.min(1, (now - a.start) / 4500), e = 1 - Math.pow(1 - p, 3); lv = a.from + (a.to - a.from) * e; inflow = p < 1;
        const lvEl = $('#lv' + tk.id); if (lvEl) lvEl.innerHTML = L(lv); const bn = $('#bn' + tk.id); if (bn) bn.innerHTML = p < 1 ? tf('{a} of {b} received', { a: L(lv - a.from), b: L(a.to - a.from) }) : tf('Received {a} · dip again in 30 min', { a: L(a.to - a.from) });
        if (p >= 1 && !a.done) { a.done = true; setTimeout(() => { delete S.anim[tk.id]; render(); }, 3500); } }
      el.innerHTML = tankSVG(tk.id, FUELC[tk.fuel], tk.cap, tk.reorder, lv, tm, inflow);
    });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

// ----- deliveries
P.deliveries = () => {
  const rows = S.deliveries.slice().sort((a, b) => b.date.localeCompare(a.date));
  const tot = rows.reduce((a, d) => a + d.received * d.price, 0);
  return `<div class="ph"><div><h1>${t('Deliveries')}</h1><div class="s">${t('Fuel bought from the supplier · received vs invoiced · cost per litre')}</div></div><a class="bt pr" data-a="modal" data-m="delivery">${t('New delivery')}</a></div>
  <div class="card kpis n" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><div class="l">${t('Received, October')}</div><div class="v">${L(rows.reduce((a, d) => a + d.received, 0))}</div><div class="dl">${cnt(rows.length, '{n} delivery', '{n} deliveries')}</div></div>
  <div class="kpi"><div class="l">${t('Short deliveries')}</div><div class="v dn">${L(rows.reduce((a, d) => a + d.received - d.invoiced, 0))}</div><div class="dl">${t('received − invoiced')}</div></div>
  <div class="kpi"><div class="l">${t('Average cost per litre')}</div><div class="v">${num(S.cost.petrol)} / ${num(S.cost.diesel)}</div><div class="dl">${t('Petrol')} / ${t('Diesel')}</div></div></div>
  <div class="card" style="margin-top:14px"><table class="t n"><tr><th>${t('Date')}</th><th>${t('Fuel')}</th><th>${t('Supplier')}</th><th class="r">${t('Invoiced')}</th><th class="r">${t('Received')}</th><th class="r">${t('Difference')}</th><th class="r">${t('Price / L')}</th><th class="r">${t('MVR')}</th></tr>
  ${rows.map((d) => `<tr><td class="m">${dShort(d.date)}</td><td><span class="sw" style="background:${FUELC[d.fuel]}"></span>${t(cap(d.fuel))}${d.tank ? ' · ' + d.tank : ''}</td><td>${esc(t(d.supplier))}</td><td class="r">${L(d.invoiced)}</td><td class="r">${L(d.received)}</td><td class="r ${d.received < d.invoiced ? 'dn' : 'm'}">${L(d.received - d.invoiced)}</td><td class="r">${num(d.price)}</td><td class="r">${num(d.received * d.price)}</td></tr>`).join('')}</table>
  <div class="pg"><span>${cnt(rows.length, '{n} delivery', '{n} deliveries')}</span><span>${money(tot)}</span></div></div>`;
};

// ----- expenses
P.expenses = () => {
  const tab = S.tab.exp || 'all';
  const rows = S.expenses.filter((e) => tab === 'all' || (tab === 'till' ? e.from === 'till' : e.from !== 'till')).slice().sort((a, b) => b.date.localeCompare(a.date));
  const cats = {}; S.expenses.forEach((e) => (cats[e.cat] = (cats[e.cat] || 0) + e.amount));
  const tot = Object.values(cats).reduce((a, b) => a + b, 0);
  return `<div class="ph"><div><h1>${t('Expenses')}</h1><div class="s">${t('Petty cash from the till and office expenses · fuel purchases are in Deliveries')}</div></div><a class="bt pr" data-a="modal" data-m="expense">${t('New expense')}</a></div>
  <div class="g2w"><div class="card"><div class="ch"><div class="tabs">${[['all', 'All'], ['till', 'Petty cash'], ['bank', 'Office']].map(([k, n]) => `<a class="${tab === k ? 'on' : ''}" data-a="tab" data-k="exp" data-v="${k}">${t(n)}</a>`).join('')}</div><span class="s">${money(rows.reduce((a, e) => a + e.amount, 0))}</span></div>
  <table class="t n"><tr><th>${t('Date')}</th><th>${t('Expense')}</th><th>${t('Category')}</th><th>${t('Paid from')}</th><th class="r">${t('MVR')}</th><th>${t('By')}</th></tr>${rows.map((e) => `<tr><td class="m">${dShort(e.date)}</td><td><b class="w5">${esc(t(e.desc))}</b>${e.shift ? `<small>${e.shift}</small>` : ''}</td><td class="m">${t(e.cat)}</td><td class="m">${t(e.from === 'till' ? 'Cash from till' : 'Bank transfer')}</td><td class="r">${num(e.amount)}</td><td class="m">${t(e.staff)}</td></tr>`).join('')}</table></div>
  <div class="card"><div class="ch"><h3>${t('By category')}</h3><span class="s">${money(tot)}</span></div>${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<div style="padding:8px 14px"><div class="row" style="justify-content:space-between"><span>${t(n)}</span><span class="n">${num(v, 0)}</span></div><div class="bar"><i style="width:${(v / tot * 100).toFixed(1)}%;background:#18181b"></i></div></div>`).join('')}</div></div>`;
};

// ----- credit accounts
P.credit = () => {
  const rows = S.customers.map((c) => { const b = balance(c), ld = lateDays(c); return `<tr class="click" data-a="modal" data-m="customer" data-id="${c.id}"><td><b class="w5"><bdi>${esc(c.name)}</bdi></b><small>${esc(t(c.vehicle))}</small></td><td>${pill(c.type === 'government' ? 'b' : c.type === 'company' ? 'n' : 'g', t(cap(c.type)))}</td><td class="m"><bdi>${esc(c.phone)}</bdi></td><td class="r m">${num(c.limit, 0)}</td><td class="r">${num(b)}</td><td class="m">${tf('{d} days', { d: c.terms })}</td><td>${!c.approved ? pill('b', t('New · till')) : b <= 0 ? pill('n', t('Nothing owed')) : ld > 0 ? pill('r', tf('{d} days late', { d: ld })) : pill('g', t('Current'))}</td></tr>`; }).join('');
  return `<div class="ph"><div><h1>${t('Credit accounts')}</h1><div class="s">${t('Regular customers who take fuel now and pay later · click a customer for the statement')}</div></div><a class="bt pr" data-a="modal" data-m="newcust" data-owner="1">${t('New account')}</a></div>
  <div class="card"><table class="t n"><tr><th>${t('Customer')}</th><th>${t('Type')}</th><th>${t('Phone')}</th><th class="r">${t('Limit')}</th><th class="r">${t('Owes (MVR)')}</th><th>${t('Terms')}</th><th>${t('Status')}</th></tr>${rows}</table></div>`;
};

// ----- unpaid
P.unpaid = () => {
  const owing = S.customers.filter((c) => balance(c) > 0).sort((a, b) => lateDays(b) - lateDays(a));
  const tot = owing.reduce((a, c) => a + balance(c), 0), late = owing.filter((c) => lateDays(c) > 0);
  const invOpen = S.invoices.filter((i) => i.amount > i.paid);
  const nw = S.customers.filter((c) => !c.approved);
  return `<div class="ph"><div><h1>${t('Unpaid')}</h1><div class="s">${t('Everyone who took fuel and has not paid yet · walk-in customers pay at the till, so they are never here')}</div></div>
  <div class="row"><a class="bt" data-a="remind">${ic('bell', 14)}${tf('Remind late ({n})', { n: late.length })}</a><a class="bt pr" data-a="modal" data-m="payment">${t('Payment received')}</a></div></div>
  <div class="card kpis n" style="grid-template-columns:repeat(4,1fr)"><div class="kpi"><div class="l">${t('Owed to you')}</div><div class="v">${money(tot)}</div><div class="dl">${cnt(owing.length, '{n} customer', '{n} customers')}</div></div>
  <div class="kpi"><div class="l">${t('Late')}</div><div class="v dn">${money(late.reduce((a, c) => a + balance(c), 0))}</div><div class="dl">${cnt(late.length, '{n} customer', '{n} customers')}</div></div>
  <div class="kpi"><div class="l">${t('Invoices waiting')}</div><div class="v">${money(invOpen.reduce((a, i) => a + i.amount - i.paid, 0))}</div><div class="dl">${cnt(invOpen.length, '{n} invoice', '{n} invoices')}</div></div>
  <div class="kpi"><div class="l">${t('Added at the till')}</div><div class="v">${nw.length}</div><div class="dl">${t('check and approve')}</div></div></div>
  <div class="g2w" style="margin-top:14px"><div class="card"><table class="t n"><tr><th>${t('Customer')}</th><th>${t('Owed since')}</th><th>${t('Invoices')}</th><th class="r">${t('MVR')}</th><th>${t('Status')}</th><th></th></tr>
  ${owing.map((c) => { const ld = lateDays(c), ni = S.invoices.filter((i) => i.cust === c.id && i.amount > i.paid).length; return `<tr><td><b class="w5"><bdi>${esc(c.name)}</bdi></b><small>${t(cap(c.type))}</small></td><td class="m">${dShort(oldestOwed(c))}</td><td class="m">${ni || '—'}</td><td class="r">${num(balance(c))}</td><td>${!c.approved ? pill('b', t('New · till')) : ld > 0 ? pill('r', tf('{d} days late', { d: ld })) : ld > -3 ? pill('a', t('Due soon')) : pill('n', t('Not due'))}</td><td><a class="lnk" data-a="modal" data-m="payment" data-id="${c.id}">${t('Paid')}</a> · <a class="lnk" data-a="modal" data-m="customer" data-id="${c.id}">${t('Statement')}</a></td></tr>`; }).join('') || `<tr><td colspan="6" class="empty">${t('Nobody owes money')}</td></tr>`}</table></div>
  <div class="card"><div class="ch"><h3>${t('New at the till')}</h3><span class="s">${t('needs owner check')}</span></div>${nw.map((c) => `<div style="padding:12px 14px;border-bottom:1px solid #f4f4f2"><b class="w6"><bdi>${esc(c.name)}</bdi></b><div class="mut sm">${esc(t(c.vehicle))} · ${tf('added by {s}', { s: t(c.addedBy || 'Ahmed') })}</div><div class="mut sm">${t('Owes')} ${money(balance(c))} · ${t('limit')} ${num(c.limit, 0)}</div>
  <div class="row" style="margin-top:8px"><a class="bt sm" data-a="modal" data-m="customer" data-id="${c.id}">${t('Edit limit')}</a><a class="bt pr sm" data-a="approve" data-id="${c.id}">${t('Approve customer')}</a></div></div>`).join('') || `<div class="empty">${t('None. Staff can add a new customer at the till with + New customer.')}</div>`}
  <div style="padding:12px 14px;color:#52525b;font-size:12.5px;line-height:1.5">${t('When money comes in, choose the customer and the amount. It pays the chosen invoice, or the oldest amount first.')}</div></div></div>`;
};

// ----- quotations & invoices
P.quotes = () => {
  const tab = S.tab.q || 'quotes';
  const qs = S.quotes.slice().reverse();
  const st = (s) => ({ draft: pill('n', t('Draft')), sent: pill('a', t('Sent · waiting')), approved: pill('g', t('Approved')), invoiced: pill('b', t('Invoiced')) }[s]);
  const qrows = qs.map((q) => { const used = quoteUsed(q), uninv = S.sales.filter((x) => x.quote === q.id && !x.invoice).length; return `<tr><td>${q.id}</td><td><b class="w5">${custName(q.cust)}</b><small>${t(cap(q.fuel))} ${L(q.litres)}${q.delMax ? ' · ' + t('delivery') : ''}</small></td><td class="r">${num(q.litres * q.price)}</td><td class="m">${esc(q.po) || '—'}</td><td>${q.status === 'approved' || q.status === 'invoiced' ? `<div class="bar" style="width:90px"><i style="width:${Math.min(100, used / q.litres * 100)}%;background:#18181b"></i></div><small>${num(used, 0)} / ${num(q.litres, 0)} ${t('L')}</small>` : '—'}</td><td>${st(q.status)}</td>
  <td class="acts"><a class="lnk" data-a="modal" data-m="doc" data-id="${q.id}">${t('View')}</a>${q.status === 'draft' ? ` · <a class="lnk" data-a="qsend" data-id="${q.id}">${t('Send')}</a>` : ''}${q.status === 'sent' ? ` · <a class="lnk" data-a="modal" data-m="po" data-id="${q.id}">${t('Approve (PO)')}</a>` : ''}${q.status === 'approved' && uninv ? ` · <a class="lnk" data-a="mkinv" data-id="${q.id}">${tf(uninv === 1 ? 'Make invoice (1 sale)' : 'Make invoice ({n} sales)', { n: uninv })}</a>` : ''}</td></tr>`; }).join('');
  const irows = S.invoices.slice().reverse().map((i) => { const left = r2(i.amount - i.paid), late = dayDiff(i.due); return `<tr><td>${i.id}</td><td><b class="w5">${custName(i.cust)}</b><small>${i.quote || ''}</small></td><td class="m">${dShort(i.date)}</td><td class="m">${dShort(i.due)}</td><td class="r">${num(i.amount)}</td><td class="r">${num(left)}</td><td>${left <= 0 ? pill('g', t('Paid')) : late > 0 ? pill('r', tf('{d} days late', { d: late })) : pill('n', t('Not due'))}</td><td class="acts"><a class="lnk" data-a="modal" data-m="doc" data-id="${i.id}">${t('View')}</a>${left > 0 ? ` · <a class="lnk" data-a="modal" data-m="payment" data-id="${i.cust}" data-inv="${i.id}">${t('Mark paid')}</a>` : ''}</td></tr>`; }).join('');
  return `<div class="ph"><div><h1>${t('Quotations & invoices')}</h1><div class="s">${t('For offices that need a quotation first and an invoice before they pay')}</div></div>
  <div class="row"><div class="tabs">${[['quotes', 'Quotations'], ['inv', 'Invoices']].map(([k, n]) => `<a class="${tab === k ? 'on' : ''}" data-a="tab" data-k="q" data-v="${k}">${t(n)}</a>`).join('')}</div><a class="bt pr" data-a="modal" data-m="quote">${t('New quotation')}</a></div></div>
  <div class="steps">${['Quotation', 'Approved with PO', 'Fuel taken on credit', 'Invoice', 'Unpaid', 'Paid'].map((x, i) => `<span><b>${i + 1}</b>${t(x)}</span>`).join('<i>→</i>')}</div>
  <div class="card">${tab === 'quotes' ? `<table class="t n"><tr><th>${t('No.')}</th><th>${t('Customer')}</th><th class="r">${t('MVR')}</th><th>${t('Approval')}</th><th>${t('Used')}</th><th>${t('Status')}</th><th></th></tr>${qrows}</table>` : `<table class="t n"><tr><th>${t('No.')}</th><th>${t('Customer')}</th><th>${t('Date')}</th><th>${t('Due')}</th><th class="r">${t('Amount')}</th><th class="r">${t('Left to pay')}</th><th>${t('Status')}</th><th></th></tr>${irows}</table>`}</div>`;
};

// ----- prices
P.prices = () => `<div class="ph"><div><h1>${t('Price lists')}</h1><div class="s">${t('A new price is used for new sales right away. Old sales keep their price.')}</div></div><a class="bt pr" data-a="savePrices">${t('Save prices')}</a></div>
  <div class="g2"><div class="card"><div class="ch"><h3>${t('Pump prices')}</h3></div>${['petrol', 'diesel'].map((f) => `<div class="kv"><span><span class="sw" style="background:${FUELC[f]}"></span>${t(cap(f))} · ${t('MVR')} / ${t('L')}</span><input class="inp" id="pr_${f}" data-live="pr_${f}" value="${S.form['pr_' + f] ?? S.prices[f]}"></div>`).join('')}
  <div class="kv"><span>${t('Quotation price')}</span><b>${t('set on each quotation')}</b></div></div>
  <div class="card"><div class="ch"><h3>${t('Price history')}</h3></div><table class="t n"><tr><th>${t('From')}</th><th class="r">${t('Petrol')}</th><th class="r">${t('Diesel')}</th><th>${t('Note')}</th></tr>${S.priceLog.slice().reverse().map((p) => `<tr><td class="m">${dShort(p.date)}</td><td class="r">${num(p.petrol)}</td><td class="r">${num(p.diesel)}</td><td class="m">${esc(t(p.note))}</td></tr>`).join('')}</table></div></div>`;

// ----- shop items
P.items = () => `<div class="ph"><div><h1>${t('Shop items')}</h1><div class="s">${t('Oil, parts and drinks sold at the same till')}</div></div></div>
  <div class="card"><table class="t n"><tr><th>${t('Item')}</th><th class="r">${t('Price')}</th><th class="r">${t('Cost')}</th><th class="r">${t('Stock')}</th><th>${t('Status')}</th></tr>${S.items.map((i) => `<tr><td>${esc(t(i.name))}</td><td class="r">${num(i.price)}</td><td class="r m">${num(i.cost)}</td><td class="r">${i.stock}</td><td>${i.stock <= 5 ? pill('r', t('Low stock')) : pill('g', t('OK'))}</td></tr>`).join('')}</table></div>`;

// ----- reports
P.reports = () => {
  const tab = S.tab.rep || 'today';
  const ts = todaySales();
  const sum = (arr, f) => r2(arr.reduce((a, x) => a + f(x), 0));
  let body = '';
  if (tab === 'today') {
    const byPay = ['cash', 'card', 'qr', 'credit'].map((p) => [p, sum(ts.filter((x) => x.pay === p), (x) => x.total)]);
    const byStaff = {}; ts.forEach((x) => (byStaff[x.staff] = (byStaff[x.staff] || 0) + x.total));
    body = `<div class="g3c"><div class="card"><div class="ch"><h3>${t('Fuel')}</h3></div>${['petrol', 'diesel'].map((f) => { const a = ts.filter((x) => x.fuel === f); return `<div class="kv"><span>${t(cap(f))}</span><b>${L(sum(a, (x) => x.litres), 2)} · ${num(sum(a, (x) => x.amount))}</b></div>`; }).join('')}<div class="kv"><span>${t('Delivery charges')}</span><b>${num(sum(ts, (x) => x.delivery))}</b></div><div class="kv"><span>${t('Shop items')}</span><b>${num(sum(ts, (x) => x.total - x.amount - x.delivery))}</b></div><div class="kv tot2"><span>${t('Total')}</span><b>${num(sum(ts, (x) => x.total))}</b></div></div>
    <div class="card"><div class="ch"><h3>${t('By payment')}</h3></div>${byPay.map(([p, v]) => `<div class="kv"><span>${payPill(p)}</span><b>${num(v)}</b></div>`).join('')}</div>
    <div class="card"><div class="ch"><h3>${t('By staff')}</h3></div>${Object.entries(byStaff).map(([s, v]) => `<div class="kv"><span>${t(s)}</span><b>${num(v)}</b></div>`).join('')}<div class="kv"><span>${t('Expenses today')}</span><b>${num(sum(S.expenses.filter((e) => e.date === TODAY), (e) => e.amount))}</b></div></div></div>`;
  } else if (tab === 'profit') {
    const fuel = ['petrol', 'diesel'].map((f) => { const a = S.sales.filter((x) => x.fuel === f); const l = sum(a, (x) => x.litres), s = sum(a, (x) => x.amount), c = r2(l * S.cost[f]); return { f, l, s, c, m: r2(s - c) }; });
    const del = sum(S.sales, (x) => x.delivery);
    const shopS = sum(S.sales, (x) => x.items.reduce((a, i) => a + i.price * i.qty, 0)), shopC = sum(S.sales, (x) => x.items.reduce((a, i) => a + i.cost * i.qty, 0));
    const exp = sum(S.expenses.filter((e) => e.date === TODAY), (e) => e.amount);
    const loss = S.set.stock === 'tanks' ? sum(S.tanks, (tk) => Math.min(0, tk.dip.measured - tk.dip.book) * S.cost[tk.fuel]) : 0;
    const gross = sum(fuel, (x) => x.m) + del + shopS - shopC, net = r2(gross - exp + loss);
    body = `<div class="g2w"><div class="card n"><div class="ch"><h3>${t('Profit · today (sales in this demo)')}</h3></div><table class="t"><tr><th>${t('Line')}</th><th class="r">${t('Petrol')}</th><th class="r">${t('Diesel')}</th><th class="r">${t('Total (MVR)')}</th></tr>
    <tr><td>${t('Litres sold')}</td>${fuel.map((x) => `<td class="r">${num(x.l, 2)}</td>`).join('')}<td class="r">${num(sum(fuel, (x) => x.l), 2)}</td></tr>
    <tr><td>${t('Fuel sales')}</td>${fuel.map((x) => `<td class="r">${num(x.s)}</td>`).join('')}<td class="r">${num(sum(fuel, (x) => x.s))}</td></tr>
    <tr><td>${t('Fuel cost')}</td>${fuel.map((x) => `<td class="r m">${num(-x.c)}</td>`).join('')}<td class="r m">${num(-sum(fuel, (x) => x.c))}</td></tr>
    <tr class="hl"><td>${t('Fuel margin')}</td>${fuel.map((x) => `<td class="r">${num(x.m)}</td>`).join('')}<td class="r">${num(sum(fuel, (x) => x.m))}</td></tr>
    <tr><td>${t('Delivery charges')}</td><td></td><td></td><td class="r">${num(del)}</td></tr><tr><td>${t('Shop profit')}</td><td></td><td></td><td class="r">${num(shopS - shopC)}</td></tr>
    <tr><td>${t('Expenses today')}</td><td></td><td></td><td class="r m">${num(-exp)}</td></tr><tr><td>${t('Fuel loss (dips)')}</td><td></td><td></td><td class="r m">${num(loss)}</td></tr>
    <tr class="hl2"><td>${t('Net profit')}</td><td></td><td></td><td class="r">${num(net)}</td></tr></table></div>
    <div class="card" style="padding:14px;color:#52525b;line-height:1.6">${t('Fuel cost uses the average cost per litre from Deliveries. Credit sales count as sales when made; the money still owed is in Unpaid.')}</div></div>`;
  } else if (tab === 'ageing') {
    const b = [[0, 15], [16, 30], [31, 60], [61, 9999]];
    const rows = S.customers.filter((c) => balance(c) > 0).map((c) => { const d = dayDiff(oldestOwed(c)); return `<tr><td><bdi>${esc(c.name)}</bdi></td>${b.map(([a, z]) => `<td class="r">${d >= a && d <= z ? num(balance(c)) : '—'}</td>`).join('')}<td class="r">${num(balance(c))}</td></tr>`; }).join('');
    body = `<div class="card"><table class="t n"><tr><th>${t('Customer')}</th><th class="r">${t('0–15 days')}</th><th class="r">${t('16–30 days')}</th><th class="r">${t('31–60 days')}</th><th class="r">${t('Over 60 days')}</th><th class="r">${t('Total')}</th></tr>${rows}</table></div>`;
  } else {
    body = P.tanks().split('<div class="card" style="margin-top:14px">')[1] ? `<div class="card">` + P.tanks().split('<div class="card" style="margin-top:14px">')[1] : `<div class="card empty">${t('Drum sheds: see Drums & stock')}</div>`;
  }
  return `<div class="ph"><div><h1>${t('Reports')}</h1><div class="s">${t('Everything is worked out from the sales, dips, deliveries and expenses in this demo')}</div></div><div class="row"><a class="bt" data-a="toast" data-v="PDF">${ic('dl', 14)}PDF</a><a class="bt" data-a="toast" data-v="Excel">${ic('dl', 14)}Excel</a></div></div>
  <div class="tabs" style="display:inline-flex;margin-bottom:14px">${[['today', 'Daily sales'], ['profit', 'Profit'], ['ageing', 'Who owes, by age'], ['tank', 'Tank variance']].map(([k, n]) => `<a class="${tab === k ? 'on' : ''}" data-a="tab" data-k="rep" data-v="${k}">${t(n)}</a>`).join('')}</div>${body}`;
};

// ----- settings
P.settings = () => {
  const s = S.set;
  const seg = (key, opts, val) => `<div class="tabs">${opts.map(([v, n]) => `<a class="${String(val) === String(v) ? 'on' : ''}" data-a="setv" data-k="${key}" data-v="${v}">${t(n)}</a>`).join('')}</div>`;
  const tog = (key, on) => `<a class="tog${on ? ' on' : ''}" data-a="setv" data-k="${key}" data-v="${on ? 0 : 1}"><i></i></a>`;
  const row = (a, b, c) => `<div class="srow"><div><b class="w5">${t(a)}</b><div class="mut sm">${t(b)}</div></div>${c}</div>`;
  return `<div class="ph"><div><h1>${t('Settings')}</h1><div class="s">${t('Each shed turns on only what it uses · try them, the whole demo changes')}</div></div><a class="bt${S.resetArm ? ' pr' : ''}" data-a="reset">${t(S.resetArm ? 'Tap again to reset' : 'Reset sample data')}</a></div>
  <div class="g2">
  <div class="card"><div class="ch"><h3>${t('Working mode')}</h3></div>${row('How the shed works', 'Changes the menu and the closing screen', seg('mode', [['shifts', 'Shifts'], ['one', 'One person']], s.mode))}${row('Nozzles', 'One nozzle skips the pump choice at the till', seg('nozzles', [[4, '4 nozzles'], [1, '1 nozzle']], s.nozzles))}${row('Stock', 'Underground tanks or drums', seg('stock', [['tanks', 'Tanks'], ['drums', 'Drums']], s.stock))}</div>
  <div class="card"><div class="ch"><h3>${t('Delivery charge')}</h3>${tog('delivery.on', s.delivery.on)}</div>${row('Charge type', 'Shown as its own line on the bill', seg('delivery.type', [['fixed', 'Fixed'], ['litre', 'Per litre']], s.delivery.type))}${row('Default amount', 'Staff can change or remove it on each sale', `<input class="inp" id="delamt" data-live="delamt" value="${S.form.delamt ?? s.delivery.amount}" style="width:110px">`)}</div>
  <div class="card"><div class="ch"><h3>${t('Receipts & printing')}</h3></div>${row('Printer', 'Optional · print buttons appear only when set', seg('printer', [['off', 'Off'], ['80mm', '80 mm'], ['a4', 'A4']], s.printer))}${row('Default at till', 'What the till selects first', seg('receipt', [['none', 'None'], ['viber', 'Viber'], ['pdf', 'PDF']], s.receipt))}</div>
  <div class="card"><div class="ch"><h3>${t('Credit & quotations')}</h3></div>${row('Credit customers', 'Sell now, pay later', tog('credit', s.credit))}${row('Limit for customers added at the till', 'Owner can raise it after checking', seg('tillLimit', [[300, '300'], [500, '500'], [1000, '1,000']], s.tillLimit))}${row('Quotations & invoices', 'For government and companies', tog('quotes', s.quotes))}</div>
  <div class="card"><div class="ch"><h3>${t('Tolerances')}</h3></div>${row('Cash difference', 'Above this, a note is required', seg('cashTol', [[50, '50'], [100, '100'], [200, '200']], s.cashTol))}${row('Tank variance alert', 'Dip vs book stock', seg('varTol', [[0.5, '0.5%'], [1, '1%'], [2, '2%']], s.varTol))}</div>
  <div class="card"><div class="ch"><h3>${t('Language & tax')}</h3></div>${row('Language', 'English or Dhivehi', seg('lang', [['en', 'English'], ['dv', 'ދިވެހި']], S.lang))}${row('GST', 'To be decided later', `<span class="mut">${t('Later')}</span>`)}</div>
  </div>`;
};

// ---------- modals
const M = {};
const field = (id, label, val = '', extra = '') => `<label class="fl"><span>${t(label)}</span><input class="inp wide" id="${id}" value="${esc(val)}" ${extra}></label>`;
const sel = (id, label, opts, val) => `<label class="fl"><span>${t(label)}</span><select class="inp wide" id="${id}">${opts.map(([v, n]) => `<option value="${v}"${String(v) === String(val) ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`;
const mfoot = (act, label, extra = '') => `<div class="mf"><a class="bt" data-a="close">${t('Cancel')}</a>${extra}<a class="bt pr" data-a="${act}">${t(label)}</a></div>`;
M.newcust = (m) => `<h2>${t(m.owner ? 'New credit account' : 'New customer')}</h2><p class="mut">${t(m.owner ? 'A regular customer who pays later.' : 'For someone who takes fuel now and pays later. Saved to Credit accounts.')}</p>
  ${field('nc_name', 'Name *')}<div class="g2">${field('nc_phone', 'Phone (Viber) *')}${field('nc_veh', 'Boat / vehicle')}</div>${sel('nc_type', 'Type', [['person', t('Person')], ['company', t('Company')], ['government', t('Government')]], 'person')}
  ${m.owner ? `<div class="g2">${field('nc_limit', 'Limit (MVR)', '10000')}${field('nc_terms', 'Pay within (days)', '15')}</div>` : `<div class="note">${tf('Limit for customers added at the till: {a}. The owner can raise it later.', { a: money(S.set.tillLimit) })}</div>`}
  ${mfoot('saveCust', m.owner ? 'Save account' : 'Save and sell on credit')}`;
M.pickcust = () => `<h2>${t('Credit customer')}</h2><input class="inp wide" id="cs" data-live="cs" placeholder="${t('Search name, boat, phone')}" value="${esc(S.form.cs || '')}">
  <div class="plist">${S.customers.filter((c) => !S.form.cs || (c.name + c.vehicle + c.phone).toLowerCase().includes(S.form.cs.toLowerCase())).map((c) => { const q = S.quotes.find((x) => x.cust === c.id && x.status === 'approved'); return `<a class="prow" data-a="setCust" data-id="${c.id}"><div><b class="w5"><bdi>${esc(c.name)}</bdi></b><div class="mut sm">${esc(t(c.vehicle))}${q ? ' · ' + q.id : ''}</div></div><div class="n" style="text-align:end"><div>${money(balance(c))}</div><div class="mut sm">${t('limit')} ${num(c.limit, 0)}</div></div></a>`; }).join('')}</div>${mfoot('close', 'Close')}`;
M.item = () => `<h2>${t('Add shop item')}</h2><div class="plist">${S.items.map((i) => `<a class="prow" data-a="addItem" data-id="${i.id}"><div><b class="w5">${esc(t(i.name))}</b><div class="mut sm">${tf('{n} in stock', { n: i.stock })}</div></div><b class="n">${num(i.price)}</b></a>`).join('')}</div>${mfoot('close', 'Done')}`;
M.expense = () => `<h2>${t('New expense')}</h2>${field('ex_desc', 'What for *')}<div class="g2">${field('ex_amt', 'Amount (MVR) *')}${sel('ex_cat', 'Category', ['Petty cash', 'Maintenance', 'Utilities', 'Salaries', 'Rent & licences', 'Bank charges', 'Other'].map((c) => [c, t(c)]), 'Petty cash')}</div>
  ${sel('ex_from', 'Paid from', [['till', t('Cash from till')], ['bank', t('Bank transfer')]], 'till')}<div class="note">${t('Cash from the till is taken off the cash expected at shift close. A bill photo can be added.')}</div>${mfoot('saveExp', 'Save expense')}`;
M.dip = () => `<h2>${t('Record dip')}</h2><p class="mut">${t('Put the dip stick in the tank and read the centimetres. The app turns it into litres with the tank chart.')}</p>${sel('dp_tank', 'Tank', S.tanks.map((tk) => [tk.id, tk.id + ' · ' + t(cap(tk.fuel))]), 'T2')}
  ${field('dp_cm', 'Dip (cm)', '', 'data-live="dp_cm"')}<div class="note" id="dpprev">${dipPreview()}</div>${mfoot('saveDip', 'Save dip')}`;
function dipPreview() { const tk = S.tanks.find((x) => x.id === (S.form.dp_tank || 'T2')) || S.tanks[1]; const cm = parseFloat(S.form.dp_cm); if (!cm) return t('Enter the reading to see litres.'); const l = Math.round(vFrac(cm / tk.dia) * tk.cap); const v = l - Math.round(tk.level); return tf('{cm} cm = {l} · book stock {b} · variance {v}', { cm: num(cm, 1), l: L(l), b: L(tk.level), v: L(v) }); }
M.delivery = () => S.set.stock === 'drums' ? `<h2>${t('Drums delivered')}</h2>${field('dl_n', 'Full drums received', '10')}${field('dl_price', 'Price per litre (MVR)', '15.80')}${mfoot('saveDrumDel', 'Save')}` :
  `<h2>${t('New delivery')}</h2>${sel('dl_tank', 'Tank', S.tanks.map((tk) => [tk.id, tk.id + ' · ' + t(cap(tk.fuel)) + ' · ' + t('space for') + ' ' + fmtN(tk.cap - tk.level, 0) + ' ' + t('L')]), 'T2')}${field('dl_sup', 'Supplier', t('Sample Fuel Supplier'))}
  <div class="g2">${field('dl_inv', 'Litres on invoice', '15000')}${field('dl_rec', 'Litres received (dip before and after)', '14940')}</div>${field('dl_price', 'Price per litre (MVR)', '15.72')}<div class="note">${t('After saving, the tank fills on the Tanks screen.')}</div>${mfoot('saveDel', 'Save delivery')}`;
M.drums = () => `<h2>${t('Count drums')}</h2><div class="g2">${field('dr_full', 'Full drums', S.drums.full)}${field('dr_open', 'Litres in open drum (about)', Math.round(S.drums.open))}</div>${mfoot('saveDrums', 'Save count')}`;
M.payment = (m) => { const c = m.id || (S.customers.find((x) => balance(x) > 0) || {}).id; const inv = S.invoices.filter((i) => i.cust === c && i.amount > i.paid);
  return `<h2>${t('Payment received')}</h2>${sel('py_cust', 'Customer', S.customers.filter((x) => balance(x) > 0 || x.id === c).map((x) => [x.id, esc(x.name) + ' · ' + fmtN(balance(x))]), c)}
  ${sel('py_inv', 'For', [['', t('Account (oldest first)')], ...inv.map((i) => [i.id, i.id + ' · ' + fmtN(i.amount - i.paid)])], m.inv || '')}
  <div class="g2">${field('py_amt', 'Amount (MVR) *', m.inv ? fmtN(S.invoices.find((i) => i.id === m.inv).amount - S.invoices.find((i) => i.id === m.inv).paid).replace(/,/g, '') : '')}${sel('py_how', 'Paid by', [['bank', t('Bank transfer')], ['cash', t('Cash')], ['cheque', t('Cheque')]], 'bank')}</div><div class="note">${t('Attach the transfer slip (optional).')}</div>${mfoot('savePay', 'Save payment')}`; };
M.quote = () => `<h2>${t('New quotation')}</h2>${sel('qt_cust', 'Customer', S.customers.filter((c) => c.type !== 'person').map((c) => [c.id, esc(c.name)]), 'c2')}
  <div class="g2">${sel('qt_fuel', 'Fuel', [['diesel', t('Diesel')], ['petrol', t('Petrol')]], 'diesel')}${field('qt_l', 'Litres', '1000')}</div><div class="g2">${field('qt_price', 'Price per litre', S.prices.diesel)}${field('qt_del', 'Deliveries included', '2')}</div>${field('qt_valid', 'Valid until', '2026-11-30')}${mfoot('saveQuote', 'Save and send')}`;
M.po = (m) => `<h2>${t('Quotation approved')}</h2><p class="mut">${tf('Enter the approval number the office gave for {id}.', { id: m.id })}</p>${field('po_no', 'PO / approval number', 'PO 1')}${mfoot('savePO', 'Approve')}`;
M.customer = (m) => { const c = cust(m.id); const sales = S.sales.filter((x) => x.cust === c.id);
  return `<h2><bdi>${esc(c.name)}</bdi></h2><p class="mut">${t(cap(c.type))} · <bdi>${esc(c.phone)}</bdi> · ${esc(t(c.vehicle))}</p>
  <div class="g2">${field('cu_limit', 'Limit (MVR)', c.limit)}${field('cu_terms', 'Pay within (days)', c.terms)}</div>
  <table class="t n"><tr><th>${t('Date')}</th><th>${t('Details')}</th><th class="r">${t('MVR')}</th></tr>${c.opening ? `<tr><td class="m">${dShort(c.openingDate)}</td><td>${t('Balance brought forward')}</td><td class="r">${num(c.opening)}</td></tr>` : ''}
  ${S.invoices.filter((i) => i.cust === c.id).map((i) => `<tr><td class="m">${dShort(i.date)}</td><td>${i.id}${i.paid ? ' · ' + t('paid') + ' ' + num(i.paid) : ''}</td><td class="r">${num(i.amount)}</td></tr>`).join('')}
  ${sales.map((x) => `<tr><td class="m">${dShort(x.date)} <bdi>${x.time}</bdi></td><td>${x.id} · ${t(cap(x.fuel))} ${num(x.litres)} ${t('L')}${x.delivery ? ' + ' + t('delivery') : ''}${x.invoice ? ' · ' + x.invoice : ''} · ${t(x.pay === 'credit' ? 'On credit' : 'Paid')}</td><td class="r">${num(x.total)}</td></tr>`).join('')}
  ${c.paid ? `<tr><td></td><td>${t('Payments on account')}</td><td class="r">${num(-c.paid)}</td></tr>` : ''}<tr class="hl2"><td></td><td>${t('Owes now')}</td><td class="r">${num(balance(c))}</td></tr></table>
  ${mfoot('saveCustEdit', 'Save', `<a class="bt" data-a="toast" data-v="Statement">${t('Send statement (Viber)')}</a>`)}`; };
M.doc = (m) => {
  const q = S.quotes.find((x) => x.id === m.id), inv = S.invoices.find((x) => x.id === m.id);
  const c = cust((q || inv).cust);
  let lines = '', total = 0;
  if (q) { lines = `<tr><td>${t(cap(q.fuel))}</td><td class="r">${num(q.litres)} ${t('L')}</td><td class="r">${num(q.price)}</td><td class="r">${num(q.litres * q.price)}</td></tr>${q.delMax ? `<tr><td>${t('Delivery')}</td><td class="r">${q.delMax} ×</td><td class="r">${num(S.set.delivery.amount)}</td><td class="r">${num(q.delMax * S.set.delivery.amount)}</td></tr>` : ''}`; total = q.litres * q.price + q.delMax * S.set.delivery.amount; }
  else { const ss = S.sales.filter((x) => x.invoice === inv.id); if (ss.length) { ss.forEach((x) => { lines += `<tr><td>${dShort(x.date)} · ${x.id} · ${t(cap(x.fuel))}${x.delivery ? ' + ' + t('delivery') : ''}</td><td class="r">${num(x.litres)} ${t('L')}</td><td class="r">${num(x.price)}</td><td class="r">${num(x.total)}</td></tr>`; }); } else lines = `<tr><td>${t('Fuel supplied (earlier sales)')}</td><td></td><td></td><td class="r">${num(inv.amount)}</td></tr>`; total = inv.amount; }
  return `<div class="doc"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><img src="${LOGO_DARK}" style="height:26px"><div class="mut sm" style="margin-top:6px">${t('Sample Harbour Fuel')}<br>${t('Sample address, Maldives')}</div></div><div style="text-align:end"><h2 style="margin:0">${t(q ? 'QUOTATION' : 'INVOICE')}</h2><div class="n">${(q || inv).id}</div><div class="mut sm">${dShort(q ? q.date : inv.date)}</div></div></div>
  <div style="margin:18px 0"><div class="mut sm">${t('To')}</div><b><bdi>${esc(c.name)}</bdi></b>${q && q.po ? `<div class="mut sm">${esc(q.po)}</div>` : ''}${inv ? `<div class="mut sm">${t('Due')} ${dShort(inv.due)}${inv.quote ? ' · ' + inv.quote : ''}</div>` : ''}</div>
  <table class="t n"><tr><th>${t('Details')}</th><th class="r">${t('Qty')}</th><th class="r">${t('Price')}</th><th class="r">${t('MVR')}</th></tr>${lines}<tr class="hl2"><td>${t('Total')}</td><td></td><td></td><td class="r">${num(total)}</td></tr></table>
  ${q ? `<p class="mut sm" style="margin-top:12px">${tf('Valid until {d}. Price per litre fixed for this quotation.', { d: dShort(q.valid) })}</p>` : `<p class="mut sm" style="margin-top:12px">${t('Pay by bank transfer and send the slip.')}</p>`}<div class="sample-in">${t('SAMPLE DATA')}</div></div>
  <div class="mf"><a class="bt" data-a="close">${t('Close')}</a><a class="bt" data-a="toast" data-v="PDF">${t('Download PDF')}</a><a class="bt pr" data-a="toast" data-v="Viber">${t('Send by Viber')}</a></div>`;
};
M.receipt = (m) => { const x = S.sales.find((s) => s.id === m.id);
  return `<div class="doc rc"><div style="text-align:center"><img src="${LOGO_DARK}" style="height:22px"><div class="mut sm">${t('Sample Harbour Fuel')}</div></div><div class="row n" style="justify-content:space-between;margin-top:10px"><span>${x.id}</span><span>${dShort(x.date)} <bdi>${x.time}</bdi></span></div>
  <div class="line"><div>${t(cap(x.fuel))} · ${x.pump}<div class="mut sm">${num(x.litres)} ${t('L')} × ${num(x.price)}</div></div><b>${num(x.amount)}</b></div>${x.items.map((i) => `<div class="line"><div>${esc(t(i.name))} × ${i.qty}</div><b>${num(i.price * i.qty)}</b></div>`).join('')}${x.delivery ? `<div class="line"><div>${t('Delivery')}</div><b>${num(x.delivery)}</b></div>` : ''}
  <div class="line" style="font-size:16px"><b>${t('Total MVR')}</b><b>${num(x.total)}</b></div><div class="row" style="justify-content:space-between"><span>${custName(x.cust)}</span>${payPill(x.pay)}</div><div class="sample-in">${t('SAMPLE DATA')}</div></div>
  <div class="mf"><a class="bt pr" data-a="close">${t({ viber: 'Sent by Viber', pdf: 'PDF ready', print: 'Printed' }[m.how] || 'Done')} ✓</a></div>`; };

// ---------- actions
const A = {};
const v = (id) => ($('#' + id)?.value ?? '').trim();
const fv = (id) => parseFloat(v(id).replace(/,/g, '')) || 0;
let toastT;
function toast(msg) { const el = $('#toast'); el.innerHTML = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
A.go = (d) => { S.resetArm = false; S.route = d.r; S.form = {}; if (d.r === 'till' && !S.till) tillReset(); render(); window.scrollTo(0, 0); };
A.lang = () => { S.lang = S.lang === 'en' ? 'dv' : 'en'; render(); };
A.role = () => { const r = ['owner', 'manager', 'attendant', 'accountant']; S.role = r[(r.indexOf(S.role) + 1) % 4]; S.route = S.role === 'attendant' ? 'till' : S.role === 'accountant' ? 'unpaid' : 'overview'; if (S.route === 'till') tillReset(); render(); toast(tf('Now viewing as {r}', { r: t(cap(S.role)) })); };
A.tab = (d) => { S.tab[d.k] = d.v; render(); };
A.modal = (d) => { S.modal = { type: d.m, id: d.id, inv: d.inv, owner: d.owner }; S.form = {}; render(); setTimeout(() => $('.modal input')?.focus(), 30); };
A.close = () => { S.modal = null; render(); };
A.toast = (d) => toast(tf('Demo: {x} would be made here', { x: t(d.v) }));
A.pump = (d) => { S.till.pump = d.id; S.till.quote = S.till.quote && S.quotes.find((q) => q.id === S.till.quote)?.fuel === S.pumps.find((p) => p.id === d.id).fuel ? S.till.quote : ''; if (S.till.cust !== 'walkin') autoQuote(); render(); };
A.tmode = (d) => { S.till.mode = d.v; S.till.input = ''; render(); };
A.key = (d) => { const T = S.till; if (d.v === '⌫') T.input = T.input.slice(0, -1); else if (d.v === '.' && T.input.includes('.')) return; else if (T.input.length < 8) T.input += d.v; render(); };
A.quick = (d) => { S.till.input = d.v; render(); };
A.clearTill = () => { tillReset(); render(); };
A.walkin = () => { S.till.cust = 'walkin'; S.till.pay = 'cash'; S.till.quote = ''; render(); };
A.pickCust = () => A.modal({ m: 'pickcust' });
function autoQuote() { const T = S.till, p = S.pumps.find((x) => x.id === T.pump); const q = S.quotes.find((x) => x.cust === T.cust && x.status === 'approved' && x.fuel === p.fuel && quoteUsed(x) < x.litres); T.quote = q ? q.id : ''; }
A.setCust = (d) => { S.till.cust = d.id; S.till.pay = 'credit'; S.till.ok = false; autoQuote(); S.modal = null; render(); };
A.pay = (d) => { S.till.pay = d.v; render(); };
A.rcpt = (d) => { S.till.receipt = d.v; render(); };
A.addDel = () => { const c = tillCalc(); S.till.delivery = S.set.delivery.type === 'fixed' ? S.set.delivery.amount : r2(S.set.delivery.amount * c.litres); render(); };
A.rmDel = () => { S.till.delivery = null; render(); };
A.addItem = (d) => { const i = S.items.find((x) => x.id === d.id); const e = S.till.items.find((x) => x.id === i.id); if (e) e.qty++; else S.till.items.push({ id: i.id, name: i.name, price: i.price, cost: i.cost, qty: 1 }); render(); toast(tf('{n} added', { n: esc(t(i.name)) })); };
A.rmItem = (d) => { S.till.items.splice(+d.k, 1); render(); };
A.ownerOk = () => { S.till.ok = true; render(); };
A.sell = () => {
  const T = S.till, c = tillCalc(), cu = T.cust !== 'walkin' ? cust(T.cust) : null;
  if (c.litres <= 0 && !T.items.length) return toast(t('Enter litres or an amount first'));
  if (T.pay === 'credit' && !cu) return toast(t('Choose a credit customer first'));
  if (T.pay === 'credit' && balance(cu) + c.total > cu.limit && !T.ok) return toast(t('Over the limit · the owner must approve'));
  if (S.set.stock === 'drums' && c.p.fuel === 'petrol' && c.litres > S.drums.open + S.drums.full * S.drums.size) return toast(t('Not enough fuel in the drums'));
  const sh = openShift();
  const sale = { id: 'R-' + (++S.seq.sale), date: TODAY, time: nowTime(), pump: c.p.id, fuel: c.p.fuel, litres: c.litres, price: c.price, amount: c.amount, delivery: c.del, items: T.items.map((i) => ({ ...i })), total: c.total, cust: T.cust, pay: T.pay, quote: c.q ? c.q.id : '', shift: sh ? sh.id : '', staff: sh ? sh.staff : 'Ahmed', invoice: '' };
  S.sales.push(sale);
  c.p.meter = r2(c.p.meter + c.litres);
  if (S.set.stock === 'drums') { let need = c.litres; while (need > 0) { const take = Math.min(need, S.drums.open); S.drums.open = r2(S.drums.open - take); need = r2(need - take); if (need > 0 && S.drums.full > 0) { S.drums.full--; S.drums.open = S.drums.size; } else break; } }
  else S.tanks.find((x) => x.id === c.p.tank).level = r2(S.tanks.find((x) => x.id === c.p.tank).level - c.litres);
  T.items.forEach((i) => { const it = S.items.find((x) => x.id === i.id); it.stock -= i.qty; });
  const how = T.receipt;
  tillReset();
  if (how !== 'none') { S.modal = { type: 'receipt', id: sale.id, how }; }
  render();
  if (how === 'none') toast(tf('Sale {id} saved · {a}', { id: sale.id, a: money(sale.total) }) + (sale.pay === 'credit' ? ' · ' + t('goes to Unpaid') : ''));
};
A.saveCust = () => {
  const m = S.modal; const name = v('nc_name'), phone = v('nc_phone');
  if (!name || !phone) return toast(t('Name and phone are needed'));
  const c = { id: 'c' + (++S.seq.cust), name, phone, vehicle: v('nc_veh') || '—', type: v('nc_type'), limit: m.owner ? fv('nc_limit') : S.set.tillLimit, terms: m.owner ? fv('nc_terms') || 15 : 7, opening: 0, openingDate: TODAY, paid: 0, approved: !!m.owner, addedBy: m.owner ? '' : (openShift()?.staff || 'Ahmed') };
  S.customers.push(c); S.modal = null;
  if (!m.owner) { S.till.cust = c.id; S.till.pay = 'credit'; S.till.quote = ''; }
  render(); toast(tf('{n} saved', { n: esc(name) }));
};
A.approve = (d) => { cust(d.id).approved = true; render(); toast(t('Customer approved')); };
A.saveCustEdit = () => { const c = cust(S.modal.id); c.limit = fv('cu_limit') || c.limit; c.terms = fv('cu_terms') || c.terms; S.modal = null; render(); toast(t('Saved')); };
A.saveExp = () => { const desc = v('ex_desc'), amt = fv('ex_amt'); if (!desc || !amt) return toast(t('Write what for and the amount'));
  const sh = openShift(); const from = v('ex_from');
  S.expenses.push({ id: 'e' + (++S.seq.exp), date: TODAY, desc, cat: v('ex_cat'), from, amount: amt, staff: sh ? sh.staff : 'Ahmed', shift: from === 'till' && sh ? sh.id : '' });
  S.modal = null; render(); toast(tf('Expense saved · {a}', { a: money(amt) })); };
A.saveDip = () => { const tk = S.tanks.find((x) => x.id === v('dp_tank')); const cm = fv('dp_cm'); if (!cm) return toast(t('Enter the dip in cm'));
  const l = Math.round(vFrac(cm / tk.dia) * tk.cap); tk.dip = { time: nowTime(), cm, measured: l, book: Math.round(tk.level) }; S.modal = null; S.route = 'tanks'; render(); toast(tf('Dip saved · {t}: {l}', { t: tk.id, l: L(l) })); };
A.saveDel = () => { const tk = S.tanks.find((x) => x.id === v('dl_tank')); const inv = fv('dl_inv'), rec = fv('dl_rec'), price = fv('dl_price');
  if (!rec || !price) return toast(t('Enter litres and price'));
  if (tk.level + rec > tk.cap) return toast(t('Not enough space in this tank'));
  const old = tk.level; S.cost[tk.fuel] = r2((old * S.cost[tk.fuel] + rec * price) / (old + rec));
  S.deliveries.push({ id: 'd' + (++S.seq.del), date: TODAY, fuel: tk.fuel, tank: tk.id, supplier: v('dl_sup'), invoiced: inv || rec, received: rec, price });
  tk.level = r2(old + rec); S.anim[tk.id] = { from: old, to: tk.level, start: performance.now() + 400 };
  S.modal = null; S.route = 'tanks'; render(); };
A.saveDrumDel = () => { const n = Math.round(fv('dl_n')), price = fv('dl_price'); if (!n) return; S.deliveries.push({ id: 'd' + (++S.seq.del), date: TODAY, fuel: 'petrol', tank: '', supplier: 'Sample Fuel Supplier', invoiced: n * S.drums.size, received: n * S.drums.size, price }); S.drums.full += n; S.modal = null; render(); toast(tf('{n} drums added', { n })); };
A.saveDrums = () => { S.drums.full = Math.max(0, Math.round(fv('dr_full'))); S.drums.open = Math.max(0, Math.min(S.drums.size, fv('dr_open'))); S.drums.counted = nowTime(); S.modal = null; render(); toast(t('Drum count saved')); };
A.savePay = () => { const c = cust(v('py_cust')), amt = fv('py_amt'), invId = v('py_inv'); if (!c || !amt) return toast(t('Choose the customer and amount'));
  let left = amt;
  if (invId) { const i = S.invoices.find((x) => x.id === invId); const p = Math.min(left, i.amount - i.paid); i.paid = r2(i.paid + p); left = r2(left - p); }
  if (left > 0) { // oldest first: account balance, then invoices
    const acc = r2(c.opening + S.sales.filter((x) => x.cust === c.id && x.pay === 'credit' && !x.invoice).reduce((a, x) => a + x.total, 0) - c.paid);
    const p = Math.min(left, Math.max(0, acc)); c.paid = r2(c.paid + p); left = r2(left - p);
    for (const i of S.invoices.filter((x) => x.cust === c.id && x.amount > x.paid).sort((a, b) => a.date.localeCompare(b.date))) { if (left <= 0) break; const q = Math.min(left, i.amount - i.paid); i.paid = r2(i.paid + q); left = r2(left - q); }
    if (left > 0) c.paid = r2(c.paid + left);
  }
  S.payments.push({ id: 'p' + (++S.seq.pay), cust: c.id, amount: amt, inv: invId, how: v('py_how'), date: TODAY });
  S.modal = null; render(); toast(tf('Payment saved · {a} from {n}', { a: money(amt), n: esc(c.name) })); };
A.remind = () => { const n = S.customers.filter((c) => balance(c) > 0 && lateDays(c) > 0).length; toast(tf('Demo: {n} reminders would be sent by Viber', { n })); };
A.saveQuote = () => { const l = fv('qt_l'), price = fv('qt_price'); if (!l || !price) return toast(t('Enter litres and price'));
  const id = 'Q-2026-' + String(++S.seq.q).padStart(3, '0');
  S.quotes.push({ id, cust: v('qt_cust'), fuel: v('qt_fuel'), litres: l, price, delMax: Math.round(fv('qt_del')), valid: v('qt_valid') || '2026-11-30', status: 'sent', po: '', usedBefore: 0, date: TODAY });
  S.modal = null; S.tab.q = 'quotes'; render(); toast(tf('{id} made and sent', { id })); };
A.qsend = (d) => { S.quotes.find((q) => q.id === d.id).status = 'sent'; render(); toast(tf('{id} sent', { id: d.id })); };
A.savePO = () => { const q = S.quotes.find((x) => x.id === S.modal.id); q.po = v('po_no') || 'PO'; q.status = 'approved'; S.modal = null; render(); toast(tf('{id} approved · now sell against it at the till', { id: q.id })); };
A.mkinv = (d) => { const q = S.quotes.find((x) => x.id === d.id); const ss = S.sales.filter((x) => x.quote === q.id && !x.invoice); if (!ss.length) return;
  const id = 'INV-2026-' + String(++S.seq.inv).padStart(3, '0'); const amount = r2(ss.reduce((a, x) => a + x.total, 0));
  ss.forEach((x) => (x.invoice = id)); const c = cust(q.cust);
  S.invoices.push({ id, cust: q.cust, quote: q.id, amount, paid: 0, date: TODAY, due: addDays(TODAY, c.terms) });
  if (quoteUsed(q) >= q.litres) q.status = 'invoiced';
  S.tab.q = 'inv'; S.modal = { type: 'doc', id }; render(); toast(tf('{id} made · now in Unpaid', { id })); };
A.savePrices = () => { const p = fv('pr_petrol'), d = fv('pr_diesel'); if (!p || !d) return; S.prices = { petrol: p, diesel: d }; S.priceLog.push({ date: TODAY, petrol: p, diesel: d, note: 'Price change' }); S.form = {}; render(); toast(t('New prices saved · the till uses them now')); };
A.closeShift = () => {
  const sh = openShift(); if (!sh) return; const n = shiftNums(sh), F = S.form;
  if (F.counted == null || F.counted === '') return toast(t('Count the cash first'));
  const diff = r2((parseFloat(F.counted) || 0) - n.expected);
  if (Math.abs(diff) > S.set.cashTol && !(F.note || '').trim()) return toast(t('Write a note for the difference'));
  pumpsActive().forEach((p) => { if (F['m_' + p.id] != null) p.meter = parseFloat(F['m_' + p.id]) || p.meter; });
  Object.assign(sh, { status: 'closed', end: nowTime(), total: n.total, diff, note: F.note || '' });
  const next = { id: 'S-1028-3', staff: 'Rahim', start: '28 Oct ' + nowTime(), end: '', status: 'open', openMeters: Object.fromEntries(S.pumps.map((p) => [p.id, p.meter])), total: 0, diff: 0, note: '' };
  if (S.set.mode !== 'one' && !S.shifts.some((x) => x.id === next.id)) S.shifts.push(next);
  S.form = {}; S.route = S.set.mode === 'one' ? 'overview' : 'shifts'; render();
  toast(tf('{id} closed · difference {d}', { id: sh.id, d: money(diff) }) + (S.set.mode === 'one' ? ' · ' + t('day summary would go to the owner on Viber') : ''));
};
A.openShift = () => { const id = 'S-1028-' + (S.shifts.filter((x) => x.id.startsWith('S-1028')).length + 1); S.shifts.push({ id, staff: 'Ahmed', start: '28 Oct ' + nowTime(), end: '', status: 'open', openMeters: Object.fromEntries(S.pumps.map((p) => [p.id, p.meter])), total: 0, diff: 0, note: '' }); render(); toast(tf('{id} opened', { id })); };
A.setv = (d) => {
  const k = d.k, val = d.v;
  if (k === 'lang') S.lang = val;
  else if (k.startsWith('delivery.')) S.set.delivery[k.split('.')[1]] = k === 'delivery.on' ? val === '1' : val;
  else if (['credit', 'quotes'].includes(k)) S.set[k] = val === '1';
  else if (['nozzles', 'tillLimit', 'cashTol', 'varTol'].includes(k)) S.set[k] = parseFloat(val);
  else S.set[k] = val;
  if (k === 'mode' && val === 'one') { S.set.nozzles = 1; }
  if (k === 'mode' && val === 'shifts') { S.set.nozzles = 4; S.set.stock = 'tanks'; }
  if (k === 'stock' && val === 'drums') S.set.nozzles = 1;
  if (k === 'mode' && val === 'one' && !openShift()) A.openShift();
  tillReset(); render();
};
A.reset = () => { if (!S.resetArm) { S.resetArm = true; render(); return; } const lang = S.lang; S = seed(); S.lang = lang; S.route = 'settings'; render(); toast(t('Sample data reset')); };

// ---------- render
function render() {
  const app = $('#app');
  document.documentElement.dir = S.lang === 'dv' ? 'rtl' : 'ltr';
  document.documentElement.lang = S.lang;
  const focus = document.activeElement && document.activeElement.id, caret = document.activeElement?.selectionStart;
  let html;
  if (S.route === 'till') html = P.till();
  else {
    const titles = { overview: S.set.mode === 'one' ? 'Today' : 'Overview', shifts: 'Shifts', closeShift: S.set.mode === 'one' ? 'Close the day' : 'Close shift', tanks: S.set.stock === 'drums' ? 'Drums & stock' : 'Tanks & dips', deliveries: 'Deliveries', expenses: 'Expenses', credit: 'Credit accounts', unpaid: 'Unpaid', quotes: 'Quotations & invoices', prices: 'Price lists', items: 'Shop items', reports: 'Reports', settings: 'Settings' };
    if (!P[S.route]) S.route = 'overview';
    html = `<div class="app">${sidebar()}${topbar(t(titles[S.route]))}<div class="ct">${P[S.route]()}</div><span class="sample">${t('SAMPLE DATA')}</span></div>`;
  }
  if (S.modal) html += `<div class="mback" data-a="close"></div><div class="modal">${M[S.modal.type](S.modal)}</div>`;
  app.innerHTML = html;
  if (focus) { const el = document.getElementById(focus); if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) {} } }
  if (S.route === 'tanks') animate();
  save();
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]'); if (!a || !a.dataset.a) return;
  if (a.classList.contains('mback') && e.target !== a) return;
  e.preventDefault(); const f = A[a.dataset.a]; if (f) f(a.dataset, a);
});
document.addEventListener('input', (e) => {
  const el = e.target; const k = el.dataset.live;
  if (k === 'tdel') { S.till.delivery = parseFloat(el.value) || 0; render(); return; }
  if (k === 'delamt') { S.set.delivery.amount = parseFloat(el.value) || 0; save(); return; }
  if (k) { S.form[k] = el.value; if (k === 'dp_cm') { S.form.dp_tank = $('#dp_tank').value; const p = $('#dpprev'); if (p) p.innerHTML = dipPreview(); return; } render(); }
});
document.addEventListener('change', (e) => { if (e.target.id === 'dp_tank') { S.form.dp_tank = e.target.value; const p = $('#dpprev'); if (p) p.innerHTML = dipPreview(); } if (e.target.id === 'py_cust') { S.modal.id = e.target.value; S.modal.inv = ''; render(); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.modal) A.close(); });

// ================= Test guide + notes (for the owner while checking the demo; not part of the product) =================
const TASKS = [
  ['Start', [
    ['ov', 'Look at Overview', 'Is this what you want to see first in the morning? What is missing or not needed?', () => A.go({ r: 'overview' })],
  ]],
  ['Selling', [
    ['s1', 'Walk-in sale, cash', 'Point of sale → pick P2 → tap 20 L → Complete sale. Is it fast enough for a busy jetty?', () => A.go({ r: 'till' })],
    ['s2', 'Sale by amount', 'Tap “Amount”, type 500 → Complete sale. Do customers ask like this?', () => A.go({ r: 'till' })],
    ['s3', 'Credit customer with quotation price', 'Credit customer… → Sample Island Council. The price changes to the quotation price. Add the delivery charge. Complete sale.', () => A.go({ r: 'till' })],
    ['s4', 'New customer at the till', '+ New customer → name and phone → Save and sell on credit. Is this how staff would do it?', () => A.go({ r: 'till' })],
    ['s5', 'Over the credit limit', 'Credit customer… → Hussain (limit 5,000) → 300 L → On credit. The till stops it until the owner approves. Right rule?', () => A.go({ r: 'till' })],
    ['s6', 'Shop item with fuel', 'Add shop item → engine oil, on the same bill as fuel.', () => A.go({ r: 'till' })],
    ['s7', 'Receipt by Viber or PDF', 'Choose Viber or PDF before Complete sale and look at the receipt.', () => A.go({ r: 'till' })],
    ['s8', 'Petty cash from the till', 'Expense (top of the till) → e.g. MVR 200 for workers, from till cash.', () => A.go({ r: 'till' })],
  ]],
  ['Closing', [
    ['c1', 'Close shift', 'Shifts → Close shift → type the cash counted. Type a wrong amount: a note is needed above MVR 100.', () => A.go({ r: 'closeShift' })],
    ['c2', 'Small shed: close the day', 'Settings → One person + Drums. Then Today → Close the day. Simple enough for one person?', () => A.go({ r: 'settings' })],
  ]],
  ['Fuel stock', [
    ['t1', 'Record a dip', 'Tanks & dips → Record dip → T2 → e.g. 47 cm. See litres and the variance.', () => A.go({ r: 'tanks' })],
    ['t2', 'New delivery', 'New delivery → T2 → save. Watch the tank fill. Is received vs invoiced how you check the barge?', () => A.go({ r: 'deliveries' })],
    ['t3', 'Drums (ފީފާ)', 'Settings → Stock: Drums. Look at Drums & stock, sell some petrol and see the open drum go down.', () => A.go({ r: 'settings' })],
  ]],
  ['Money owed', [
    ['u1', 'Unpaid and payment received', 'Unpaid → approve the till-added customer → Paid on a customer → save. Does the balance make sense?', () => A.go({ r: 'unpaid' })],
    ['u2', 'Customer statement and limit', 'Credit accounts → click a customer → change the limit.', () => A.go({ r: 'credit' })],
    ['q1', 'Quotation to payment', 'New quotation → Approve (PO) → sell against it at the till → Make invoice → Invoices → Mark paid.', () => A.go({ r: 'quotes' })],
  ]],
  ['Owner', [
    ['o1', 'Change the fuel price', 'Price lists → new price → Save. The till uses it at once.', () => A.go({ r: 'prices' })],
    ['o2', 'Reports', 'Reports → Daily sales, Profit, Who owes, Tank variance. Which report do you need that is not here?', () => A.go({ r: 'reports' })],
    ['o3', 'Settings', 'Turn delivery charge, printer, credit, quotations on and off. Anything else a shed needs to set?', () => A.go({ r: 'settings' })],
    ['o4', 'What each person sees', 'Click the name at the bottom of the sidebar: Owner → Manager → Attendant → Accountant.', () => A.go({ r: 'overview' })],
    ['o5', 'Dhivehi', 'Switch to ދިވެހި and read every screen. Mark any word that is wrong.', () => A.lang()],
  ]],
];
const G = { open: false, tab: 'tasks', checks: {}, notes: [], db: null, store: 'local' };
const GKEY = 'theyo-guide-v1';
function gLoadLocal() { try { const x = JSON.parse(localStorage.getItem(GKEY)); if (x) { G.checks = x.checks || {}; G.notes = x.notes || []; } } catch (e) {} }
function gSaveLocal() { try { localStorage.setItem(GKEY, JSON.stringify({ checks: G.checks, notes: G.notes })); } catch (e) {} }
const ROUTE_NAMES = { overview: 'Overview', till: 'Point of sale', shifts: 'Shifts', closeShift: 'Close shift', tanks: 'Tanks & dips', deliveries: 'Deliveries', expenses: 'Expenses', credit: 'Credit accounts', unpaid: 'Unpaid', quotes: 'Quotations & invoices', prices: 'Price lists', items: 'Shop items', reports: 'Reports', settings: 'Settings' };
const totalTasks = TASKS.reduce((a, g) => a + g[1].length, 0);
function renderGuide() {
  const el = document.getElementById('guide');
  const ae = document.activeElement;
  if (ae && el.contains(ae) && ae.tagName === 'TEXTAREA') { G.dirty = true; return; }
  const done = Object.values(G.checks).filter((c) => c.rating).length;
  const fab = `<a class="gfab" data-g="toggle">${G.open ? 'Close test guide' : `Test guide · ${done}/${totalTasks}`}</a><a class="gfab gnote" data-g="note">+ Note on this screen</a>`;
  if (!G.open) { el.innerHTML = `<div class="gbar">${fab}</div>`; return; }
  const kinds = { change: ['Change', '#b45309'], bug: ['Wrong', '#b91c1c'], idea: ['Idea', '#1d4ed8'], good: ['Good', '#15803d'] };
  const tasks = TASKS.map(([g, items]) => `<div class="gg">${g}</div>` + items.map(([id, title, how]) => { const c = G.checks[id] || {};
    return `<div class="gt ${c.rating || ''}"><div class="gth"><b>${title}</b>${c.rating ? `<span class="gst ${c.rating}">${c.rating === 'good' ? 'Works' : 'Needs change'}</span>` : ''}</div><div class="gtd">${how}</div>
    <div class="gtr"><a data-g="go" data-id="${id}">Go there →</a><span></span><a class="gb ${c.rating === 'good' ? 'on' : ''}" data-g="rate" data-id="${id}" data-v="good">Works</a><a class="gb ${c.rating === 'change' ? 'onc' : ''}" data-g="rate" data-id="${id}" data-v="change">Needs change</a></div>
    ${c.rating === 'change' || c.note ? `<textarea id="gn_${id}" data-gid="${id}" placeholder="What should change?">${esc(c.note || '')}</textarea>` : ''}</div>`; }).join('')).join('');
  const notes = G.notes.length ? G.notes.map((n) => `<div class="gn"><div class="gnh"><span class="gk" style="color:${kinds[n.kind][1]};border-color:${kinds[n.kind][1]}">${kinds[n.kind][0]}</span><span class="gm">${esc(n.screen)}${n.lang === 'dv' ? ' · Dhivehi' : ''}</span><a class="gx" data-g="del" data-id="${n.id}" title="Delete">✕</a></div><div>${esc(n.text)}</div></div>`).join('')
    : `<div class="gempty">No notes yet. On any screen, tap “+ Note on this screen” and write what to fix or add.</div>`;
  el.innerHTML = `<div class="gpanel"><div class="ghead"><div><b>Test guide</b><div class="gsub">${done} of ${totalTasks} checked · ${G.notes.length} notes · ${G.store === 'db' ? 'saved, Claude can read these' : 'saved in this browser'}</div></div><a class="gx" data-g="toggle">✕</a></div>
  <div class="gtabs"><a class="${G.tab === 'tasks' ? 'on' : ''}" data-g="tab" data-v="tasks">Things to check</a><a class="${G.tab === 'notes' ? 'on' : ''}" data-g="tab" data-v="notes">My notes (${G.notes.length})</a></div>
  <div class="gbody">${G.tab === 'tasks' ? tasks : notes + (G.notes.length ? `<a class="gcopy" data-g="copy">Copy all notes</a>` : '')}</div></div><div class="gbar">${fab}</div>`;
}
async function gSetCheck(id, patch) {
  G.checks[id] = { ...(G.checks[id] || {}), ...patch, at: Date.now() };
  if (G.store === 'db') { try { await G.db.doc('checks/' + id).set(G.checks[id]); } catch (e) { toast('Could not save. Try again.'); } } else gSaveLocal();
}
async function gAddNote(kind, text) {
  const n = { kind, text, screen: ROUTE_NAMES[S.route] || S.route, route: S.route, lang: S.lang, mode: S.set.mode, stock: S.set.stock, role: S.role, created: Date.now() };
  if (G.store === 'db') { try { await G.db.collection('feedback').add(n); } catch (e) { toast(e && e.code === 'quota_exceeded' ? 'Too many notes saved. Delete some first.' : 'Could not save the note. Try again.'); return false; } }
  else { G.notes.unshift({ ...n, id: 'n' + n.created }); gSaveLocal(); }
  return true;
}
document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-g]'); if (!a) return; e.preventDefault();
  const k = a.dataset.g;
  if (k === 'toggle') G.open = !G.open;
  else if (k === 'tab') G.tab = a.dataset.v;
  else if (k === 'go') { for (const [, items] of TASKS) for (const t of items) if (t[0] === a.dataset.id) t[3](); }
  else if (k === 'rate') { const c = G.checks[a.dataset.id] || {}; await gSetCheck(a.dataset.id, { rating: c.rating === a.dataset.v ? '' : a.dataset.v }); }
  else if (k === 'note') { S.modal = { type: 'fb' }; S.form = { fbk: 'change' }; render(); setTimeout(() => document.getElementById('fb_text')?.focus(), 30); return; }
  else if (k === 'del') { if (G.store === 'db') { try { await G.db.doc('feedback/' + a.dataset.id).delete(); } catch (err) {} } else { G.notes = G.notes.filter((n) => n.id !== a.dataset.id); gSaveLocal(); } }
  else if (k === 'copy') { const txt = G.notes.map((n) => `[${n.kind}] ${n.screen}: ${n.text}`).join('\n') + '\n\n' + TASKS.flatMap((g) => g[1]).filter((t) => G.checks[t[0]]?.rating).map((t) => `${t[1]}: ${G.checks[t[0]].rating === 'good' ? 'works' : 'needs change'}${G.checks[t[0]].note ? ' — ' + G.checks[t[0]].note : ''}`).join('\n');
    try { await navigator.clipboard.writeText(txt); toast('Copied. Paste it to Claude.'); } catch (err) { toast('Could not copy. Select the notes and copy them.'); } }
  renderGuide();
});
document.addEventListener('focusout', async (e) => {
  const t = e.target; if (t.dataset && t.dataset.gid) { const v = t.value.trim(); if (v !== (G.checks[t.dataset.gid]?.note || '')) await gSetCheck(t.dataset.gid, { note: v }); setTimeout(() => { if (G.dirty) { G.dirty = false; renderGuide(); } }, 0); }
});
M.fb = () => `<h2>Note on this screen</h2><p class="mut">Screen: <b>${esc(ROUTE_NAMES[S.route] || S.route)}</b>${S.lang === 'dv' ? ' · Dhivehi' : ''}. Write what to fix, add or remove.</p>
  <div class="row" style="gap:6px;margin:10px 0">${[['change', 'Change this'], ['bug', 'Something is wrong'], ['idea', 'New idea'], ['good', 'This is good']].map(([k, n]) => `<a class="bt sm${S.form.fbk === k ? ' pr' : ''}" data-a="fbk" data-v="${k}">${n}</a>`).join('')}</div>
  <textarea class="inp wide" id="fb_text" rows="5" style="text-align:start" placeholder="e.g. Staff need a button for “fill full tank”">${esc(S.form.fb_text || '')}</textarea>
  <div class="mf"><a class="bt" data-a="close">Cancel</a><a class="bt pr" data-a="saveFb">Save note</a></div>`;
A.fbk = (d) => { S.form.fb_text = document.getElementById('fb_text')?.value || ''; S.form.fbk = d.v; render(); };
A.saveFb = async () => { const txt = (document.getElementById('fb_text')?.value || '').trim(); if (!txt) return toast('Write the note first'); if (await gAddNote(S.form.fbk || 'change', txt)) { S.modal = null; render(); renderGuide(); toast('Note saved'); } };
gLoadLocal();
(async () => {
  try {
    if (!window.claude || !window.claude.use) return;
    const db = await window.claude.use('db'); if (!db) return;
    G.db = db; G.store = 'db'; G.notes = []; G.checks = {};
    db.collection('feedback').orderBy('created', 'desc').onSnapshot((snap) => { G.notes = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderGuide(); }, () => {});
    db.collection('checks').onSnapshot((snap) => { const c = {}; snap.docs.forEach((d) => (c[d.id] = d.data())); G.checks = c; renderGuide(); }, () => {});
    renderGuide();
  } catch (e) {}
})();

render();
renderGuide();
