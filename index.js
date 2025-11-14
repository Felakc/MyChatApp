// index.js (Сервер с Историей и Приватными Сообщениями)

// --- A. Инициализация Модулей и БД ---
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const mongoose = require('mongoose'); 

// 🚨🚨🚨 ВАЖНО: ВСТАВЬТЕ СЮДА ВАШУ СТРОКУ ПОДКЛЮЧЕНИЯ ИЗ MONGODB ATLAS 🚨🚨🚨
// Пример: const dbURI = 'mongodb+srv://chatuser:ВАШ_ПАРОЛЬ@cluster0.abcde.mongodb.net/chat_db';
const dbURI = 'mongodb+srv://felak:Felak22113d@chatdb.sf9erka.mongodb.net/chat_db';

mongoose.connect(dbURI)
  .then(() => console.log('Подключение к MongoDB установлено'))
  .catch(err => console.error('Ошибка подключения к MongoDB:', err));

// Схема для сохранения сообщений
const Message = mongoose.model('Message', new mongoose.Schema({
  msg: String,
  timestamp: { type: Date, default: Date.now }
}));


const PORT = process.env.PORT || 3000;
// Используем Map для хранения связи между именем пользователя и его ID сокета
const users = new Map();


// --- B. Отдача Клиентского Файла ---
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});


// --- C. Логика Обмена Сообщениями (Socket.IO) ---
io.on('connection', async (socket) => {
  
  // 1. ОТПРАВКА ИСТОРИИ НОВОМУ ПОЛЬЗОВАТЕЛЮ
  try {
    // Запрашиваем историю из базы данных
    const history = await Message.find().sort({ timestamp: -1 }).limit(100);
    socket.emit('history', history.reverse()); 
  } catch (err) {
    console.error('Ошибка загрузки истории:', err);
  }


  // 2. СЛУШАЕМ СООБЩЕНИЕ (Общий или Приватный)
  socket.on('chat message', (data) => {
    // data — это объект: { sender: 'Имя', receiver: 'Имя', msg: 'Сообщение' }
    
    let fullMessage = `${data.sender}: ${data.msg}`;
    
    if (data.receiver) {
        // ПРИВАТНОЕ СООБЩЕНИЕ
        const receiverSocketId = users.get(data.receiver);
        if (receiverSocketId) {
            // Отправляем ТОЛЬКО получателю
            io.to(receiverSocketId).emit('chat message', `[ПРИВАТНОЕ ОТ ${data.sender}]: ${data.msg}`);
            // Отправляем обратно отправителю (подтверждение)
            socket.emit('chat message', `[ПРИВАТНОЕ ДЛЯ ${data.receiver}]: ${data.msg}`);
        } else {
            socket.emit('chat message', `Пользователь ${data.receiver} не в сети.`);
        }
    } else {
        // ОБЩИЙ ЧАТ
        io.emit('chat message', fullMessage); 
        // СОХРАНЯЕМ В БД (только общий чат)
        const messageToSave = new Message({ msg: fullMessage });
        messageToSave.save();
    }
  });
  
  // 3. РЕГИСТРАЦИЯ ИМЕНИ ПОЛЬЗОВАТЕЛЯ
  socket.on('set username', (username) => {
      // Сохраняем связь имени с ID сокета
      users.set(username, socket.id);
      socket.username = username;
      io.emit('chat message', `[СИСТЕМА]: Пользователь ${username} подключился.`);
  });
  
  // 4. ОБРАБОТКА ОТКЛЮЧЕНИЯ
  socket.on('disconnect', () => {
      if (socket.username) {
          // Удаляем пользователя из Map при отключении
          users.delete(socket.username);
          io.emit('chat message', `[СИСТЕМА]: Пользователь ${socket.username} отключился.`);
      }
  });
});


// --- D. Запуск Сервера ---
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});