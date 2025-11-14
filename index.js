// index.js (Сервер с Историей и Приватными Сообщениями)

// --- A. Инициализация Модулей и БД ---
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const mongoose = require('mongoose'); 

// !!! ВСТАВЬТЕ СТРОКУ ПОДКЛЮЧЕНИЯ ИЗ MONGODB ATLAS С ВАШИМ ПАРОЛЕМ ЗДЕСЬ !!!
const dbURI = 'mongodb+srv://felak:<db_Felak22113d>@chatdb.sf9erka.mongodb.net/?appName=ChatDB'; 

mongoose.connect(dbURI)
  .then(() => console.log('Подключение к MongoDB установлено'))
  .catch(err => console.error('Ошибка подключения к MongoDB:', err));

// Схема для сохранения сообщений
const Message = mongoose.model('Message', new mongoose.Schema({
  msg: String,
  timestamp: { type: Date, default: Date.now }
}));


const PORT = process.env.PORT || 3000;
const users = new Map();


// --- B. Отдача Клиентского Файла ---
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});


// --- C. Логика Обмена Сообщениями (Socket.IO) ---
io.on('connection', async (socket) => {
  
  // 1. ОТПРАВКА ИСТОРИИ НОВОМУ ПОЛЬЗОВАТЕЛЮ
  try {
    const history = await Message.find().sort({ timestamp: -1 }).limit(100);
    socket.emit('history', history.reverse()); 
  } catch (err) {
    console.error('Ошибка загрузки истории:', err);
  }


  // 2. СЛУШАЕМ СООБЩЕНИЕ (Общий или Приватный)
  socket.on('chat message', (data) => {
    let fullMessage = `${data.sender}: ${data.msg}`;
    
    if (data.receiver) {
        // ПРИВАТНОЕ СООБЩЕНИЕ
        const receiverSocketId = users.get(data.receiver);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('chat message', `[ПРИВАТНОЕ ОТ ${data.sender}]: ${data.msg}`);
            socket.emit('chat message', `[ПРИВАТНОЕ ДЛЯ ${data.receiver}]: ${data.msg}`);
        } else {
            socket.emit('chat message', `Пользователь ${data.receiver} не в сети.`);
        }
    } else {
        // ОБЩИЙ ЧАТ
        io.emit('chat message', fullMessage); 
        const messageToSave = new Message({ msg: fullMessage });
        messageToSave.save();
    }
  });
  
  // 3. РЕГИСТРАЦИЯ ИМЕНИ ПОЛЬЗОВАТЕЛЯ
  socket.on('set username', (username) => {
      users.set(username, socket.id);
      socket.username = username;
      io.emit('chat message', `[СИСТЕМА]: Пользователь ${username} подключился.`);
  });
  
  // 4. ОБРАБОТКА ОТКЛЮЧЕНИЯ
  socket.on('disconnect', () => {
      if (socket.username) {
          users.delete(socket.username);
          io.emit('chat message', `[СИСТЕМА]: Пользователь ${socket.username} отключился.`);
      }
  });
});


// --- D. Запуск Сервера ---
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});