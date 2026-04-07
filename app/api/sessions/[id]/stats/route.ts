import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/schema';
import { getSessionStats } from '@/lib/journal-stats';

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: Props) {
  await ensureSchema();
  const { id } = await params;
  const stats = await getSessionStats(id);
  return NextResponse.json(stats);
}
