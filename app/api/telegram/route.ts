import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildQrUrl, sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    console.log('Telegram update:', JSON.stringify(update, null, 2));

    const message = update.message ?? update.edited_message;
    if (!message) {
      // Ignore non-message updates (like my_chat_member etc.)
      return NextResponse.json({ ok: true });
    }

    const chat = message.chat;
    const from = message.from;

    if (!chat || !from) {
      console.log('No chat/from in update');
      return NextResponse.json({ ok: true });
    }

    const chatId: number = chat.id;
    const telegramId: number = from.id;
    const username: string | null = from.username ?? null;
    const textRaw: string = (message.text ?? '').trim();

    // /start always resets flow
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
        'Assalomu alaykum! Ismingizni kiriting:'
      );
      return NextResponse.json({ ok: true });
    }

    // Ensure user exists
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
        'Assalomu alaykum! Ismingizni kiriting:'
      );
      return NextResponse.json({ ok: true });
    }

    // Keep username fresh
    if (user.username !== username) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { username }
      });
    }

    const text = textRaw;

    switch (user.step) {
      case 'ASK_NAME': {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: text,
            step: 'ASK_PHONE'
          }
        });

        await sendTelegramMessage(
          chatId,
          'Telefon raqamingizni kiriting (masalan: +99890xxxxxxx):'
        );

        break;
      }

      case 'ASK_PHONE': {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            phone: text,
            step: 'ASK_JOB'
          }
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
          data: {
            job: text,
            step: 'DONE'
          }
        });

        const qrText = `${user.name} | ${user.phone}`;
        const qrUrl = buildQrUrl(qrText);

        await sendTelegramMessage(chatId, 'Rahmat! Mana sizning QR-kodingiz:');
        await sendTelegramPhoto(
          chatId,
          qrUrl,
          `QR ichidagi maʼlumot: ${user.name} | ${user.phone}`
        );

        break;
      }

      case 'DONE': {
        await sendTelegramMessage(
          chatId,
          'Siz allaqachon roʻyxatdan oʻtgansiz. Qayta kiritish uchun /start buyrugʻini yuboring.'
        );
        break;
      }

      default: {
        await sendTelegramMessage(
          chatId,
          'Boshlash uchun /start buyrugʻini yuboring.'
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    // Always return 200 so Telegram doesn’t spam retries
    return NextResponse.json({ ok: true });
  }
}
