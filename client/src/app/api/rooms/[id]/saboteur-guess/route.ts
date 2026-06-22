import { NextResponse } from 'next/server';
import { saboteurGuess } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId, guessedSmId } = await request.json();

    if (!playerId || !guessedSmId) {
      return NextResponse.json({ error: 'Missing playerId or guessedSmId' }, { status: 400 });
    }

    const result = saboteurGuess(id, playerId, guessedSmId);

    if (!result) {
      return NextResponse.json({ error: 'Cannot guess' }, { status: 400 });
    }

    return NextResponse.json({ winner: result.winner, correct: result.correct });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
