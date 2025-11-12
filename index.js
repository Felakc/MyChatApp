// index.js (Сервер)

// --- A. Инициализация Модулей ---
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Порт, на котором будет работать сервер
const PORT = process.env.PORT || 3000;


// --- B. Отдача Клиентского Файла ---
// Указываем, что при запросе по адресу / нужно отдать файл index.html
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});


// --- C. Логика Обмена Сообщениями (Socket.IO) ---
// Обработчик срабатывает, когда новый клиент подключается
io.on('connection', (socket) => {
  console.log('Пользователь подключился'); 

  // Слушаем событие 'chat message' (сообщение от клиента)
  socket.on('chat message', (msg) => {
    // Рассылаем полученное сообщение ВСЕМ подключенным клиентам
    io.emit('chat message', msg); 
  });
  
  // Обработка отключения клиента
  socket.on('disconnect', () => {
    console.log('Пользователь отключился');
  });
});


// --- D. Запуск Сервера ---
// Запускаем HTTP-сервер на указанном порту
server.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});