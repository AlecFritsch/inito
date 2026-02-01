import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_URL}/api/runs/${params.id}`, {
      headers: {
        'X-User-Id': userId,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }
      throw new Error('Failed to fetch run');
    }

    const run = await response.json();
    return NextResponse.json(run);
  } catch (error) {
    console.error('Error fetching run:', error);
    return NextResponse.json({ error: 'Failed to fetch run' }, { status: 500 });
  }
}
