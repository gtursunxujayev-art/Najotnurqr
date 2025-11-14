import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildQrUrl,
  sendTelegramMessage,
  sendTelegramPhoto
} from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  // 1) Parse update & basic fields FIRST (no Prisma here)
  let update: any;
  try {
    update = await req.json();
  } catch (e) {
    console.error('Failed to parse Telegram update JSON:', e);
    return NextResponse.json({ ok: true });
  }

  console.log('Telegram update:', JSON.stringify(update, null, 2));

  const message = update.message ?? update.edited_message;
  if (!message) {
    // Ignore non-message updates
    return NextResponse.json({ ok: true });
  }

  const chat = message.chat;
  const from = message.from;

  if (!chat || !from || !chat.id) {
    console.log('Missing chat or from in update');
    return NextResponse.json({ ok: true });
  }

  const chatId: number = chat.id;
  const telegramId: number = from.id;
  const username: string | null = from.username ?? null;
  const textRaw: string = (message.text ?? '').trim();

  // 2) Now Prisma + business logic WITHIN a try/catch
  try {
    // --- /start: reset flow ---
    if (textRaw === '/start') {
      let user = await prisma.user.findUnique({
        where: { telegramId }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            telegramId,
            username,
            name: '',
            phone: '',
            job: '',
            step: 'ASK_NAME'
          }
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            username,
            name: '',
            phone: '',
            job: '',
            step: 'ASK_NAME'
          }
        });
      }

      await sendTelegramMessage(
        chatId,
        "Assalomu alaykum! Ismingizni kiriting:"
      );
      return NextResponse.json({ ok: true });
    }

    // --- ensure user exists ---
    let user = await prisma.user.findUnique({
      where: { telegramId }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId,
          username,
          name: '',
          phone: '',
          job: '',
          step: 'ASK_NAME'
        }
      });

      await sendTelegramMessage(
        chatId,
        "Assalomu alaykum! Ismingizni kiriting:"
      );
      return NextResponse.json({ ok: true });
    }

    // keep username fresh
    if (user.username !== username) {
      await prisma.user.update({
        where: { id: user.id },
        data: { username }
      });
    }

    const text = textRaw;

    switch (user.step) {
      case 'ASK_NAME': {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name: text, step: 'ASK_PHONE' }
        });

        await sendTelegramMessage(
          chatId,
          "Telefon raqamingizni kiriting (masalan: +99890xxxxxxx):"
        );
        break;
      }

      case 'ASK_PHONE': {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { phone: text, step: 'ASK_JOB' }
        });

        await sendTelegramMessage(
          chatId,
          'Kasbingiz yoki nima ish qilishingizni yozing:'
        );
        break;
      }

      case 'ASK_JOB': {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { job: text, step: 'DONE' }
        });

        const qrText = `${user.name} | ${user.phone}`;
        const qrUrl = buildQrUrl(qrText);

        await sendTelegramMessage(
          chatId,
