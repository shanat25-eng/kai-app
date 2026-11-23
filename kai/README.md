# k.ai — שלד בסיסי (Boilerplate)

עוזר תיעוד AI קליני לקלינאיות תקשורת. זהו שלב 1 בלבד — מבנה ה-Layout הבסיסי, ללא מסכי תוכן אמיתיים וללא חיבור ל-Backend.

## הרצה מקומית

```bash
npm install
npm run dev
```

## מבנה הפרויקט

```
src/
├── main.jsx                       # נקודת כניסה — טעינת פונט מקומית (לא CDN חיצוני)
├── App.jsx                        # הרכבת ה-Layout: Banner + Header + Nav + Content
├── index.css                      # Tailwind
├── constants/
│   └── documentStatus.js          # מקור אמת יחיד לסטטוסי מסמך (generated/reviewed/approved)
├── context/
│   └── AppViewContext.jsx         # ניהול הטאב הפעיל (ניתן להחלפה בראוטר אמיתי בעתיד)
├── api/
│   └── client.js                  # שכבת תקשורת עתידית מול Backend — כרגע לא בשימוש בפועל
├── components/
│   ├── layout/                    # Header, PrivacyBanner, NavBar, SystemStatusIndicator, ContentArea
│   └── common/
│       └── StatusBadge.jsx        # תג סטטוס גנרי, שואב מ-constants/documentStatus.js
└── screens/                       # מסכי Placeholder: מטופלים / מסמכים / הגדרות
```

## כללי ברזל שהוטמעו כבר בשלד הזה

1. **Strict Anonymization** — אין בשום מקום שדה/state לשם/ת.ז. של מטופל. `PrivacyBanner` מוצג קבוע ולא ניתן לסגירה.
2. **Clinical Safety & Audit Trail** — שלושת הסטטוסים (`generated` → `reviewed` → `approved`) מוגדרים במקום אחד בלבד (`constants/documentStatus.js`), ונצרכים על ידי `StatusBadge` בכל מקום שיציג מסמך.
3. **Architecture Ready** — `api/client.js` הוא placeholder לתקשורת עתידית עם ה-Backend; אין Mock Data קשיח בתוך רכיבי ה-UI; מסכי ה-Placeholder לא מכילים שום "נתון" — רק טקסט הסבר.
4. **NetFree Compatibility** — הפונט (Heebo) מוטמע מקומית דרך `@fontsource/heebo` ולא נטען מ-CDN חיצוני (למשל Google Fonts); אין תגי `<script>` חיצוניים; כל קריאות רשת עתידיות יעברו רק דרך `api/client.js` עם `fetch` סטנדרטי (HTTPS), כדי שדפדפן הקלינאית יפנה בפועל רק לדומיין של K.ai עצמו — בהתאם לפרק "התאמה לאינטרנט מסונן" ב-PRD.

## שלב 2 — Database + Authentication (נוסף)

```
src/
├── types/
│   └── entities.js                # טיפוסי JSDoc: Patient, Session, Document, AuditLogEntry
├── constants/
│   └── documentType.js            # 4 סוגי המסמכים (initial_assessment/session_summary/series_summary/continuation_request)
├── api/
│   ├── storage.js                 # שכבת עזר גנרית ל-localStorage
│   ├── auditLog.js                # יומן ביקורת — נקרא פנימית ע"י שאר ה-api
│   ├── patients.js                # CRUD מטופלים
│   ├── sessions.js                # CRUD מפגשים
│   └── documents.js                # CRUD מסמכים + state-machine הסטטוסים
├── context/
│   └── AuthContext.jsx            # ⚠️ אימות MVP מקומי בלבד — ראי אזהרה בקובץ עצמו
├── components/auth/
│   └── RequireAuth.jsx            # שער כניסה: בלי חיבור, לא נטען שום נתון
└── screens/
    └── LoginScreen.jsx
```

**⚠️ אזהרת אבטחה:** ה-Authentication הנוכחי הוא Placeholder לפיתוח מקומי בלבד (משתמשת קבועה, סיסמה מקודדת בקוד). **אין להשתמש בו מול נתוני מטופלים אמיתיים** לפני חיבור Backend עם אימות אמיתי.

**מנגנון הסטטוסים בקוד (לא רק בתיעוד):** `api/documents.js` אוכף בפועל את `generated → reviewed → approved` — עריכת תוכן מעבירה `generated` ל-`reviewed` אוטומטית, אך המעבר ל-`approved` קורה אך ורק דרך `approveDocument()`, לעולם לא במרומז.

## שלב 5 — יצירת סיכום מפגש (סוג מסמך ראשון end-to-end)

**המטרה של השלב**: לבדוק את הזרימה המרכזית של יצירת מסמך —
טקסט נכנס ← כפתור עובד ← טיוטת סיכום מובנית מוצגת ונשמרת.

```
src/
├── api/
│   └── documentGeneration.js       # ⚠️ סטאב זמני — נקודת ההחלפה היחידה כשיגיע AI אמיתי
├── screens/
│   └── CreateSessionSummaryScreen.jsx  # 3 שלבים: input → draft → saved
├── context/
│   └── AppViewContext.jsx          # (עודכן) הוספת CREATE_SESSION_SUMMARY כ-sub-view
├── components/
│   ├── layout/ContentArea.jsx      # (עודכן) מיפוי המסך החדש
│   └── patients/PatientWorkspaceActions.jsx  # (עודכן) 4 כפתורים: 1 פעיל, 2 placeholders, 1 disabled
```

### מה בונים בשלב 5
- כפתור "סיכום מפגש טיפולי" ב-Workspace הופך לפעיל.
- מסך חדש עם 3 שלבים: הזנת טקסט מקור → הצגת טיוטה מובנית (6 סעיפים) → אישור שמירה.
- הטיוטה נשמרת ב-DB דרך שכבת ה-API הקיימת: יוצרת Session ו-Document תואמים
  (הכרחי כדי ש-`PatientsScreen.enrichPatient` יידע שהיה מפגש חדש).
- Document נשמר בסטטוס `generated` — יופיע בהיסטוריה כטיוטה.
- כפתור "העתק" על "נוסח קצר להעתקה" (`navigator.clipboard`).
- privacyGuard על הטקסט לפני שמירה (עקבי עם `PatientFormModal`).

### נקודת ההחלפה היחידה ל-AI אמיתי
`src/api/documentGeneration.js/generateTreatmentSummary(sourceText)` היא נקודת החלפה יחידה.
כשיגיע Backend עם LLM, הפונקציה תעבור לקרוא ל-`api/client.js`. חוזה החזרה
(אובייקט TreatmentSummary עם 6 שדות) נשמר, ואף רכיב UI לא צריך להשתנות.

### מה במפורש *לא* בנוי בשלב 5
- **AI אמיתי, קריאות רשת, הקלטה, תמלול, קבצים, PDF/Word** — כל אלה יגיעו בשלבים מאוחרים יותר.
- **עריכה ואישור של הטיוטה** (`reviewed → approved`) — התשתית ב-`api/documents.js` קיימת,
  אבל מסך עריכה ייעודי הוא שלב 6. כרגע טיוטות נשארות ב-`generated`.
- **3 סוגי המסמכים האחרים** (`initial_assessment` / `series_summary` / `continuation_request`) —
  הכפתורים מוצגים כ-placeholders (וב-`continuation_request` — כ-disabled מפורש עם "יגיע בשלב הבא").

### נקודות פתוחות מוכרות (לתקן בשלבים הבאים, לא באגים)
- אם `createDocument` נכשלת אחרי `createSession` — נשארת Session יתומה בלי מסמך (אין transactions ב-localStorage).
- `PatientDocumentHistory` מתרענן על ידי unmount+remount של המסך (עובד — אבל לא הרינדור הכי אלגנטי).
- ב-`tailwind.config.js` חלק מהגוונים (`caution-200`, `brand-300`) נופלים ל-transparent
  כי לא הוגדרו בקונפיג — הופיע לפני שלב 5 ותוקן חלקית ע"י שימוש בגוונים הקיימים בלבד בקוד החדש.

## שלב 6 — עריכה ואישור טיוטה (Human Approval)

```
src/
├── screens/
│   └── DocumentEditScreen.jsx              # מסך עריכה + אישור סופי למסמך (חדש)
├── context/
│   └── AppViewContext.jsx                  # (עודכן) DOCUMENT_EDIT view + selectedDocumentId + openDocumentEdit
├── components/
│   ├── layout/ContentArea.jsx              # (עודכן) מיפוי DOCUMENT_EDIT ← DocumentEditScreen
│   └── patients/PatientDocumentHistory.jsx # (עודכן) שורות היסטוריה הפכו ללחיצות → openDocumentEdit(doc.id)
└── screens/CreateSessionSummaryScreen.jsx  # (עודכן) SavedStep: כפתור ראשי "ערכי טיוטה עכשיו"
```

### הזרימה מקצה לקצה
יצירת טיוטה (שלב 5) → שמירה (status `generated`) → כניסה למסך עריכה — משני מקומות: כפתור "ערכי טיוטה עכשיו" מיד אחרי שמירה, או לחיצה על מסמך קיים בהיסטוריית המטופל → עריכת הטקסט עם autosave מבוזר ל-DB (דרך `updateDocumentContent` הקיים — אין מנגנון draft נפרד) → Checkbox חובה "אני מאשרת שבדקתי את הטקסט ואין בו שמות מלאים או פרטים מזהים של המטופל/ת" → כפתור "אשר טיוטה סופית" (מושבת עד שה-Checkbox מסומן) → `approveDocument` → status `approved`, משתקף מיידית ב-`StatusBadge` בהיסטוריית המטופל.

עדכון תוכן ראשון (autosave או שמירה) מעביר את המסמך אוטומטית `generated → reviewed`, בהתאם למנגנון שכבר קיים ב-`api/documents.js`. המעבר ל-`approved` קורה אך ורק דרך `approveDocument`, ולעולם לא כתוצאה מעריכה.

## רשימת בדיקות ידניות — שלב 6 (בדפדפן)

1. `npm run dev`, כניסה למטופל עם היסטוריית מסמכים (או יצירת מטופל + סיכום מפגש חדש).
2. יצירת טיוטה: מילוי תאריך + טקסט מקור → "צור/י טיוטת סיכום" → 6 הסעיפים מוצגים.
3. שמירה: "שמור כטיוטה" → מסך הצלחה עם 3 כפתורים, "ערכי טיוטה עכשיו" מודגש כראשי.
4. כניסה לעריכה דרך "ערכי טיוטה עכשיו" → נטען אותו מסמך בדיוק (הטקסט תואם למה שנוצר עכשיו).
5. כניסה לעריכה דרך היסטוריית מסמכים (חזרה ל-workspace ← לחיצה על שורת מסמך) → נטען אותו מסמך שנבחר, לא מסמך אחר.
6. נגישות מקלדת: Tab עד שורת מסמך בהיסטוריה, Enter → נפתח מסך העריכה.
7. עריכת הטקסט ב-textarea → מופיע "שומר…" ואז "נשמר" ליד הכותרת.
8. שרידות ל-autosave: אחרי "נשמר", לרענן את הדף (F5) — הניווט עצמו יחזור למסך המטופלים (צפוי, `selectedDocumentId` הוא state בזיכרון בלבד) → להיכנס שוב לאותו מסמך מההיסטוריה → הטקסט הערוך נשמר בפועל.
9. ניסיון אישור בלי לסמן Checkbox: כפתור "אשר טיוטה סופית" מושבת; אם מגיעים ללחיצה בכל זאת — לא נקראת `approveDocument`, ומוצגת הודעת שגיאה קצרה.
10. סימון ה-Checkbox → הכפתור הופך פעיל, הודעת החסימה נעלמת.
11. לחיצה על "אשר טיוטה סופית" → מעבר למסך "המסמך אושר סופית".
12. חזרה למסך העבודה של המטופל → אותו מסמך בהיסטוריה מציג `StatusBadge` "מאושר".
13. מסמך שלא נמצא / אין הקשר מטופל+מסמך תקין (למשל כניסה ישירה למסך בלי לבחור מסמך) → הודעת שגיאה ידידותית, לא קריסה.
14. `npm run build` — עובר בלי שגיאות.
