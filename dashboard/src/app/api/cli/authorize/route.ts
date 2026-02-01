import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userCode } = await request.json();

    if (!userCode) {
      return NextResponse.json({ error: 'Code required' }, { status: 400 });
    }

    // Forward to API to authorize the device code
    const response = await fetch(`${API_URL}/api/auth/device/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCode, userId }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ 
      success: false, 
      error: result.error || 'Invalid or expired code' 
    });
  } catch (error) {
    console.error('Error authorizing CLI:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
