# Rubber Fly

بازی فارسیِ مرورگری برای گرفتن یک اردک بال‌دار که واکنش فرار آن از یک مدار اسپایکی استخراج‌شده
از داده‌های واقعی **MaleCNS v1.0** تأثیر می‌گیرد.

![پیش‌نمایش Rubber Fly](public/og.svg)

توسعه و بومی‌سازی: [Behrad Ghasemi / justbehrad](https://github.com/justbehrad)

## هدف

Rubber Fly یک بازی آرکید سه‌بعدی و یک نمایشگر زنده‌ی نورونی را در مرورگر اجرا می‌کند تا بتوانید
هم‌زمان حرکت اردک و فعالیت مدار فرار را ببینید. مدل پیش‌فرض شامل **۶٬۰۰۰ نورون**،
**۱٬۲۷۵٬۹۹۴ اتصال جهت‌دار** و **۱۰٬۶۵۹٬۶۸۵ تماس سیناپسی** است.

این پروژه شبیه‌سازی کامل مغز، هوش مصنوعی آموزش‌دیده یا مدل زیستی معتبر پرواز اردک نیست. ظاهر اردک،
فیزیک آرکید و حرکت پایه کد بازی‌اند؛ فقط خروجی مدار MaleCNS روی واکنش فرار و گردش اثر می‌گذارد.

## پیش‌نیازها

- Windows 10/11، macOS 13+ یا Linux 64-bit
- Node.js `24.x` (فایل `.nvmrc` نسخه‌ی مورد انتظار را مشخص می‌کند)
- npm همراه Node.js
- مرورگر جدید با WebGL و Hardware Acceleration
- برای بازتولید یا افزایش نورون‌ها: Python `3.12+`، حدود ۲ گیگابایت فضای آزاد و اینترنت

هیچ API Key، دیتابیس یا سرویس هوش مصنوعی لازم نیست.

## نصب و اجرای محلی

```bash
git clone https://github.com/justbehrad/Rubber-Fly.git
cd Rubber-Fly
npm ci
cp .env.example .env
npm run dev
```

در PowerShell ویندوز به‌جای `cp` اجرا کنید:

```powershell
Copy-Item .env.example .env
npm run dev
```

آدرس چاپ‌شده در ترمینال، معمولاً `http://127.0.0.1:5173`، را باز کنید.

## اجرا داخل ChatGPT Work

پس از بازکردن پوشه‌ی پروژه در Work، این دستورها را اجرا کنید:

```bash
npm ci
cp .env.example .env
npm run dev:work
```

فرمان `dev:work` سرور Vite را روی رابط محلی امن اجرا می‌کند تا Preview محیط Work آن را باز کند.
برای بررسی نسخه‌ی Production:

```bash
npm run build
npm run preview:work
```

## روش بازی

| ورودی     | عملکرد                                                         |
| --------- | -------------------------------------------------------------- |
| ماوس      | حرکت برای نشانه‌گیری و کلیک برای ضربه                          |
| لمس       | کشیدن برای هدف‌گیری و لمس دکمه‌ی «ضربه»                        |
| صفحه‌کلید | جهت‌ها برای هدف‌گیری، `Space` برای ضربه و `R` برای شروع دوباره |
| ذهن کوچک  | کشیدن برای چرخش و لمس نورون برای مشاهده‌ی شناسه و فعالیت       |

ضربه ۲۴۰ میلی‌ثانیه پس از کلیک فرود می‌آید و ۵۶۰ میلی‌ثانیه زمان بازیابی دارد. بنابراین باید کمی
جلوتر از اردک نشانه بگیرید.

## پیکربندی

فایل `.env` از روی `.env.example` ساخته می‌شود:

| متغیر               | مقدار پیش‌فرض           | اثر                               |
| ------------------- | ----------------------- | --------------------------------- |
| `VITE_CIRCUIT_FILE` | `circuit-expanded.json` | نام فایل مدار داخل `public/data/` |

مدارهای آماده:

| فایل                    | نورون | اتصال جهت‌دار | کاربرد                         |
| ----------------------- | ----: | ------------: | ------------------------------ |
| `circuit-compact.json`  | ۱٬۰۸۸ |        ۷۱٬۶۸۱ | دستگاه ضعیف و تست سریع         |
| `circuit-balanced.json` | ۱٬۷۸۸ |       ۲۱۵٬۳۲۹ | تعادل سرعت و جزئیات            |
| `circuit.json`          | ۲٬۸۸۸ |       ۴۷۰٬۱۷۰ | مدل استاندارد                  |
| `circuit-expanded.json` | ۶٬۰۰۰ |     ۱٬۲۷۵٬۹۹۴ | پیش‌فرض و دقیق‌ترین فایل آماده |

برای نمونه، اجرای مدل سبک:

```env
VITE_CIRCUIT_FILE=circuit-compact.json
```

پس از تغییر `.env`، سرور توسعه را متوقف و دوباره اجرا کنید.

## افزایش تعداد نورون‌ها

تعداد نورون را نباید با ویرایش دستی `neuronCount` زیاد کرد؛ آرایه‌ی نورون‌ها، اتصال‌ها، وزن‌ها،
مختصات و Manifest باید با هم تولید شوند.

### ۱. ساخت محیط استخراج داده

Linux/macOS:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
sh scripts/download-data.sh
```

PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r scripts\requirements.txt
bash scripts/download-data.sh
```

اسکریپت دانلود حدود ۱٫۲ گیگابایت داده‌ی رسمی MaleCNS را در `data/raw/` قرار می‌دهد.

### ۲. تولید مدار بزرگ‌تر

مدار ۶٬۰۰۰ نورونی شامل هسته‌ی ۱٬۰۸۸ سلولی و ۴٬۹۱۲ همسایه است. برای درخواست حدود ۱۰٬۰۰۰ نورون:

```bash
.venv/bin/python scripts/extract_circuit.py \
  --neighbors 8912 \
  --tier-id custom-10000 \
  --output public/data/circuit-custom-10000.json
```

در Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe scripts\extract_circuit.py `
  --neighbors 8912 `
  --tier-id custom-10000 `
  --output public\data\circuit-custom-10000.json
```

سپس `.env` را تغییر دهید:

```env
VITE_CIRCUIT_FILE=circuit-custom-10000.json
```

عدد نهایی ممکن است کمتر از درخواست باشد، چون استخراج‌کننده فقط همسایه‌هایی با حداقل ۲۰ تماس با
هسته را نگه می‌دارد. افزایش اندازه معمولاً زمان استخراج، حجم JSON، RAM و هزینه‌ی هر گام شبیه‌سازی
را بالا می‌برد و الزاماً رفتار «باهوش‌تر» ایجاد نمی‌کند.

### ۳. بررسی مدار سفارشی

```bash
npm run typecheck
npm run test:unit -- src/neural/Brain.test.ts
npm run build
```

برای مدارهای آماده، تست `Tiers.test.ts` شمارش‌های ثابت چهار Tier رسمی را بررسی می‌کند؛ مدار سفارشی
عمداً در آن فهرست نیست. Manifest فایل خروجی را برای `neuronCount`، `edgeCount` و فرض‌های انتخاب
بررسی کنید.

## معماری

```text
MaleCNS JSON → Web Worker → Brain (LIF) → MDN decoder → Game state
                     │                              │
                     └──── neural snapshots ───────┤
                                                    ↓
                           React UI ← Three.js renderers
```

| مسیر                          | مسئولیت                                      |
| ----------------------------- | -------------------------------------------- |
| `src/App.tsx`                 | رابط فارسی، ورودی، ضبط، بازپخش و انتخاب مدار |
| `src/game/`                   | قوانین بازی، زمان‌بندی ثابت و Web Worker     |
| `src/neural/Brain.ts`         | شبیه‌ساز نورون نقطه‌ای LIF و اتصال‌های تنک   |
| `src/render/ArenaRenderer.ts` | اردک بال‌دار، صحنه، ضربه و افکت برخورد       |
| `src/render/BrainRenderer.ts` | نمایش سه‌بعدی نورون‌ها و فعالیت زنده         |
| `public/data/`                | مدارهای آماده، کالیبراسیون و اعتبار علمی     |
| `scripts/extract_circuit.py`  | استخراج قابل‌بازتولید مدار بزرگ‌تر           |

پیچیدگی هر گام شبیه‌سازی `O(N + E_active)` و حافظه‌ی مدل `O(N + E)` است؛ `N` تعداد نورون‌ها و
`E` تعداد اتصال‌هاست. نمایش خطوط مغز نمونه‌برداری می‌شود، اما خود اتصال‌های انتخاب‌شده در شبیه‌سازی
حذف نمی‌شوند. Worker مالک زمان و state است تا UI React باعث دو بار اجراشدن گام‌ها نشود.

## تست و کنترل کیفیت

بررسی کامل:

```bash
npm run verify
```

این فرمان TypeScript، lint، فرمت، بررسی فایل‌های عمومی، تست واحد/امنیتی و build را اجرا می‌کند.

فرمان‌های جداگانه:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
RUN_GAME_SOAK=1 npm run test:unit -- src/game/Game.soak.test.ts
```

خروج موفق Vitest باید همه‌ی تست‌ها را Passed نشان دهد و build باید پوشه‌ی `dist/` را بدون خطا بسازد.

## انتشار در GitHub

به‌علت نبود فایل LICENSE در مخزن کد پایه، امن‌ترین مسیر حفظ تاریخچه‌ی Fork و دریافت اجازه‌ی صریح از
نویسنده‌ی اصلی است. پس از ساخت Repository/Fork مقصد:

```bash
git checkout -b rubber-fly-fa
git add .
git commit -m "feat: create Persian Rubber Fly edition"
git remote rename origin upstream
git remote add origin https://github.com/justbehrad/Rubber-Fly.git
git push -u origin rubber-fly-fa
```

برای تبدیل همان شاخه به `main` فقط پس از بررسی وضعیت مجوز و Repository مقصد اقدام کنید.

## خطاهای رایج

### صفحه سفید یا خطای بارگذاری مدار

- مقدار `VITE_CIRCUIT_FILE` باید فقط نام فایلی موجود در `public/data/` باشد.
- پس از تغییر `.env` سرور را Restart کنید.
- پروژه را با Vite اجرا کنید؛ بازکردن مستقیم `index.html` فایل JSON و Worker را درست سرو نمی‌کند.

### سرعت شبیه‌سازی کمتر از ۱×

- ضبط ویدئو را متوقف کنید.
- Hardware Acceleration مرورگر را فعال کنید.
- از `circuit-balanced.json` یا `circuit-compact.json` استفاده کنید.

### `npm ci` با خطای نسخه Node متوقف می‌شود

- خروجی `node --version` باید `v24.x` باشد.
- با `nvm use` یا نصب Node.js 24 نسخه را اصلاح و دوباره `npm ci` را اجرا کنید.

### مدار سفارشی نورون کمتری از عدد درخواست دارد

- گزینه‌ی `--neighbors` سقف درخواست است، نه تضمین تعداد نهایی.
- استخراج‌کننده فقط سلول‌های واجد آستانه‌ی تماس ساختاری را انتخاب می‌کند؛ خروجی ترمینال و Manifest
  منبع حقیقت‌اند.

## اصطلاحات

- **MaleCNS**: کانکتوم دستگاه عصبی مرکزی مگس نر بالغ.
- **Connectome / کانکتوم**: نقشه‌ی نورون‌ها و اتصال‌های میان آن‌ها.
- **LIF**: مدل Leaky Integrate-and-Fire برای تقریب پتانسیل غشایی و شلیک نورون.
- **LC16**: نورون‌های ورودی بینایی مرتبط با محرک نزدیک‌شونده در این مدار.
- **MDN**: نورون‌های نزولی که خروجی فرار/عقب‌نشینی از آن‌ها خوانده می‌شود.
- **Tier**: یک اندازه‌ی آماده از زیرگراف مدار.
- **Web Worker**: پردازش پس‌زمینه‌ی مرورگر، جدا از Thread رابط کاربری.

## اعتبار و وضعیت حقوقی

- نگهدارنده‌ی نسخه‌ی Rubber Fly: [justbehrad](https://github.com/justbehrad)
- کد پایه: پروژه‌ی `Swat` از `hrook1`
- داده: MaleCNS v1.0 از FlyEM / HHMI Janelia، University of Cambridge، MRC LMB و Google Research
- مجوز داده: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

فایل [NOTICE.md](NOTICE.md) وضعیت اعتبار و محدودیت انتشار کد پایه را توضیح می‌دهد. پژوهشگران منبع
این بازی را تأیید یا پشتیبانی رسمی نکرده‌اند.
