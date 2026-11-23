# Newton Assignment AI

An intelligent, multi-subject batch processing and assignment solving platform for **Newton School** students.

---

## 🌟 Key Features

### 1. Subject Discovery
- **Dynamic Course Scraping**: Authenticates with Newton School (`https://learn.newtonschool.co`) using direct credentials or imported browser session cookies.
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
NEWTON_EMAIL="your_email@newtonschool.co"
NEWTON_PASSWORD="your_password"
NEWTON_BASE_URL="https://learn.newtonschool.co"
OPENAI_API_KEY="sk-..."
AI_MODEL="gpt-4o"
DATABASE_URL="file:./dev.db"
```

### 3. Initialize Database
```bash
npm run db:push
npm run db:seed  # Seeds initial test subjects (ASD, DE, ADA, Mathematics 3)
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing the ASD Scenario

1. Navigate to **Subjects** (`/subjects`).
2. Verify **Advanced Software Development (ASD)** is displayed with its metrics.
3. Select ASD (or use *Select All*).
4. Click **View Assignments** (`/assignments`) to review available assignments.
5. Select an assignment (e.g., `ASD Assignment 1`).
6. Click **Create Batch** (`/batch/new`).
7. Review the batch summary and confirm execution.
8. Monitor real-time status in the **Processing Queue** (`/queue`).
9. Inspect code drafts, time complexities, and test results in **AI Solutions** (`/solutions`).
