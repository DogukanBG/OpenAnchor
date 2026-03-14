# ⚓ OpenAnchor | The Privacy-First Open-Source Financial Planner

> Open-source, privacy-first financial planner with local AI. No cloud. No accounts. No telemetry.

Built with **Electron**, **React**, **SQLite**, and **Ollama** — everything runs on your machine.

---

## Screenshots

### Dashboard
![Dashboard](assets/dashboard.png)
Get a full financial overview at a glance. The dashboard shows your real account balance (extracted directly from your bank statement), income, expenses, and net balance across any time range — 7 days to 5 years. An AI-generated financial health report summarises your last 30 days against your 12-month baseline, flagging unusual spending and trends. Interactive area charts, category breakdowns, and a donut chart complete the picture.

### Transactions
![Transactions](assets/transactions.png)
Every transaction in one place. Filter by time range, category, or type — search across all entries instantly. Add, edit, or delete transactions manually, or let the AI importer handle it. Each row shows the date, description, category icon, amount, and which page of the statement it came from.

### AI Assistant
![AI Assistant](assets/aiassistant.png)
Your personal finance analyst — running entirely on your machine. Choose how much data to give the model: 7 days up to a full year. The assistant loads that window of transactions and gives accurate, number-grounded advice. No data ever leaves your device.

---

## Features

### Dashboard
- 🏦 **Live account balance** — extracted from your bank statement, always showing the most recent value
- 📋 **AI financial health report** — auto-generated analysis of your last 30 days vs. 12-month baseline, highlighting unusual spending and trends
- 📊 **Rich charts** — area chart for cash flow, horizontal bar chart for category spending, donut chart for distribution
- ⏱️ **Flexible time ranges** — 7D / 2W / 1M / 3M / 6M / 1Y / 5Y / All, filterable per category
- 💰 **Summary cards** — total income, total expenses, net balance, savings rate

### Bank Statement Import
- 📄 **Upload PDF, CSV, or TXT** — processed entirely locally, never leaves your device
- 🤖 **Page-by-page AI extraction** — each page processed individually, no text gets cut off
- 🇩🇪 **German & English aware** — understands two-column layouts (Lasten/Gunsten), trailing minus format (`329,00-`), and German number formatting (`1.234,56`)
- 🏦 **Smart balance detection** — extracts closing balance from the statement; only updates your stored balance if the statement is more recent than the last one imported
- 🏷️ **Hybrid auto-categorization** — 200+ keyword patterns match instantly (REWE → Groceries, Deutsche Bahn → Transport); unmatched transactions go to a single AI batch call
- ✅ **Review before importing** — edit dates, amounts, types and assign categories before anything is saved

### Transactions
- ✏️ **Full manual management** — add, edit, delete any transaction
- ☑️ **Bulk delete** — select multiple transactions with checkboxes and delete in one click
- 🔍 **Search & filter** — by date range, category, type, or free text
- 🏷️ **20 built-in categories** + unlimited custom ones, each with a colour and emoji icon
- 🏪 **Merchant summary** — dedicated tab showing every merchant grouped by total spend, average, and count, with a full transaction history per merchant

### AI Assistant
- 🧠 **Configurable data window** — choose 7 days, 2 weeks, 1 month, 3 months, 6 months, or 1 year as the basis for advice
- 💬 **Streaming chat** — responses appear token by token, just like a chat app
- 🛑 **Stop generation** — cancel a response mid-stream with one click
- ✏️ **Edit past messages** — click any sent message to edit and re-run from that point
- 💾 **Persistent chat history** — all conversations are saved locally; rename or delete any chat from the sidebar
- 📊 **Grounded in your data** — the model receives your actual transaction history, category breakdown, and income/expense summary
- 🔒 **Fully local** — powered by Ollama, no API calls, no internet required

### Appearance & Personalisation
- 🎨 **Theme switcher** — Light and Dark base themes
- 🌈 **Accent colours** — 7 presets (Emerald, Blue, Purple, Orange, Red, Cyan, Pink) plus a custom hex picker with live preview
- 💾 **Persisted** — theme is saved to the local database and restored on next launch
- 👤 **User profile** — set your name for a personalised random greeting on the dashboard and assistant
- 🧠 **Personal memory** — write notes about your financial situation (goals, constraints, income) that get injected into every AI prompt

---

## Prerequisites

### 1. Node.js & npm
Download from [nodejs.org](https://nodejs.org) — **v18 or newer required**

### 2. Ollama
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows — download from https://ollama.ai/download
```

Start Ollama and pull at least one model:
```bash
ollama serve

# In a new terminal — recommended models:
ollama pull gemma3:4b       # 4B — fast, excellent quality, great default choice
ollama pull gemma3:12b      # 12B — better reasoning, good for the AI assistant
ollama pull qwen3.5:2b      # 2B — very fast, strong multilingual 
ollama pull qwen3.5:9b      # 9B — better quality
```

**Model recommendations by task and hardware:**

| Task | Low-end (8GB RAM) | Mid-range (16GB) | High-end (32GB+) |
|------|-------------------|-----------------|-----------------|
| Statement extraction | `qwen3.5:2b` | `gemma3:4b` | `gemma3:12b` |
| AI assistant | `gemma3:4b` | `gemma3:12b` | `gemma3:27b` |
| Health report | `gemma3:4b` | `gemma3:12b` | `gemma3:27b` |

> `gemma3:4b` is the recommended starting point — it handles both extraction and the assistant well on most hardware. Use `qwen3.5:2b` if you have a German bank statement and want the fastest possible extraction.

You can use a smaller model for extraction and a larger one for the assistant — they are configured independently in Settings.

---

## Installation

```bash
git clone https://github.com/your-username/openanchor.git
cd openanchor

# Installs all dependencies and automatically rebuilds
# better-sqlite3 for your Electron version
npm install

npm run dev
```

---

## Building for Distribution

```bash
npm run build:mac   # → dist-electron/*.dmg
npm run build:win   # → dist-electron/*.exe
```

---

## First-Time Setup

1. Run `npm run dev` and wait for the window to open
2. Click the **gear icon** (Settings) in the sidebar
3. Under **AI Models**, select:
   - `Extraction Model` — for parsing bank statements (smaller = faster)
   - `Assistant Model` — for the chat and health report (larger = smarter)
4. Set your **currency**
5. Optionally customise the **appearance** (theme + accent colour)
6. Go to **Import** and upload your first bank statement

---

## How Bank Statement Import Works

1. Click **Import** and upload a PDF, CSV, or TXT file
2. The file is read locally — no network request is made
3. PDFs are split page by page; each page is sent to your local Ollama model separately
4. The model extracts transactions with awareness of German and English bank statement formats
5. A second AI pass extracts the closing account balance from the statement
6. You get a **review screen** — check dates, amounts, income/expense types, assign categories
7. Click **Import** — transactions are saved to SQLite; the account balance is updated only if this statement is newer than the last one

**Tips for better results:**
- Use `llama3.2:3b` or better for extraction — very small models (1B) may miss income entries
- Text-based PDFs work best; scanned/image PDFs are not yet supported
- Always review the extracted list before importing — the AI gets most things right but isn't perfect

---

## Data Storage

All data is stored locally in a SQLite database:

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/openanchor/finance.db` |
| Windows | `%APPDATA%\openanchor\finance.db` |
| Linux | `~/.config/openanchor/finance.db` |

Back up this file by copying it anywhere. To reset the app, delete it.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | [Electron](https://electronjs.org) v29 |
| Frontend | [React](https://react.dev) 18 + [Vite](https://vitejs.dev) 5 |
| Styling | [Tailwind CSS](https://tailwindcss.com) v3 |
| Database | [SQLite](https://sqlite.org) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) v11 |
| Charts | [Recharts](https://recharts.org) |
| AI runtime | [Ollama](https://ollama.ai) — local, open-source |
| PDF parsing | [pdf-parse](https://www.npmjs.com/package/pdf-parse) |

---

## Contributing

Pull requests welcome. Priorities for future development:

- Vision model support for scanned/photographed bank statements
- Budget planning — set monthly limits per category with alerts
- Net worth tracking over time
- Multi-account support
- Export transactions to CSV or Excel
- Custom bank statement parsers for specific formats

---

## Privacy

- **Zero network requests** to any external service
- **No telemetry**, analytics, or crash reporting
- **No account required**
- Your SQLite database stays entirely on your machine
- Ollama runs AI models locally — your financial data never touches an external API

---

## License

MIT License — see [LICENSE](LICENSE) for details.
