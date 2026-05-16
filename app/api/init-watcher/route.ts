import { NextResponse } from "next/server";

export async function POST() {
  // Watcher functionality has been moved to individual deployment handlers
  // This endpoint is kept for backwards compatibility
  return NextResponse.json({ success: true, message: "Watcher initialized (stub)" });
}