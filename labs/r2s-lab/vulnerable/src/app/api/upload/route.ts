import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Drain body; size doesn't matter for the lab UI.
  await req.arrayBuffer();
  return NextResponse.json({ ok: true });
}
