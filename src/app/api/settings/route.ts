import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NEWTON_BASE_URL } from "@/lib/newton-config";
import { getAIModel } from "@/lib/ai-client";

const allowedSettings = [
  "newtonEmail",
  "newtonBaseUrl",
  "aiModel",
  "maxConcurrentAI",
  "maxConcurrentBrowser",
  "maxRetries",
];

export async function GET() {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });

    const storedData = settings?.data ? JSON.parse(settings.data) : {};
    const parsedData = Object.fromEntries(
      Object.entries(storedData).filter(([key]) => allowedSettings.includes(key))
    );
    if (settings && JSON.stringify(parsedData) !== settings.data) {
      await prisma.appSettings.update({
        where: { id: "default" },
        data: { data: JSON.stringify(parsedData) },
      });
    }

    return NextResponse.json({
      settings: {
        newtonEmail: process.env.NEWTON_EMAIL || parsedData.newtonEmail || "",
        newtonBaseUrl: NEWTON_BASE_URL,
        aiModel: getAIModel(),
        maxConcurrentAI: parseInt(String(process.env.MAX_CONCURRENT_AI || parsedData.maxConcurrentAI || "3"), 10),
        maxConcurrentBrowser: parseInt(String(process.env.MAX_CONCURRENT_BROWSER || parsedData.maxConcurrentBrowser || "2"), 10),
        maxRetries: parseInt(String(process.env.MAX_RETRIES || parsedData.maxRetries || "3"), 10),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Settings must be a JSON object" }, { status: 400 });
    }
    const safeSettings = Object.fromEntries(
      Object.entries(body).filter(([key]) => allowedSettings.includes(key))
    );
    const dataString = JSON.stringify(safeSettings);

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
