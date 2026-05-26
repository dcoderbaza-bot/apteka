# APTEKA — Dorixona avtomatlashtirish tizimi

Node.js + SQLite + Express asosidagi apteka boshqaruv tizimi.

## Imkoniyatlar

- Admin panel (ombor, xodimlar, statistika)
- Sotuvchi POS (shtrix-kod skaner, savdo aravasi)
- Telegram bot (kirim/chiqim, statistika, Excel hisobotlar)

## O'rnatish

```bash
npm install
cp .env.example .env
# .env faylini to'ldiring
npm start
```

Brauzer: http://localhost:3000

**Default admin:** `admin` / `admin123`

## Telegram bot

1. [@Apteka_hisobot_uz_bot](https://t.me/Apteka_hisobot_uz_bot) ga `/start` yuboring
2. Tugmalar: Statistika, Kirim, Chiqim, Excel hisobotlar

## Vercel deploy va Webhook Sozlamalari

1. **Vercel**da loyihani import qiling (GitHub: `dcoderbaza-bot/apteka`)
2. **Settings → Environment Variables** bo'limida quyidagi o'zgaruvchilarni qo'shing:
   - `TELEGRAM_BOT_TOKEN` : BotFather dan olingan bot tokeni
   - `TELEGRAM_CHAT_ID` : Shaxsiy Telegram Chat ID
   - `JWT_SECRET` : Maxfiy kalit (masalan, `apteka_secure_jwt_secret_key_2026_xyz`)
3. Muhit o'zgaruvchilari kiritilgach, yangi build va deploy jarayonini boshlash uchun kodni push qiling.
4. Telegram webhookni ulash uchun brauzeringiz orqali quyidagi URLga so'rov yuboring:
   `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<Sizning-Vercel-Domen>/api/telegram-webhook`

## GitHub ga push

```bash
gh auth login
gh repo create APTEKA --public --source=. --remote=origin --push
```
