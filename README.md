# Newton Assignment AI

An intelligent, multi-subject batch processing and assignment solving platform for **Newton School** students.

---

## 🌟 Key Features

### 1. Subject Discovery
- **Dynamic Course Scraping**: Authenticates with Newton School (`https://my.newtonschool.co`) through a visible browser session, including Newton-managed SSO and 2FA.
- **Subject Persistence**: Stores courses with unique IDs, course URLs, descriptions, assignment counts, question counts, discovery statuses, and last scanned timestamps.
- **Initial Test Subject**: *Advanced Software Development (ASD)* is fully supported and dynamically extracted (not hardcoded). Also supports *Data Engineering (DE)*, *Algorithms and Data Structures (ADA)*, *Mathematics 3*, and any user-enrolled course.

### 2. Subject Selection Interface (`/subjects`)
- Visual card grid displaying:
  - Subject name & code (e.g. ASD, DE, ADA)
  - Assignments & questions count
  - Last scanned timestamp
  - Discovery & scan status
  - Selection checkboxes
- **Full selection controls**: Select single, multiple, or all subjects; deselect all; search by name; filter by status; and rescan individual courses.
- **Persistent selections**: Subject and assignment selections survive page refreshes via client-side Zustand store with local storage sync.

### 3. Assignment Selection (`/assignments`)
- Select individual assignments, all assignments in a subject, or across multiple subjects.
- Search and filter by status:
  - `NOT_PROCESSED` (White)
  - `QUESTIONS_EXTRACTED` (Blue)
  - `AI_PROCESSING` (Yellow)
  - `SOLUTIONS_GENERATED` (Purple)
  - `VALIDATION_COMPLETED` (Green)
  - `REQUIRES_REVIEW` (Orange)
  - `FAILED` (Red)
- **Safe processing guard**: Assignments are never marked completed merely because their questions were extracted.

### 4. Multi-Subject Batch Processing (`/batch` & `/batch/new`)
- **Step 1**: Select subjects (e.g. ASD + DE + ADA).
- **Step 2**: Display assignments belonging to selected subjects & select target assignments.
- **Step 3**: Configure & inspect processing summary (selected subjects, assignment count, question counts, estimated AI tokens).
- **Step 4**: Confirm and trigger batch execution.
- **Full lifecycle controls**: Start, Pause, Resume, Cancel, and Retry failed jobs.

### 5. Resilient Processing Queue (`/queue`)
- Real-time job tracking showing Subject, Assignment, Question, Pipeline Stage, Execution Time, and Retry count.
- **Concurrency controls**:
  - Configurable AI concurrency (default: 3)
  - Configurable browser tasks (default: 2)
  - Exponential backoff with jitter (default: up to 3 retries)
- **Deduplication**: Content hashing (SHA-256) on problem statements prevents duplicate processing and redundant token usage.

### 6. AI Solution Generation & Isolated Code Validation (`/solutions`)
- Generates optimal code in Python/JavaScript/Java with step-by-step reasoning and Big-O complexity analysis.
- Automatically generates diverse edge cases and stress test cases.
- Validates execution against public test cases and AI-generated test suites.
- Results retain exact Subject and Assignment lineage for filtering and auditing.

### 7. Read-Only Browser Agent (`/agent`)
- Accepts natural-language instructions and plans only from section/question labels visible in the authenticated Newton UI.
- Reuses the encrypted Playwright session and existing visible-page scanner to navigate sections, open questions, extract visible statements, and return to assignment groups.
- Shows verified action history, current URL/section/assignment, progress, and a live screenshot; supports pause, resume, and cancel.
- Screenshots remain local to the app and are not sent to the AI planner. The planner receives only the task and sanitized visible labels.
- No hidden tests, restricted endpoints, assignment edits, or submissions are available to the agent.

---

## 🗄️ Database Architecture (Prisma + SQLite)

```
Subject
  ├── SubjectStats (1-to-1 dynamic metrics)
  └── Assignment (1-to-many)
        ├── BatchAssignment (many-to-many with Batch)
        └── Question (1-to-many)
              ├── Solution (1-to-many with validation results)
              ├── TestCase (1-to-many with public & AI cases)
              └── ProcessingJob (1-to-many queue jobs)

Batch
  ├── BatchAssignment (many-to-many with Assignment)
  └── ProcessingJob (1-to-many)

AgentTask
  └── AgentAction (1-to-many verified read-only browser actions)
```

---

## 🚀 Quickstart Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env.local`:
```env
NEWTON_BASE_URL="https://my.newtonschool.co"
NEWTON_COURSE_URL="https://my.newtonschool.co/course/<course-id>/details"
NEWTON_LOGIN_URL="https://my.newtonschool.co/login"
AI_PROVIDER="groq"
GROQ_API_KEY="gsk_..."
AI_MODEL="llama-3.3-70b-versatile"
DATABASE_URL="file:./dev.db"
```

Groq uses its OpenAI-compatible endpoint automatically. For OpenAI, set
`AI_PROVIDER="openai"` and `OPENAI_API_KEY`; API keys belong in the environment file
and are not stored in the application database. The default Groq model is
`llama-3.3-70b-versatile`.

Newton sign-in is completed manually in a visible Chromium browser. The app does not collect
Newton passwords or import pasted cookies. After you land on your Newton courses or dashboard,
use **Verify Newton Session** to check the authenticated page before saving the session. The
Playwright storage state is encrypted in the database with a local 32-byte key stored in
`.newton-session-key` (file mode `0600`, excluded from Git). Install Chromium once with
`npx playwright install chromium` if needed. `NEWTON_LOGIN_URL` is the Newton sign-in page (`/login`);
`NEWTON_COURSE_URL` is the enrolled course dashboard opened after authentication and used for
section discovery. Keep these URLs separate when configuring a different Newton sign-in entry.

### 3. Initialize Database
```bash
npm run db:push
npm run db:seed  # Intentionally does not create synthetic assignment data
```
Discover real sections from the authenticated Newton portal through `/subjects`.

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing the ASD Scenario

1. Sign in through the visible Newton browser and verify the saved session.
2. Discover sections at **Subjects** (`/subjects`) if they are not already listed.
3. Open **Browser Agent** (`/agent`) and submit:
   `Open ASD - Hopper, find all assignment groups, open each coding question, extract the visible problem statements and organise them by assignment.`
4. Review the live screenshot, verified action history, and completion counts.
5. Confirm the results in **Assignments** (`/assignments`) and **Question Bank** (`/questions`).
