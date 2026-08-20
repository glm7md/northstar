# Northstar University — Learning Portal

منصة تعليمية متكاملة (Frontend + Backend حقيقي) لطلاب وإدارة الجامعة.

## هيكل المشروع
```
frontend/   → صفحات الطالب + لوحة الأدمن (HTML/CSS/JS) — تتواصل مع الباك اند عبر api.js
backend/    → Node.js + Express API — auth / courses / lectures / quizzes / students / storage
app.py      → سكربت تشغيل يشغّل الباك اند والفرونت اند مع بعض (اختياري)
```

## التشغيل السريع

### 1) الباك اند
```bash
cd backend
npm install
cp .env.example .env      # عدّل القيم (خصوصًا DATABASE_URL و ADMIN_PASSWORD و JWT_SECRET)
npm run db:migrate        # ينشئ الجداول في الـ Postgres اللي محدد في DATABASE_URL
npm start                 # يشتغل على http://localhost:3000
```
عند أول تشغيل هيتعمل حساب أدمن تلقائيًا من `ADMIN_USERNAME` / `ADMIN_PASSWORD` في `.env`
(افتراضيًا: `admin` / `admin123` — **غيّرها قبل أي نشر حقيقي**).

محتاج Postgres شغّال محليًا أو سحابيًا (Railway بيديك واحدة بضغطة زرار). حط الـ connection
string بتاعه في `DATABASE_URL`.

### 2) الفرونت اند
أي static file server يخدم مجلد `frontend/`، مثلًا:
```bash
cd frontend
python3 -m http.server 5500
```
افتح `http://localhost:5500`. تأكد إن `CORS_ORIGIN` في `backend/.env` مطابق للبورت ده.

### 3) أو الاتنين مع بعض
```bash
python3 app.py
```

## تخزين الملفات (فيديوهات/PDF/صور)
لو مفيش `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` في `.env`، الباك اند بيرجع تلقائيًا
لتخزين الملفات محليًا في `backend/uploads/` (كافي تمامًا للتجربة والتطوير). لو حطيت بيانات
Supabase الحقيقية هيستخدمها بدل كده تلقائيًا من غير أي تعديل في الكود.

## الاختبارات
```bash
cd backend
npm test
```
21 اختبار (Jest + Supertest) بيغطوا: تسجيل الدخول، صلاحيات الأدمن/الطالب، قفل المحاضرات،
تصحيح الكويز من السيرفر، منع تكرار المحاولة، نشر الدرجة النهائية، وعدم تسريب بيانات حساسة.

## أهم الإصلاحات الأمنية اللي اتعملت
- **الباسوردات** بقت مشفرة (bcrypt) بدل ما تتخزن نص عادي في localStorage.
- **تسجيل الدخول** بقى JWT حقيقي من السيرفر بدل فحص localStorage في المتصفح.
- **تصحيح الكويز بقى بالكامل من السيرفر** — إجابات الـMCQ الصحيحة مش بترسل للطالب أبدًا،
  والدرجة بتتحسب في الباك اند مش في المتصفح (كان ممكن أي طالب يغيّر الدرجة بسهولة).
- **قفل المحاضرات (unlock rules)** بقى بيتفحص في السيرفر مش بس في الواجهة.
- **صلاحيات الرفع (upload)** بقت محكومة بدور المستخدم (أدمن/طالب) ونوع الملف المسموح به لكل مسار.
- **Rate limiting** على تسجيل الدخول والرفع، و**Helmet** لأمان الـHTTP headers، و**CORS** محدد
  بدل ما يكون مفتوح للجميع.

## قاعدة البيانات
البيانات متخزنة في **PostgreSQL** (مش ملفات JSON، ومش localStorage). الـ schema بالكامل
في `backend/migrations/001_init.sql` — جداول منفصلة لـ `courses` / `lectures` / `quizzes` /
`quiz_questions` / `quiz_options` / `students` / `enrollments` / `quiz_attempts` /
`quiz_attempt_answers`، مربوطين بـ foreign keys (`ON DELETE CASCADE`).

طبقة `backend/src/repositories/` هي الحد الوحيد اللي بيتكلم مع الـ DB مباشرة — الـ
controllers والـ services والفرونت اند مش شايفين SQL خالص، فأي تغيير مستقبلي في الـ schema
بيبقى محصور في الملفات دي بس. اختبارات الـ backend (`npm test`) بتشغّل نفس الـ SQL على محرك
Postgres حقيقي في الميموري (`pg-mem`) — مش mocks — فبتتأكد إن الـ migration والـ queries
شغالين فعلًا.

لتشغيل الـ migration على قاعدة بياناتك:
```bash
cd backend
DATABASE_URL=postgres://user:pass@host:5432/northstar npm run db:migrate
```
