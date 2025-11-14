import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';

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

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } }
  });

  // Fire-and-forget sending
  await Promise.all(
    users.map((u) =>
      sendTelegramMessage(u.telegramId, text).catch((err) => {
        console.error('Failed to send message to', u.telegramId, err);
      })
    )
  );

  return NextResponse.json({ ok: true, sent: users.length });
}
