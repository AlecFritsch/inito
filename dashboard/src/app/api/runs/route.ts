import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '50';
  const repo = searchParams.get('repo');

  try {
    const url = repo 
      ? `${API_URL}/api/runs?limit=${limit}&repo=${repo}`
      : `${API_URL}/api/runs?limit=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        'X-User-Id': userId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch runs');
    }

    const runs = await response.json();
    return NextResponse.json(runs);
  } catch (error) {
    console.error('Error fetching runs:', error);
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    const response = await fetch(`${API_URL}/api/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating run:', error);
    return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
  }
}
