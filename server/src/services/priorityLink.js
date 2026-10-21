// קישור לקוח CRM ↔ לקוח Priority, וסיכומי מסמכים. פונקציות טהורות בלבד — בלי DB ובלי רשת —
// כדי שאפשר לבדוק אותן על נתוני דוגמה (test/priorityLink.test.js). השימוש: routes/priority.js.
//
// כללי ההתאמה (RESEARCH-2026-10-19-CRM-PRIORITY.md, סעיף 4):
//   1. תיק מע"מ ב-Priority = ח.פ. ב-CRM (ספרות בלבד, בלי אפסים מובילים).
//   2. אחרת: שם מנורמל זהה.
//   התאמה היא **הצעה** בלבד. מנהל מאשר כל אחת. אין יצירה ואין מיזוג אוטומטיים.
//   חשבון שתואם כמה לקוחות, או לקוח שתואם כמה חשבונות (כפילות ב-Priority) — "דו-משמעי", לא הצעה.

const CREDIT_NOTE = 330;

// קודי מסמך במראה (מבנה אחיד) → תווית. הקידומות כפי שהן ב-Priority.
const DOC_TYPES = {
  300: { label: 'חשבון עסקה', prefixes: ['PI'] },
  305: { label: 'חשבונית מס', prefixes: ['IN', 'IK'] },
  310: { label: 'חשבונית מרכזת', prefixes: ['SI'] },
  320: { label: 'חשבונית מס קבלה', prefixes: ['OV', 'ON'] },
  330: { label: 'חשבונית זיכוי', prefixes: ['CR'] },
  400: { label: 'קבלה', prefixes: ['RC'] },
};

// ח.פ. דמה שעובר את ספרת הביקורת ומשמש ב-Priority כ"אין ח.פ." (999999998 נמצא בנתונים ב-20/10).
// אם הוא נחשב מזהה, כל החשבונות שנושאים אותו "תואמים" זה לזה וחוסמים זה את זה.
const DUMMY_VATS = new Set(['999999998', '999999999']);

/** ח.פ. / תיק מע"מ להשוואה: ספרות בלבד, בלי אפסים מובילים. פחות מ-5 ספרות או ח.פ. דמה = לא מזהה. */
function normVat(v) {
  const d = String(v ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return d.length >= 5 && !DUMMY_VATS.has(d) ? d : '';
}

/** שם להשוואה: בלי מרכאות/גרש, בלי פיסוק, בלי סיומות צורת התאגדות (בע"מ, ע"ר, Ltd). */
function normName(v) {
  let s = String(v ?? '').toLowerCase();
  s = s.replace(/["'`״׳’‘“”]/g, '');                 // בע"מ → בעמ, ע"ר → ער
  s = s.replace(/[.,\-–—_()[\]{}/\\&+:;!?|]/g, ' ');
  s = ` ${s.replace(/\s+/g, ' ').trim()} `;
  for (const suffix of [' בעמ ', ' בע מ ', ' ער ', ' ltd ', ' limited ', ' inc ']) {
    while (s.includes(suffix)) s = s.replace(suffix, ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

function groupBy(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

const accountView = (a) => ({
  priority_customer_no: String(a.account_key),
  priority_name: a.account_name ?? null,
  priority_vat_id: a.party_vat_id ?? null,
});
const customerView = (c) => ({
  customer_id: c.id,
  customer_name: c.company_name,
  business_id: c.business_id ?? null,
});

/**
 * accounts:  שורות p_accounts של לקוחות ({ account_key, account_name, party_vat_id }).
 * customers: לקוחות CRM ({ id, company_name, business_id, priority_customer_no, deleted_at }).
 * מחזיר { summary, proposals, ambiguous, unmatched, linked, orphan_links }.
 */
function proposeMatches(accounts, customers) {
  const active = customers.filter((c) => !c.deleted_at);
  const linkedByNo = new Map(
    active.filter((c) => c.priority_customer_no).map((c) => [String(c.priority_customer_no), c]),
  );
  const free = active.filter((c) => !c.priority_customer_no);
  const byVat = groupBy(free, (c) => normVat(c.business_id));
  const byName = groupBy(free, (c) => normName(c.company_name));

  const linked = [];
  const candidates = [];
  const ambiguous = [];
  const unmatched = [];
  const seenNos = new Set();

  for (const a of accounts) {
    const no = String(a.account_key);
    seenNos.add(no);
    const linkedTo = linkedByNo.get(no);
    if (linkedTo) {
      linked.push({ ...accountView(a), ...customerView(linkedTo), matched_by: linkedTo.priority_matched_by ?? null });
      continue;
    }
    const vat = normVat(a.party_vat_id);
    let hits = vat ? byVat.get(vat) || [] : [];
    let matchedBy = 'vat';
    if (hits.length === 0) {                       // ח.פ. לא נמצא (או חסר) → שם
      const name = normName(a.account_name);
      hits = name ? byName.get(name) || [] : [];
      // שני ח.פ. תקינים ושונים = שתי ישויות שונות, גם אם השם זהה. שם רק כשלאחד הצדדים אין ח.פ.
      if (vat) hits = hits.filter((c) => !normVat(c.business_id));
      matchedBy = 'name';
    }
    if (hits.length === 1) {
      candidates.push({ account: a, customer: hits[0], matched_by: matchedBy });
    } else if (hits.length > 1) {
      ambiguous.push({
        ...accountView(a), matched_by: matchedBy, reason: 'several_crm_customers',
        customers: hits.map(customerView),
      });
    } else {
      unmatched.push(accountView(a));
    }
  }

  // לקוח CRM אחד שהוצע לכמה חשבונות Priority = כפילות ב-Priority. נשאר להחלטת רעם.
  const perCustomer = groupBy(candidates, (p) => p.customer.id);
  const proposals = [];
  for (const p of candidates) {
    if (perCustomer.get(p.customer.id).length === 1) {
      proposals.push({ ...accountView(p.account), ...customerView(p.customer), matched_by: p.matched_by });
    } else {
      ambiguous.push({
        ...accountView(p.account), matched_by: p.matched_by, reason: 'priority_duplicate',
        customers: [customerView(p.customer)],
      });
    }
  }

  // קישורים שהמספר שלהם לא הופיע ב-p_accounts (מספר שגוי, או מראה חלקית)
  const orphanLinks = [...linkedByNo.entries()]
    .filter(([no]) => !seenNos.has(no))
    .map(([no, c]) => ({ priority_customer_no: no, ...customerView(c) }));

  return {
    summary: {
      accounts_read: accounts.length,
      linked: linked.length,
      proposals_vat: proposals.filter((p) => p.matched_by === 'vat').length,
      proposals_name: proposals.filter((p) => p.matched_by === 'name').length,
      ambiguous: ambiguous.length,
      unmatched: unmatched.length,
      orphan_links: orphanLinks.length,
    },
    proposals,
    ambiguous,
    unmatched,
    linked,
    orphan_links: orphanLinks,
  };
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * סיכומים לכרטיס לקוח. **אין סכום כולל אחד**: קבלה (400) משלמת חשבונית, 320 היא חשבונית וקבלה
 * באותו מסמך, וחשבון עסקה (300) אינו מסמך מס. לכן סיכום לכל סוג, בלי מבוטלים, וזיכוי (330) בשלילה
 * (Math.abs — הסימן שנשמר במראה לא אומת).
 */
function documentTotals(rows) {
  const byType = {};
  for (const d of rows) {
    const type = Number(d.doc_type);
    const b = byType[type] || (byType[type] = { label: DOC_TYPES[type]?.label ?? String(type), count: 0, cancelled: 0, total_incl_vat: 0 });
    if (d.cancelled) { b.cancelled += 1; continue; }
    b.count += 1;
    const v = Number(d.total_incl_vat) || 0;
    b.total_incl_vat += type === CREDIT_NOTE ? -Math.abs(v) : v;
  }
  for (const b of Object.values(byType)) b.total_incl_vat = round2(b.total_incl_vat);
  const sum = (...types) => round2(types.reduce((s, t) => s + (byType[t]?.total_incl_vat || 0), 0));
  return {
    by_type: byType,
    tax_invoices_net: sum(305, 310, 320, 330),   // חשבוניות מס נטו, אחרי זיכויים
    deal_invoices: sum(300),                     // חשבונות עסקה — לא חוב
    receipts: sum(400),
  };
}

// ── ייבוא מבוקר: חשבון Priority בלי לקוח ב-CRM → לקוח חדש ומקושר ─────────────
// רק מספרים שמנהל סימן. כל מספר עובר את importDecision, גם בתצוגה (GET /unmatched) וגם ביצירה
// (POST /import-customers), כדי שמה שהמסך מציג כחסום הוא בדיוק מה שהשרת ידחה.

const CUSTOMER_NO_RE = /^\d{1,20}$/;
const EMPTY_STATS = { doc_count: 0, cancelled_count: 0, tax_invoices_net: 0, receipts: 0, last_doc_date: null };

/**
 * סטטיסטיקת מסמכים לכל party_key, להחלטה אם לפתוח כרטיס. סכום = documentTotals (נטו חשבוניות מס,
 * וקבלות בנפרד), לא סכום גולמי של total_incl_vat. התאריך האחרון — מסמכים שלא בוטלו בלבד.
 * מחזיר Map: party_key (מחרוזת) → { doc_count, cancelled_count, tax_invoices_net, receipts, last_doc_date }.
 */
function documentStats(docs) {
  const out = new Map();
  for (const [key, rows] of groupBy(docs, (d) => (d.party_key == null ? '' : String(d.party_key)))) {
    const live = rows.filter((d) => !d.cancelled);
    const totals = documentTotals(rows);
    let last = null;
    for (const d of live) if (d.issue_date && (!last || String(d.issue_date) > last)) last = String(d.issue_date);
    out.set(key, {
      doc_count: live.length,
      cancelled_count: rows.length - live.length,
      tax_invoices_net: totals.tax_invoices_net,
      receipts: totals.receipts,
      last_doc_date: last,
    });
  }
  return out;
}

/**
 * המסמך האחרון של כל party_key — אותו כלל בכרטיס הלקוח וברשימת הלקוחות, כדי ששניהם יראו אותו מסמך.
 * רק מסמכי לקוח (DOC_TYPES, לא 700 של ספקים) שלא בוטלו. תאריך = issue_date, ואם אין — doc_date;
 * בתיקו: id גבוה יותר. לא סומכים על סדר השורות מהמראה (דפדוף ב-pmAll).
 * מחזיר Map: party_key (מחרוזת) → { id, doc_type, doc_no, date, total_incl_vat }.
 */
function lastDocuments(docs) {
  const out = new Map();
  for (const d of docs) {
    if (d.cancelled || !DOC_TYPES[Number(d.doc_type)] || d.party_key == null) continue;
    const date = d.issue_date || d.doc_date || null;
    if (!date) continue;
    const key = String(d.party_key);
    const cur = out.get(key);
    const day = String(date).slice(0, 10);
    if (cur && (day < cur.date || (day === cur.date && Number(d.id) <= Number(cur.id)))) continue;
    out.set(key, {
      id: d.id, doc_type: Number(d.doc_type), doc_no: d.doc_no ?? null, date: day,
      total_incl_vat: d.total_incl_vat == null ? null : Number(d.total_incl_vat),
    });
  }
  return out;
}

/**
 * לקוח CRM קיים שחשבון Priority היה משכפל. אותם כללים כמו proposeMatches, אבל מול **כל** הלקוחות
 * הפעילים — גם מקושרים: חשבון כפול ב-Priority שהח.פ. שלו שייך ללקוח שכבר קושר נוחת ב-unmatched.
 * customers: לקוחות פעילים בלבד. מחזיר { reason: vat_exists|name_exists, customer_id, ... } או null.
 */
function findExisting(account, customers) {
  const vat = normVat(account.party_vat_id);
  let hit = vat ? customers.find((c) => normVat(c.business_id) === vat) : null;
  let reason = 'vat_exists';
  if (!hit) {
    const name = normName(account.account_name);
    // שני ח.פ. תקינים ושונים = שתי ישויות, גם בשם זהה
    hit = name ? customers.find((c) => normName(c.company_name) === name && !(vat && normVat(c.business_id))) : null;
    reason = 'name_exists';
  }
  if (!hit) return null;
  return {
    reason,
    customer_id: hit.id ?? null,
    customer_name: hit.company_name,
    customer_priority_no: hit.priority_customer_no == null ? null : String(hit.priority_customer_no),
  };
}

/**
 * חשבון Priority אחר עם אותו ח.פ. שכבר מקושר ללקוח פעיל = כפילות ב-Priority (כמו 200029/200157).
 * תופס גם את המקרה שבו בכרטיס ה-CRM אין ח.פ., ולכן findExisting לא רואה את הכפילות.
 */
function linkedTwin(account, no, accByNo, activeCustomers) {
  const vat = normVat(account.party_vat_id);
  if (!vat) return null;
  for (const other of accByNo.values()) {
    const key = String(other.account_key);
    if (key === no || normVat(other.party_vat_id) !== vat) continue;
    const c = activeCustomers.find((x) => x.priority_customer_no != null && String(x.priority_customer_no) === key);
    if (c) {
      return { reason: 'priority_duplicate', customer_id: c.id ?? null, customer_name: c.company_name, customer_priority_no: key };
    }
  }
  return null;
}

/**
 * מה לעשות עם מספר אחד שסומן. accByNo: Map של **כל** חשבונות הלקוח ב-p_accounts לפי account_key
 * (לא רק המבוקשים — בלעדיהם אין דרך לזהות כפיל ב-Priority של חשבון שכבר מקושר).
 * customers: **כל** לקוחות ה-CRM, כולל מחוקים — האינדקס הייחודי על priority_customer_no כולל אותם.
 * מחזיר { action: 'create', row } | { action: 'skip', reason, ... } | { action: 'conflict', reason, ... }.
 */
function importDecision(no, accByNo, customers) {
  if (!CUSTOMER_NO_RE.test(no)) return { action: 'skip', reason: 'invalid_no' };
  const linkedTo = customers.find((c) => c.priority_customer_no != null && String(c.priority_customer_no) === no);
  if (linkedTo) {
    return {
      action: 'skip',
      reason: linkedTo.deleted_at ? 'linked_to_deleted' : 'already_linked',
      customer_id: linkedTo.id ?? null,
      customer_name: linkedTo.company_name,
    };
  }
  const a = accByNo.get(no);
  if (!a) return { action: 'skip', reason: 'not_in_mirror' };
  const name = String(a.account_name ?? '').trim();
  if (!name) return { action: 'skip', reason: 'missing_name' };
  const active = customers.filter((c) => !c.deleted_at);
  const existing = findExisting(a, active) || linkedTwin(a, no, accByNo, active);
  if (existing) return { action: 'conflict', ...existing };
  const city = String(a.city ?? '').trim();
  return {
    action: 'create',
    row: {
      priority_customer_no: no,
      company_name: name,
      // ח.פ. זבל (פחות מ-5 ספרות) לא נשמר — הוא לא מזהה, ורק היה יוצר התנגשויות שווא בעתיד
      business_id: normVat(a.party_vat_id) ? String(a.party_vat_id).trim() : null,
      city: city || null,
    },
  };
}

/**
 * מריץ ייבוא לפי הסדר. create(row) יוצר ומקשר בפעולה אחת ומחזיר את הלקוח; null = המספר נתפס בינתיים
 * (אינדקס ייחודי); זריקה = כשל ברשומה הזו בלבד. לקוח שנוצר נכנס מיד לבדיקה של הבאים — שני חשבונות
 * עם אותו ח.פ. באותה בקשה יוצרים לקוח אחד, והשני חוזר כ-conflict.
 * מחזיר { created, conflicts, skipped, failed, summary }.
 */
async function runImport(nos, accounts, customers, create) {
  const accByNo = new Map(accounts.map((a) => [String(a.account_key), a]));
  const pool = [...customers];
  const out = { created: [], conflicts: [], skipped: [], failed: [] };
  for (const no of nos) {
    const d = importDecision(no, accByNo, pool);
    const { action, ...info } = d;
    if (action === 'skip') { out.skipped.push({ priority_customer_no: no, ...info }); continue; }
    if (action === 'conflict') { out.conflicts.push({ priority_customer_no: no, ...info }); continue; }
    let customer;
    try {
      customer = await create(d.row);
    } catch (e) {
      out.failed.push({ priority_customer_no: no, error: String(e?.message || e).slice(0, 200) });
      continue;
    }
    if (!customer) { out.skipped.push({ priority_customer_no: no, reason: 'already_linked' }); continue; }
    pool.push({ ...d.row, ...customer, priority_customer_no: no, deleted_at: null });
    out.created.push({ priority_customer_no: no, customer_id: customer.id, customer_name: customer.company_name });
  }
  out.summary = {
    requested: nos.length,
    created: out.created.length,
    conflicts: out.conflicts.length,
    skipped: out.skipped.length,
    failed: out.failed.length,
  };
  return out;
}

/**
 * תור ההחלטה למסך: unmatched ו-ambiguous של proposeMatches, עם עיר וסטטיסטיקת מסמכים מהמראה.
 * לכל unmatched: blocked — ההחלטה שהשרת היה מקבל ביצירה (null = אפשר ליצור), ו-priority_duplicates —
 * חשבונות Priority אחרים עם אותו ח.פ.
 * customers: כל הלקוחות, כולל מחוקים (כמו importDecision).
 */
function buildImportQueue(matches, accounts, customers, docs) {
  const accByNo = new Map(accounts.map((a) => [String(a.account_key), a]));
  const stats = documentStats(docs);
  const byVat = groupBy(accounts, (a) => normVat(a.party_vat_id));
  const extra = (no) => ({ city: accByNo.get(no)?.city ?? null, ...(stats.get(no) || EMPTY_STATS) });

  const unmatched = matches.unmatched.map((u) => {
    const no = u.priority_customer_no;
    const { action, row: _row, ...info } = importDecision(no, accByNo, customers);
    const vat = normVat(u.priority_vat_id);
    return {
      ...u,
      ...extra(no),
      blocked: action === 'create' ? null : info,
      priority_duplicates: vat ? (byVat.get(vat) || []).map((a) => String(a.account_key)).filter((k) => k !== no) : [],
    };
  });
  // פעילים לאחרונה קודם; בלי מסמכים — בסוף
  unmatched.sort((x, y) => (y.last_doc_date || '').localeCompare(x.last_doc_date || '')
    || y.doc_count - x.doc_count
    || x.priority_customer_no.localeCompare(y.priority_customer_no));

  return {
    summary: { ...matches.summary, importable: unmatched.filter((u) => !u.blocked).length },
    unmatched,
    ambiguous: matches.ambiguous.map((a) => ({ ...a, ...extra(a.priority_customer_no) })),
  };
}

module.exports = {
  DOC_TYPES, CREDIT_NOTE, CUSTOMER_NO_RE, normVat, normName, proposeMatches, documentTotals,
  documentStats, lastDocuments, findExisting, importDecision, runImport, buildImportQueue,
};
