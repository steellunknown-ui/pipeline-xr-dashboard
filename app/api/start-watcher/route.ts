import { NextResponse } from "next/server";

// Watcher functionality has been moved to individual deployment handlers
// This endpoint is kept for backwards compatibility

export async function GET() {
  return NextResponse.json({ status: "Watcher running (stub)" });
}