import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.userIds) || typeof body.text !== 'string') {
    return NextResponse.json(
      { error: 'userIds (number[]) and text (string) are required' },
      { status: 400 }
    );
  }

  const userIds: number[] = body.userIds;
  const text: string = body.text.trim();

  if (!text) {
    return NextResponse.json(
      { error: 'Message text cannot be empty' },
      { status: 400 }
    );
  }

  if (userIds.length === 0) {
    return NextResponse.json(
      { error: 'No users selected' },
      { status: 400 }
    );
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } }
  });

  await Promise.all(
    users.map((u) =>
      sendTelegramMessage(u.telegramId, text).catch((err) => {
        console.error('Failed to send message to', u.telegramId, err);
      })
    )
  );

  return NextResponse.json({ ok: true, sent: users.length });
}
