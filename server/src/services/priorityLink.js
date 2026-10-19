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

/** ח.פ. / תיק מע"מ להשוואה: ספרות בלבד, בלי אפסים מובילים. פחות מ-5 ספרות = לא מזהה. */
function normVat(v) {
  const d = String(v ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return d.length >= 5 ? d : '';
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

module.exports = { DOC_TYPES, CREDIT_NOTE, normVat, normName, proposeMatches, documentTotals };
