import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    console.log('Telegram update:', JSON.stringify(update, null, 2));

    const message = update.message ?? update.edited_message;
    if (!message) {
      // Ignore non-message updates
      return NextResponse.json({ ok: true });
    }

    const chat = message.chat;
    const text = (message.text ?? '').trim();

    if (!chat || !chat.id) {
      console.log('No chat id in message');
      return NextResponse.json({ ok: true });
    }

    const chatId = chat.id;

    // Simple reply just to test webhook
    const reply =
      text === '/start'
        ? "Assalomu alaykum! Bot ishlayapti ✅ Ismingizni yozib ko'ring."
        : `Bot ishlayapti ✅ Siz yozdingiz: "${text}"`;

    await sendTelegramMessage(chatId, reply);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    // Always respond 200 so Telegram doesn't spam retries
    return NextResponse.json({ ok: true });
  }
}
