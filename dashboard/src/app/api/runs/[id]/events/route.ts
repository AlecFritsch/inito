import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const response = await fetch(`${API_URL}/api/runs/${id}/events`, {
      headers: {
        'X-User-Id': userId,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ events: [] });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching run events:', error);
    return NextResponse.json({ events: [] });
  }
}
