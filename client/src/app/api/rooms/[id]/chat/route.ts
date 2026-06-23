import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

    // Confirm room exists so we don't accept chat into the void.
    const { data: room } = await supabaseAdmin()
      .from('rooms')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
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
