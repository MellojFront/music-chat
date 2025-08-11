class MusicChat {
    constructor() {
        this.ws = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // Форма входа
        document.getElementById('joinBtn').addEventListener('click', () => this.joinChat());
        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinChat();
        });

        // Отправка сообщений
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Смена комнаты
        document.getElementById('changeRoomBtn').addEventListener('click', () => this.changeRoom());
    }

    joinChat() {
        const username = document.getElementById('usernameInput').value.trim();
        const room = document.getElementById('roomSelect').value;

        if (!username) {
            alert('Введи свой никнейм!');
            return;
        }

        if (username.length > 20) {
            alert('Никнейм слишком длинный!');
            return;
        }

        this.currentUser = username;
        this.currentRoom = room;
        this.connectWebSocket();
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('Connected to WebSocket');
            this.ws.send(JSON.stringify({
                type: 'join',
                username: this.currentUser,
                room: this.currentRoom
            }));
            this.showChat();
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            this.showConnectionError();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.showConnectionError();
        };
    }

    showChat() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'flex';
        
        // Обновляем информацию о текущей комнате
        const roomNames = {
            'general': '🎧 Общий',
            'melodic-techno': '🌊 Melodic Techno',
            'ambient': '🌌 Ambient',
            'house': '🏠 House',
            'drum-and-bass': '⚡ Drum & Bass'
        };
        
        document.getElementById('currentRoom').textContent = roomNames[this.currentRoom];
        document.getElementById('messageInput').focus();
    }

    showConnectionError() {
        alert('Ошибка подключения к серверу. Попробуй перезагрузить страницу.');
    }

    handleMessage(data) {
        switch (data.type) {
            case 'message':
                this.addMessage(data);
                break;
            case 'system':
                this.addSystemMessage(data.message, data.timestamp);
                break;
            case 'userList':
                this.updateUserList(data.users);
                break;
        }
    }

    addMessage(data) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        
        const isCurrentUser = data.username === this.currentUser;
        messageDiv.className = `message ${isCurrentUser ? 'user' : 'other'}`;
        
        const time = new Date(data.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            ${!isCurrentUser ? `<div class="message-header">${this.escapeHtml(data.username)}</div>` : ''}
            <div class="message-text">${this.escapeHtml(data.message)}</div>
            <div class="message-time">${time}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addSystemMessage(message, timestamp) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        
        const time = new Date(timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-text">${this.escapeHtml(message)}</div>
            <div class="message-time">${time}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    updateUserList(users) {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        
        users.forEach(user => {
            const userTag = document.createElement('div');
            userTag.className = 'user-tag';
            userTag.textContent = user;
            usersList.appendChild(userTag);
        });
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (!message) return;

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'message',
                message: message
            }));
            messageInput.value = '';
        } else {
            alert('Нет соединения с сервером');
        }
    }

    changeRoom() {
        document.getElementById('chatContainer').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        
        // Закрываем текущее соединение
        if (this.ws) {
            this.ws.close();
        }
        
        // Очищаем сообщения
        document.getElementById('messages').innerHTML = '';
        document.getElementById('usersList').innerHTML = '';
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Запускаем чат когда DOM загружен
document.addEventListener('DOMContentLoaded', () => {
    new MusicChat();
});