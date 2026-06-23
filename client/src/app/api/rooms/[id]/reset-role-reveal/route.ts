import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin()
      .from('rooms')
      .update({ roleReveal: false })
      .eq('id', id);

    if (error) {
      console.error('[reset-role-reveal]', error);
      return NextResponse.json({ error: 'Failed to reset role reveal' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[reset-role-reveal]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
