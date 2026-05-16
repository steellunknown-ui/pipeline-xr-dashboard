import { NextRequest, NextResponse } from 'next/server';
import { initializeDeploymentEngine } from '@/lib/deployment-engine';

export async function POST(req: NextRequest) {
  try {
    await initializeDeploymentEngine();
    return NextResponse.json({ success: true, message: 'Deployment engine initialized' });
  } catch (error) {
    console.error('Engine initialization error:', error);
    return NextResponse.json({ success: false, error: 'Failed to initialize engine' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Deployment engine ready' });
}