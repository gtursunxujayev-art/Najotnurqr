const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.warn('TELEGRAM_BOT_TOKEN is not set');
}

const API_URL = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : '';

export async function sendTelegramMessage(chatId: number | string, text: string) {
  if (!TOKEN || !API_URL) {
    console.error('Cannot sendTelegramMessage: TOKEN is missing');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram sendMessage error:', data);
    }
  } catch (e) {
    console.error('Telegram sendMessage fetch error:', e);
  }
}

export function buildQrUrl(text: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
    text
  )}`;
}
