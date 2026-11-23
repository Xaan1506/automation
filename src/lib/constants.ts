/**
 * Centralized string constants, types, and runtime validation guards
 * for SQLite-compatible status and stage values in Newton Assignment AI.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT STATUS
// ─────────────────────────────────────────────────────────────────────────────

export const SubjectStatus = {
  DISCOVERED: 'DISCOVERED',
  SCANNING: 'SCANNING',
  SCANNED: 'SCANNED',
  ERROR: 'ERROR',
} as const;

export type SubjectStatus = (typeof SubjectStatus)[keyof typeof SubjectStatus];

export const SUBJECT_STATUS_VALUES = Object.values(SubjectStatus);

export function isSubjectStatus(value: unknown): value is SubjectStatus {
  return typeof value === 'string' && SUBJECT_STATUS_VALUES.includes(value as SubjectStatus);
}

export const DEFAULT_SUBJECT_STATUS: SubjectStatus = SubjectStatus.DISCOVERED;

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENT STATUS
// ─────────────────────────────────────────────────────────────────────────────

export const AssignmentStatus = {
  NOT_PROCESSED: 'NOT_PROCESSED',
  QUESTIONS_EXTRACTED: 'QUESTIONS_EXTRACTED',
  AI_PROCESSING: 'AI_PROCESSING',
  SOLUTIONS_GENERATED: 'SOLUTIONS_GENERATED',
  VALIDATION_COMPLETED: 'VALIDATION_COMPLETED',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW',
  FAILED: 'FAILED',
} as const;

export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const ASSIGNMENT_STATUS_VALUES = Object.values(AssignmentStatus);

export function isAssignmentStatus(value: unknown): value is AssignmentStatus {
  return typeof value === 'string' && ASSIGNMENT_STATUS_VALUES.includes(value as AssignmentStatus);
}

export const DEFAULT_ASSIGNMENT_STATUS: AssignmentStatus = AssignmentStatus.NOT_PROCESSED;

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION STATUS
// ─────────────────────────────────────────────────────────────────────────────

export const QuestionStatus = {
  DISCOVERED: 'DISCOVERED',
  AI_PROCESSING: 'AI_PROCESSING',
  SOLUTION_GENERATED: 'SOLUTION_GENERATED',
  VALIDATION_IN_PROGRESS: 'VALIDATION_IN_PROGRESS',
  VALIDATED: 'VALIDATED',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW',
  FAILED: 'FAILED',
} as const;

export type QuestionStatus = (typeof QuestionStatus)[keyof typeof QuestionStatus];

export const QUESTION_STATUS_VALUES = Object.values(QuestionStatus);

export function isQuestionStatus(value: unknown): value is QuestionStatus {
  return typeof value === 'string' && QUESTION_STATUS_VALUES.includes(value as QuestionStatus);
}

export const DEFAULT_QUESTION_STATUS: QuestionStatus = QuestionStatus.DISCOVERED;

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION STATUS
// ─────────────────────────────────────────────────────────────────────────────

export const ValidationStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PASSED: 'PASSED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  ERROR: 'ERROR',
} as const;

export type ValidationStatus = (typeof ValidationStatus)[keyof typeof ValidationStatus];

export const VALIDATION_STATUS_VALUES = Object.values(ValidationStatus);

export function isValidationStatus(value: unknown): value is ValidationStatus {
  return typeof value === 'string' && VALIDATION_STATUS_VALUES.includes(value as ValidationStatus);
}

export const DEFAULT_VALIDATION_STATUS: ValidationStatus = ValidationStatus.PENDING;

// ─────────────────────────────────────────────────────────────────────────────
// BATCH STATUS
// ─────────────────────────────────────────────────────────────────────────────

export const BatchStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
} as const;

export type BatchStatus = (typeof BatchStatus)[keyof typeof BatchStatus];

export const BATCH_STATUS_VALUES = Object.values(BatchStatus);

export function isBatchStatus(value: unknown): value is BatchStatus {
  return typeof value === 'string' && BATCH_STATUS_VALUES.includes(value as BatchStatus);
}

export const DEFAULT_BATCH_STATUS: BatchStatus = BatchStatus.PENDING;

// ─────────────────────────────────────────────────────────────────────────────
// JOB STAGE
// ─────────────────────────────────────────────────────────────────────────────

export const JobStage = {
  QUEUED: 'QUEUED',
  EXTRACTING: 'EXTRACTING',
  GENERATING_SOLUTION: 'GENERATING_SOLUTION',
  GENERATING_TESTS: 'GENERATING_TESTS',
  VALIDATING: 'VALIDATING',
  SAVING: 'SAVING',
  COMPLETED: 'COMPLETED',
} as const;

export type JobStage = (typeof JobStage)[keyof typeof JobStage];

export const JOB_STAGE_VALUES = Object.values(JobStage);

export function isJobStage(value: unknown): value is JobStage {
  return typeof value === 'string' && JOB_STAGE_VALUES.includes(value as JobStage);
}

export const DEFAULT_JOB_STAGE: JobStage = JobStage.QUEUED;

// ─────────────────────────────────────────────────────────────────────────────
// JOB STATUS
// ─────────────────────────────────────────────────────────────────────────────

export const JobStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  RETRYING: 'RETRYING',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const JOB_STATUS_VALUES = Object.values(JobStatus);

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && JOB_STATUS_VALUES.includes(value as JobStatus);
}

export const DEFAULT_JOB_STATUS: JobStatus = JobStatus.PENDING;
