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

## GitHub ga push

```bash
gh auth login
gh repo create APTEKA --public --source=. --remote=origin --push
```
