const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.warn('TELEGRAM_BOT_TOKEN is not set');
}

const API_URL = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : '';

export async function sendTelegramMessage(chatId: number, text: string) {
  if (!TOKEN) return;
  await fetch(`${API_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });
}

export async function sendTelegramPhoto(
  chatId: number,
  photoUrl: string,
  caption?: string
) {
  if (!TOKEN) return;
  await fetch(`${API_URL}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption
    })
  });
}

/**
 * Generate QR via external API (no binary headaches)
 * Encodes provided text into QR image URL
 */
export function buildQrUrl(text: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
    text
  )}`;
}
