import { NextResponse } from 'next/server';
import { startGame, getRoom, getPlayerRole, getSaboteurs, getSMInfo } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId } = await request.json();

    if (!playerId) {
      return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });
    }

    const room = startGame(id);
    if (!room) {
      return NextResponse.json({ error: 'Cannot start game' }, { status: 400 });
    }

    // Get role info for the starting player
    const roleInfo = getPlayerRole(id, playerId);
    const saboteurs = getSaboteurs(id, playerId);
    const smInfo = getSMInfo(id, playerId);

    return NextResponse.json({
      room,
      role: roleInfo?.role,
      isGood: roleInfo?.isGood,
      saboteurIds: saboteurs,
      smId: smInfo?.smId
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
