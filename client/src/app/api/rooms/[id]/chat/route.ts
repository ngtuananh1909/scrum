import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getRoom } from '@/lib/store';
import { isSilenced } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET last 100 messages (oldest first) — used to backfill before Realtime attaches.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin()
      .from('messages')
      .select('*')
      .eq('room_id', id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[chat GET]', error);
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    return NextResponse.json({ messages: data || [] });
  } catch (error) {
    console.error('[chat GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST a new message. Validates length 1-500. Realtime broadcasts the insert to all subscribers.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerId, playerName, text } = await request.json();

    if (!playerId || !playerName || !text) {
      return NextResponse.json(
        { error: 'Missing playerId, playerName, or text' },
        { status: 400 }
      );
    }

    const trimmed = String(text).trim();
    if (trimmed.length < 1 || trimmed.length > 500) {
      return NextResponse.json({ error: 'Message must be 1-500 characters' }, { status: 400 });
    }

    const room = await getRoom(id);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    if (!room.players.some((player) => player.id === playerId)) {
      return NextResponse.json({ error: 'Player is not in this room' }, { status: 403 });
    }
    const silenceApplies = room.phase === 'planning' || room.phase === 'teamVoting';
    if (silenceApplies && isSilenced(room, playerId)) {
      return NextResponse.json({ error: 'You are silenced for this Sprint planning' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin()
      .from('messages')
      .insert({
        room_id: id,
        player_id: playerId,
        player_name: playerName.slice(0, 40),
        text: trimmed,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[chat POST]', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({ message: data });
  } catch (error) {
    console.error('[chat POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
