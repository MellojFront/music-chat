console.log('🚀 Запуск Music Chat сервера...');

const http = require('http');
const path = require('path');
const fs = require('fs');

// Сначала проверим, что модуль ws установлен
let WebSocket;
try {
  WebSocket = require('ws');
  console.log('✅ Модуль ws найден');
} catch (err) {
  console.error('❌ Модуль ws не найден!');
  console.error('💡 Выполни: npm install ws');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);
  
  // Определяем путь к файлу
  let filePath;
  if (req.url === '/') {
    filePath = path.join(__dirname, 'public', 'index.html');
  } else {
    filePath = path.join(__dirname, 'public', req.url);
  }
  
  const extname = path.extname(filePath);
  
  // Определяем тип контента
  let contentType = 'text/html; charset=utf-8';
  switch (extname) {
    case '.css': contentType = 'text/css'; break;
    case '.js': contentType = 'text/javascript'; break;
    case '.json': contentType = 'application/json'; break;
  }

  // Читаем файл
  fs.readFile(filePath, (err, content) => {
    if (err) {
      console.error(`❌ Файл не найден: ${filePath}`);
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <h1>404 - Файл не найден</h1>
        <p>Путь: ${filePath}</p>
        <p><a href="/">← Вернуться на главную</a></p>
      `);
    } else {
      console.log(`✅ Отправлен: ${path.basename(filePath)}`);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Создаем WebSocket сервер
let wss;
try {
  wss = new WebSocket.Server({ server });
  console.log('✅ WebSocket сервер создан');
} catch (err) {
  console.error('❌ Ошибка создания WebSocket сервера:', err);
  process.exit(1);
}

// Хранилище комнат и пользователей
const rooms = {
  'melodic-techno': { users: new Set(), messages: [] },
  'ambient': { users: new Set(), messages: [] },
  'house': { users: new Set(), messages: [] },
  'drum-and-bass': { users: new Set(), messages: [] },
  'general': { users: new Set(), messages: [] }
};

console.log('✅ Комнаты созданы:', Object.keys(rooms));

// Функция для отправки сообщения всем в комнате
function broadcastToRoom(roomName, message, excludeWs = null) {
  if (rooms[roomName]) {
    let sentCount = 0;
    rooms[roomName].users.forEach(ws => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
          sentCount++;
        } catch (err) {
          console.error('❌ Ошибка отправки сообщения:', err);
        }
      }
    });
    if (sentCount > 0) {
      console.log(`📤 Сообщение отправлено ${sentCount} пользователям в ${roomName}`);
    }
  }
}

// Функция для отправки списка онлайн пользователей
function sendUserList(roomName) {
  if (rooms[roomName]) {
    const userList = Array.from(rooms[roomName].users)
      .filter(ws => ws.username && ws.readyState === WebSocket.OPEN)
      .map(ws => ws.username);
    
    broadcastToRoom(roomName, {
      type: 'userList',
      users: userList
    });
    
    console.log(`👥 Обновлен список пользователей ${roomName}:`, userList);
  }
}

wss.on('connection', (ws) => {
  console.log('🔗 Новое WebSocket подключение');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 Сообщение от клиента:', message.type);
      
      switch (message.type) {
        case 'join':
          // Удаляем из предыдущей комнаты
          if (ws.currentRoom && rooms[ws.currentRoom]) {
            rooms[ws.currentRoom].users.delete(ws);
            sendUserList(ws.currentRoom);
          }
          
          // Добавляем в новую комнату
          ws.username = message.username;
          ws.currentRoom = message.room;
          
          if (rooms[message.room]) {
            rooms[message.room].users.add(ws);
            console.log(`👤 ${message.username} присоединился к ${message.room}`);
            
            // Отправляем историю сообщений
            const recentMessages = rooms[message.room].messages.slice(-10);
            recentMessages.forEach(msg => {
              try {
                ws.send(JSON.stringify(msg));
              } catch (err) {
                console.error('❌ Ошибка отправки истории:', err);
              }
            });
            
            // Системное сообщение
            const joinMessage = {
              type: 'system',
              message: `${message.username} присоединился к чату`,
              timestamp: new Date().toISOString()
            };
            broadcastToRoom(message.room, joinMessage);
            
            sendUserList(message.room);
          } else {
            console.error(`❌ Комната ${message.room} не существует`);
          }
          break;
          
        case 'message':
          if (ws.currentRoom && rooms[ws.currentRoom] && ws.username) {
            const chatMessage = {
              type: 'message',
              username: ws.username,
              message: message.message,
              timestamp: new Date().toISOString()
            };
            
            // Сохраняем сообщение
            rooms[ws.currentRoom].messages.push(chatMessage);
            
            // Ограничиваем историю
            if (rooms[ws.currentRoom].messages.length > 100) {
              rooms[ws.currentRoom].messages.shift();
            }
            
            console.log(`💬 ${ws.username} в ${ws.currentRoom}: ${message.message}`);
            broadcastToRoom(ws.currentRoom, chatMessage);
          } else {
            console.error('❌ Попытка отправить сообщение без комнаты или имени');
          }
          break;
          
        default:
          console.log('❓ Неизвестный тип сообщения:', message.type);
      }
    } catch (error) {
      console.error('❌ Ошибка обработки сообщения:', error);
    }
  });
  
  ws.on('close', () => {
    if (ws.currentRoom && rooms[ws.currentRoom]) {
      rooms[ws.currentRoom].users.delete(ws);
      
      if (ws.username) {
        console.log(`👋 ${ws.username} покинул ${ws.currentRoom}`);
        
        const leaveMessage = {
          type: 'system',
          message: `${ws.username} покинул чат`,
          timestamp: new Date().toISOString()
        };
        broadcastToRoom(ws.currentRoom, leaveMessage);
        sendUserList(ws.currentRoom);
      }
    }
    console.log('❌ WebSocket соединение закрыто');
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket ошибка:', error);
  });
});

const PORT = process.env.PORT || 3000;

// Проверяем файлы перед запуском
const publicPath = path.join(__dirname, 'public');
fs.readdir(publicPath, (err, files) => {
  if (err) {
    console.error('❌ Папка public не найдена!');
    console.error('💡 Создай папку public с файлами: index.html, style.css, script.js');
    return;
  }
  
  console.log('📁 Файлы в public:', files);
  
  const requiredFiles = ['index.html', 'style.css', 'script.js'];
  const missingFiles = requiredFiles.filter(file => !files.includes(file));
  
  if (missingFiles.length > 0) {
    console.error('❌ Отсутствуют файлы:', missingFiles);
    console.error('💡 Добавь недостающие файлы в папку public/');
  }
});

server.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Ошибка запуска:', err);
    return;
  }
  
  console.log('🎵 =====================================');
  console.log('🎵  Music Chat Server ЗАПУЩЕН!');
  console.log('🎵 =====================================');
  console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
  console.log(`📁 Папка: ${publicPath}`);
  console.log('🎵 =====================================');
});

server.on('error', (err) => {
  console.error('❌ Ошибка сервера:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Порт ${PORT} занят!`);
    console.error('💡 Останови предыдущий сервер или измени порт');
  }
});