import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });

    const parsedData = settings?.data ? JSON.parse(settings.data) : {};

    return NextResponse.json({
      settings: {
        newtonEmail: process.env.NEWTON_EMAIL || parsedData.newtonEmail || "",
        newtonBaseUrl: process.env.NEWTON_BASE_URL || parsedData.newtonBaseUrl || "https://learn.newtonschool.co",
        aiModel: process.env.AI_MODEL || parsedData.aiModel || "gpt-4o",
        maxConcurrentAI: parseInt(process.env.MAX_CONCURRENT_AI || parsedData.maxConcurrentAI || "3"),
        maxConcurrentBrowser: parseInt(process.env.MAX_CONCURRENT_BROWSER || parsedData.maxConcurrentBrowser || "2"),
        maxRetries: parseInt(process.env.MAX_RETRIES || parsedData.maxRetries || "3"),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dataString = JSON.stringify(body);

    const updated = await prisma.appSettings.upsert({
      where: { id: "default" },
      create: { id: "default", data: dataString },
      update: { data: dataString },
    });

    return NextResponse.json({ success: true, settings: JSON.parse(updated.data) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
