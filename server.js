import { createServer } from 'node:http';

import express from 'express';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

function initBoard(mode) {
    switch (mode) {
        case 'classic':
            return Array(9).fill(null);
        default:
            return null;
    }
}

function checkWinner(board, mode) {
    switch (mode) {
        case 'classic':
            return checkClassic(board);
        default:
            return null;
    }
}

function checkClassic(board) {
    // console.log('checkClassic 被呼叫, board:', board);
    const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    for (const line of lines) {
        const [a, b, c] = line;
        // console.log('檢查:', a, b, c, '值:', board[a], board[b], board[c]);
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return {winner: board[a], line: [a, b, c]};
        }
    }

    if (board.every(cell => cell !== null)) {
        return {winner: 'draw', line: []};
    }

    return null;
}

io.on('connection', (socket) => {
    socket.on('createRoom', (mode) => {
        let roomCode;
        do {
            roomCode = Math.random().toString(36).substring(2, 8);
        } while (rooms[roomCode]);

        rooms[roomCode] = {
        players: [socket.id],
        mode: mode,
        board: initBoard(mode),
        turn: 0,
        gameOver: false
        };
        socket.join(roomCode);
        socket.emit('roomJoined', {symbol: 'O', roomCode, board: rooms[roomCode].board, mode: mode});
    });

    socket.on('joinRoom', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || room.players.length >= 2) {
            socket.emit('error', '房間不存在或已滿');
            return;
        }
        room.players.push(socket.id);
        room.turn = Math.random() < 0.5 ? 0 : 1;
        socket.join(roomCode);
        socket.emit('roomJoined', {symbol: 'X', roomCode, board: room.board, mode: room.mode});
        io.to(roomCode).emit('gameStart', {mode: room.mode, board: room.board, turn: room.turn});
        io.to(roomCode).emit('update', {board: room.board, turn: room.turn});
    });

    socket.on('move', ({roomCode, index}) => {
        const room = rooms[roomCode];
        if (!room) return;
        if (room.gameOver) return;
        // console.log('收到 move, index:', index, 'turn:', room.turn, 'playerIndex:', room.players.indexOf(socket.id));
        const playerIndex = room.players.indexOf(socket.id);
        if (playerIndex !== room.turn) return;
        if (room.board[index]) return;

        switch (room.mode) {
            case 'classic':
                room.board[index] = room.turn === 0 ? 'O' : 'X';
                room.turn = room.turn === 0 ? 1 : 0;

                const result = checkWinner(room.board, room.mode);
                if (result && result.winner === 'draw') {
                    room.gameOver = true;
                    io.to(roomCode).emit('gameOver', {result: 'draw', board: room.board, line:[]});
                }
                else if (result) {
                    room.gameOver = true;
                    // console.log('有贏家, result:', result);
                    io.to(roomCode).emit('gameOver', {result: result.winner, board: room.board, line: result.line});
                }
                else {
                    io.to(roomCode).emit('update', {board: room.board, turn: room.turn});
                }
                break;
            default:
                socket.emit('error', '未知遊戲模式');
                break;
        }
    });

    socket.on('disconnect', () => {
        for (const code in rooms) {
            if (rooms[code].players.includes(socket.id)) {
                io.to(code).emit('playerLeft');
                delete rooms[code];
            }
        }
    });

    socket.on('leaveRoom', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;
        socket.leave(roomCode);
        io.to(roomCode).emit('playerLeft');
        delete rooms[roomCode];
    });

    socket.on('rematch', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;
        if (!room.rematch) {
            room.rematch = [socket.id];
            socket.emit('waitingRematch');
        } else if (!room.rematch.includes(socket.id)) {
            room.rematch = null;
            room.board = initBoard(room.mode);
            room.turn = Math.random() < 0.5 ? 0 : 1;
            room.gameOver = false;
            io.to(roomCode).emit('gameStart', {mode: room.mode, board: room.board});
            io.to(roomCode).emit('update', {board: room.board, turn: room.turn});
        }
    });
});

server.listen(3000, () => console.log('伺服器啟動: http://localhost:3000'));