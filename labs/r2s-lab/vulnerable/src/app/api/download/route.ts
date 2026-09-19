import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const mb = Math.min(8, Math.max(1, Number(req.nextUrl.searchParams.get("mb") || "1")));
  const bytes = mb * 1024 * 1024;
  const buf = Buffer.alloc(bytes, 0x61);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "Content-Length": String(bytes),
    },
  });
}
