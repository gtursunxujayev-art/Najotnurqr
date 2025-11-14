import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  buildQrUrl,
  sendTelegramMessage,
  sendTelegramPhoto
} from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Helper: duplicate bo'lsa ham userni qaytaradi
 */
async function getOrCreateUser(telegramId: number, username: string | null) {
  // Avval borini izlaymiz
  let existing = await prisma.user.findUnique({
    where: { telegramId }
  });
  if (existing) return existing;

  // Yo'q bo'lsa – yaratishga harakat qilamiz
  try {
    const created = await prisma.user.create({
      data: {
        telegramId,
        username,
        name: '',
        phone: '',
        job: '',
        step: 'ASK_NAME'
      }
    });
    return created;
  } catch (err: any) {
    // Agar shu payt boshqa request yaratib bo'lsa (P2002) – qayta o'qiymiz
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const again = await prisma.user.findUnique({
        where: { telegramId }
      });
      if (again) return again;
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  // 1) Update ni parse qilish
  let update: any;
  try {
    update = await req.json();
  } catch (e) {
    console.error('Failed to parse Telegram update JSON:', e);
    return NextResponse.json({ ok: true });
  }

  console.log('Telegram update:', JSON.stringify(update, null, 2));

  const message = update.message ?? update.edited_message;
  if (!message) return NextResponse.json({ ok: true });

  const chat = message.chat;
  const from = message.from;

  if (!chat || !from || !chat.id) {
    console.log('Missing chat/from', { chat, from });
    return NextResponse.json({ ok: true });
  }

  const chatId: number = chat.id;
  const telegramId: number = from.id;
  const username: string | null = from.username ?? null;
  const textRaw: string = typeof message.text === 'string' ? message.text.trim() : '';

  try {
    // =====================================================
    // /start → har doim flow boshlanishini tozalaydi
    // =====================================================
    if (textRaw === '/start') {
      let user = await prisma.user.findUnique({ where: { telegramId } });

      if (user) {
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
      } else {
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
      }

      await sendTelegramMessage(
        chatId,
        "Assalomu alaykum! Ismingizni kiriting (faqat matn):"
      );
      return NextResponse.json({ ok: true });
    }

    // =====================================================
    // Userni olish / yaratish (parallel requestlarga chidamli)
    // =====================================================
    let user = await getOrCreateUser(telegramId, username);

    // Username o'zgargan bo'lsa – yangilab qo'yamiz (lekin xatoga sabab bo'lmaydi)
    if (user.username !== username) {
      try {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { username }
        });
      } catch (e) {
        console.warn('Failed to update username', e);
      }
    }

    const text = textRaw;

    // Agar text bo'lmasa (sticker, foto, contact) – izoh berib, stepni o'zgartirmaymiz
    if (!text) {
      await sendTelegramMessage(
        chatId,
        'Iltimos, faqat matn yuboring. Boshlash uchun /start, yoki davom ettirish uchun matn kiriting.'
      );
      return NextResponse.json({ ok: true });
    }

    // =====================================================
    // Step-by-step flow
    // =====================================================
    switch (user.step) {
      case 'ASK_NAME': {
        // Juda uzun bo'lsa ham xatoga olib kelmaydi, faqat biroz kesish mumkin edi – hozircha to'g'ridan yozamiz
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name: text, step: 'ASK_PHONE' }
        });

        await sendTelegramMessage(
          chatId,
          "Telefon raqamingizni kiriting (masalan: +99890xxxxxxx, faqat matn):"
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

        // Google Sheets + skaner uchun ideal format:
        // Faqat bitta qator, vergul bilan ajratilgan
        const qrText = `${user.name},${user.phone}`;
        const qrUrl = buildQrUrl(qrText);

        await sendTelegramMessage(
          chatId,
          'Rahmat! Mana sizning QR-kodingiz:'
        );
        await sendTelegramPhoto(
          chatId,
          qrUrl,
          `QR matni:\n${qrText}`
        );
        break;
      }

      case 'DONE': {
        await sendTelegramMessage(
          chatId,
          "Siz allaqachon roʻyxatdan oʻtgansiz. Qayta boshlash uchun /start yuboring."
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
    console.error('Prisma / bot logic error:', err);
    await sendTelegramMessage(
      chatId,
      "Serverda xatolik yuz berdi 😔 Iltimos, birozdan so'ng qayta urinib ko'ring."
    );
    return NextResponse.json({ ok: true });
  }
}
