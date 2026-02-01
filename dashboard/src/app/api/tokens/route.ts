import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/tokens`, {
      headers: { 'X-User-Id': userId },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json({ tokens: [] });
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { token } = await request.json();
    
    const response = await fetch(`${API_URL}/api/auth/token`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-Id': userId,
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error revoking token:', error);
    return NextResponse.json({ error: 'Failed to revoke' }, { status: 500 });
  }
}
