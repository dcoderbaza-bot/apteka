import sqlite3
import pandas as pd
import io
import os
from aiogram import Bot, Dispatcher, executor, types

# 1. Tokeningizni shu yerga yozing
API_TOKEN = '8325874677:AAHHKMxUK78cOHfNUWma7nL6B5IIPHUlPCo'

bot = Bot(token=API_TOKEN)
dp = Dispatcher(bot)

def fetch_and_generate_excel(report_type):
    # database.db fayli shu papkada bo'lishi shart
    conn = sqlite3.connect('database.db')
    
    # Jadval nomlarini o'zingiznikiga moslab o'zgartiring
    if report_type == 'sales':
        query = "SELECT * FROM sales" 
        filename = "Sotuvlar_Hisoboti.xlsx"
    else:
        query = "SELECT * FROM inventory" 
        filename = "Ombor_Zaxira_Hisoboti.xlsx"
        
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    output = io.BytesIO()
    df.to_excel(output, index=False, engine='openpyxl')
    output.seek(0)
    
    return output, filename

@dp.message_handler(commands=['sales', 'inventory'])
async def handle_reports(message: types.Message):
    report_type = 'sales' if message.text == '/sales' else 'inventory'
    excel_file, filename = fetch_and_generate_excel(report_type)
    
    await bot.send_document(
        message.chat.id, 
        document=types.InputFile(excel_file, filename=filename),
        caption=f"✅ {filename} tayyor!"
    )

if __name__ == '__main__':
    print("Bot ishga tushmoqda...")
    executor.start_polling(dp, skip_updates=True)