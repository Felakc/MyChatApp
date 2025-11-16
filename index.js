// index.js (Финальная версия с Аутентификацией и Историей)

// --- A. Инициализация Модулей и БД ---
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const mongoose = require('mongoose'); 
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// 🚨🚨🚨 ВАЖНО: ВСТАВЬТЕ СЮДА ВАШУ РАБОЧУЮ СТРОКУ ПОДКЛЮЧЕНИЯ 🚨🚨🚨
const dbURI = 'mongodb+srv://felak:Felak22113d@chatdb.sf9erka.mongodb.net/chat_db'; 

const JWT_SECRET = 'my_super_secret_key_12345'; // Секретный ключ
const saltRounds = 10; 

mongoose.connect(dbURI)
  .then(() => console.log('Подключение к MongoDB установлено'))
  .catch(err => console.error('Ошибка подключения к MongoDB:', err));

// Схема для сообщений
const Message = mongoose.model('Message', new mongoose.Schema({
  sender: String,
  msg: String,
  timestamp: { type: Date, default: Date.now }
}));

// Схема для пользователя
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true } 
});
const User = mongoose.model('User', UserSchema); 

const PORT = process.env.PORT || 3000;
const users = new Map();

// --- B. Отдача Клиентского Файла ---
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// --- C. Логика Обмена Сообщениями (Socket.IO) ---
io.on('connection', async (socket) => {
    
    console.log('Пользователь подключился: ' + socket.id);
    
    // 1. РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ
    socket.on('register', async ({ username, password }) => {
        try {
            if (await User.findOne({ username })) {
                return socket.emit('auth error', 'Пользователь с таким именем уже существует.');
            }

            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const newUser = new User({ username, password: hashedPassword });
            await newUser.save();

            socket.emit('auth message', 'Регистрация прошла успешно. Теперь войдите в систему.');
        } catch (err) {
            console.error('Ошибка регистрации:', err);
            socket.emit('auth error', 'Ошибка сервера при регистрации.');
        }
    });

    // 2. ВХОД ПОЛЬЗОВАТЕЛЯ
    socket.on('login', async ({ username, password }) => {
        try {
            const user = await User.findOne({ username });

            if (!user) {
                return socket.emit('auth error', 'Неверное имя пользователя или пароль.');
            }

            const match = await bcrypt.compare(password, user.password);

            if (!match) {
                return socket.emit('auth error', 'Неверное имя пользователя или пароль.');
            }

            const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
            
            socket.emit('auth success', { token: token, username: user.username });
            
        } catch (err) {
            console.error('Ошибка входа:', err);
            socket.emit('auth error', 'Ошибка сервера при входе.');
        }
    });
    
    // 3. АВТОРИЗАЦИЯ И ПОЛУЧЕНИЕ ИСТОРИИ 
    socket.on('authenticate', async (username) => {
        socket.username = username;
        users.set(username, socket.id);
        io.emit('chat message', { sender: '[СИСТЕМА]', msg: `Пользователь ${username} подключился.` });
        
        try {
            const history = await Message.find().sort({ timestamp: -1 }).limit(100);
            socket.emit('history', history.reverse()); 
        } catch (err) {
            console.error('Ошибка загрузки истории:', err);
        }
    });

    // 4. СЛУШАЕМ СООБЩЕНИЕ
    socket.on('chat message', (data) => {
        
        if (!socket.username) {
            return socket.emit('chat message', { sender: '[СИСТЕМА]', msg: 'Сначала войдите в систему!' });
        }
        
        const messageToSave = { sender: data.sender, msg: data.msg };
        
        if (data.receiver) {
            // ПРИВАТНОЕ СООБЩЕНИЕ
            const receiverSocketId = users.get(data.receiver);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('chat message', { sender: `[ПРИВАТНОЕ ОТ ${data.sender}]`, msg: data.msg });
                socket.emit('chat message', { sender: `[ПРИВАТНОЕ ДЛЯ ${data.receiver}]`, msg: data.msg });
            } else {
                socket.emit('chat message', { sender: '[СИСТЕМА]', msg: `Пользователь ${data.receiver} не в сети.` });
            }
        } else {
            // ОБЩИЙ ЧАТ
            io.emit('chat message', { sender: data.sender, msg: data.msg }); 
            
            const messageModel = new Message(messageToSave);
            messageModel.save();
        }
    });
  
    // 5. ОБРАБОТКА ОТКЛЮЧЕНИЯ
    socket.on('disconnect', () => {
        if (socket.username) {
            users.delete(socket.username);
            io.emit('chat message', { sender: '[СИСТЕМА]', msg: `Пользователь ${socket.username} отключился.` });
        }
    });
});

// --- D. Запуск Сервера ---
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});