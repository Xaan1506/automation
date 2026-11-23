import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const [batches, jobs] = await Promise.all([
      prisma.batch.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          assignments: {
            include: {
              subject: { select: { name: true, code: true } },
              assignment: { select: { title: true } },
            },
          },
        },
      }),
      prisma.processingJob.findMany({
        where: {
          status: { in: [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED] },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: {
          question: {
            include: {
              assignment: {
                include: {
                  subject: { select: { name: true, code: true } },
                },
              },
              solutions: {
                where: { isPreferred: true },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({ batches, jobs });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
