import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  QuestionStatus,
  ValidationStatus,
  BatchStatus,
  JobStatus,
} from '@/lib/constants';

/**
 * GET /api/stats - Dashboard statistics
 */
export async function GET(_request: NextRequest) {
  try {
    const [
      totalSubjects,
      totalAssignments,
      totalQuestions,
      processedQuestions,
      solutionsGenerated,
      validationPassed,
      activeBatches,
      pendingJobs,
    ] = await Promise.all([
      prisma.subject.count(),
      prisma.assignment.count(),
      prisma.question.count(),
      prisma.question.count({
        where: {
          processingStatus: {
            in: [
              QuestionStatus.SOLUTION_GENERATED,
              QuestionStatus.VALIDATED,
              QuestionStatus.REQUIRES_REVIEW,
            ],
          },
        },
      }),
      prisma.solution.count({ where: { isPreferred: true } }),
      prisma.solution.count({
        where: { isPreferred: true, validationStatus: ValidationStatus.PASSED },
      }),
      prisma.batch.count({
        where: { status: { in: [BatchStatus.RUNNING, BatchStatus.PAUSED] } },
      }),
      prisma.processingJob.count({
        where: {
          status: { in: [JobStatus.PENDING, JobStatus.RUNNING, JobStatus.RETRYING] },
        },
      }),
    ]);

    const subjectStats = await prisma.subjectStats.findMany({
      include: { subject: { select: { name: true, code: true } } },
      orderBy: { questionsCount: 'desc' },
    });

    return NextResponse.json({
      overview: {
        totalSubjects,
        totalAssignments,
        totalQuestions,
        processedQuestions,
        solutionsGenerated,
        validationPassed,
        activeBatches,
        pendingJobs,
      },
      subjectStats,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
