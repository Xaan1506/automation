import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function main() {
  console.log("Seeding test data conforming to Newton School discovery specification...");

  // 1. Advanced Software Development (ASD)
  const asd = await prisma.subject.upsert({
    where: { externalId: "course-asd-101" },
    create: {
      externalId: "course-asd-101",
      name: "Advanced Software Development",
      code: "ASD",
      courseUrl: "https://learn.newtonschool.co/course/course-asd-101",
      description: "Advanced concepts in software architecture, design patterns, testing, and modern scalable systems.",
      discoveryStatus: "SCANNED",
      lastScannedAt: new Date(),
      stats: {
        create: {
          assignmentsCount: 2,
          questionsCount: 4,
          solutionsGenerated: 2,
          validationPassed: 2,
          pendingReview: 0,
          failed: 0,
        },
      },
    },
    update: {},
  });

  // 2. Data Engineering (DE)
  const de = await prisma.subject.upsert({
    where: { externalId: "course-de-201" },
    create: {
      externalId: "course-de-201",
      name: "Data Engineering",
      code: "DE",
      courseUrl: "https://learn.newtonschool.co/course/course-de-201",
      description: "Big data processing, pipelines, distributed data systems, and ETL design.",
      discoveryStatus: "SCANNED",
      lastScannedAt: new Date(),
      stats: {
        create: {
          assignmentsCount: 1,
          questionsCount: 2,
          solutionsGenerated: 1,
          validationPassed: 1,
          pendingReview: 0,
          failed: 0,
        },
      },
    },
    update: {},
  });

  // 3. Algorithms and Data Structures (ADA)
  const ada = await prisma.subject.upsert({
    where: { externalId: "course-ada-301" },
    create: {
      externalId: "course-ada-301",
      name: "Algorithms and Data Structures",
      code: "ADA",
      courseUrl: "https://learn.newtonschool.co/course/course-ada-301",
      description: "Asymptotic analysis, trees, dynamic programming, graph algorithms.",
      discoveryStatus: "SCANNED",
      lastScannedAt: new Date(),
      stats: {
        create: {
          assignmentsCount: 1,
          questionsCount: 2,
          solutionsGenerated: 0,
          validationPassed: 0,
          pendingReview: 0,
          failed: 0,
        },
      },
    },
    update: {},
  });

  // 4. Mathematics 3
  const math3 = await prisma.subject.upsert({
    where: { externalId: "course-math-401" },
    create: {
      externalId: "course-math-401",
      name: "Mathematics 3",
      code: "MATH3",
      courseUrl: "https://learn.newtonschool.co/course/course-math-401",
      description: "Linear algebra, probability, discrete structures, and numerical methods.",
      discoveryStatus: "DISCOVERED",
      lastScannedAt: new Date(),
      stats: {
        create: {
          assignmentsCount: 0,
          questionsCount: 0,
          solutionsGenerated: 0,
          validationPassed: 0,
          pendingReview: 0,
          failed: 0,
        },
      },
    },
    update: {},
  });

  // Assignments for ASD
  const asdAssign1 = await prisma.assignment.upsert({
    where: {
      subjectId_externalId: {
        subjectId: asd.id,
        externalId: "asd-assign-01",
      },
    },
    create: {
      externalId: "asd-assign-01",
      subjectId: asd.id,
      title: "ASD Assignment 1 - Design Patterns & Concurrency",
      assignmentUrl: "https://learn.newtonschool.co/assignment/asd-assign-01",
      description: "Implementing thread-safe singleton, producer-consumer queue, and observer patterns.",
      processingStatus: "VALIDATION_COMPLETED",
      lastProcessedAt: new Date(),
    },
    update: {},
  });

  const asdAssign2 = await prisma.assignment.upsert({
    where: {
      subjectId_externalId: {
        subjectId: asd.id,
        externalId: "asd-assign-02",
      },
    },
    create: {
      externalId: "asd-assign-02",
      subjectId: asd.id,
      title: "ASD Assignment 2 - Microservice Pipeline",
      assignmentUrl: "https://learn.newtonschool.co/assignment/asd-assign-02",
      description: "Building event-driven messaging with backpressure management.",
      processingStatus: "QUESTIONS_EXTRACTED",
    },
    update: {},
  });

  // Assignment for DE
  const deAssign1 = await prisma.assignment.upsert({
    where: {
      subjectId_externalId: {
        subjectId: de.id,
        externalId: "de-assign-03",
      },
    },
    create: {
      externalId: "de-assign-03",
      subjectId: de.id,
      title: "DE Assignment 3 - Stream Aggregator",
      assignmentUrl: "https://learn.newtonschool.co/assignment/de-assign-03",
      description: "Sliding window aggregation over telemetry logs.",
      processingStatus: "VALIDATION_COMPLETED",
      lastProcessedAt: new Date(),
    },
    update: {},
  });

  // Assignment for ADA
  const adaAssign1 = await prisma.assignment.upsert({
    where: {
      subjectId_externalId: {
        subjectId: ada.id,
        externalId: "ada-assign-01",
      },
    },
    create: {
      externalId: "ada-assign-01",
      subjectId: ada.id,
      title: "ADA Assignment 1 - Shortest Paths with Roadblocks",
      assignmentUrl: "https://learn.newtonschool.co/assignment/ada-assign-01",
      description: "Modified Dijkstra algorithm with time-dependent vertex weights.",
      processingStatus: "NOT_PROCESSED",
    },
    update: {},
  });

  // Questions for ASD Assignment 1
  const q1Desc = "Design a bounded thread-safe concurrent queue supporting enqueue, dequeue, and size operations.";
  const q1 = await prisma.question.upsert({
    where: {
      assignmentId_externalId: {
        assignmentId: asdAssign1.id,
        externalId: "asd-q-101",
      },
    },
    create: {
      externalId: "asd-q-101",
      assignmentId: asdAssign1.id,
      title: "Thread-Safe Bounded Queue",
      description: q1Desc,
      contentHash: hashContent(q1Desc + "Thread-Safe Bounded Queue"),
      language: "python",
      difficulty: "Medium",
      questionUrl: "https://learn.newtonschool.co/question/asd-q-101",
      processingStatus: "VALIDATED",
      lastProcessedAt: new Date(),
    },
    update: {},
  });

  await prisma.solution.create({
    data: {
      questionId: q1.id,
      language: "python",
      isPreferred: true,
      timeComplexity: "O(1)",
      spaceComplexity: "O(N)",
      validationStatus: "PASSED",
      passedTestCases: 3,
      totalTestCases: 3,
      explanation: "Uses threading.Condition for efficient waiting without busy loops.",
      code: `import threading

class BoundedQueue:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.queue = []
        self.lock = threading.Lock()
        self.not_full = threading.Condition(self.lock)
        self.not_empty = threading.Condition(self.lock)

    def enqueue(self, item) -> None:
        with self.not_full:
            while len(self.queue) >= self.capacity:
                self.not_full.wait()
            self.queue.append(item)
            self.not_empty.notify()

    def dequeue(self):
        with self.not_empty:
            while not self.queue:
                self.not_empty.wait()
            item = self.queue.pop(0)
            self.not_full.notify()
            return item`,
    },
  });

  await prisma.testCase.createMany({
    data: [
      { questionId: q1.id, input: "enqueue(1), enqueue(2), dequeue()", expected: "1", isPublic: true, source: "newton" },
      { questionId: q1.id, input: "enqueue(10), size()", expected: "1", isPublic: false, source: "ai" },
      { questionId: q1.id, input: "capacity full block test", expected: "block verified", isPublic: false, source: "ai" },
    ],
  });

  console.log("Seeding complete! 4 subjects, 4 assignments, questions and solutions created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
