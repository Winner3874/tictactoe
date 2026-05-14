const socket = io();

let mySymbol = null;
let myRoomCode = null;
let selectedMode = null;
let gameStarted = false;
let isGameOver = false;

const modeNames = {
    'classic': '經典'
};

const modeSelect = document.getElementById('mode-select');

modeSelect.addEventListener('change', () => {
    selectedMode = modeSelect.value;
});

const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const codeInput = document.getElementById('code-input');

createBtn.addEventListener('click', () => {
    if (!selectedMode) {
        alert('請先選擇遊戲模式');
        return;
    }
    socket.emit('createRoom', selectedMode);
});

joinBtn.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (!code) {
        alert('請輸入房間代碼');
        return;
    }
    socket.emit('joinRoom', code);
});

const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const roomCodeDisplay = document.getElementById('room-code-display');
const statusDisplay = document.getElementById('status');
const modeDisplay = document.getElementById('mode-display');

socket.on('roomJoined', ({symbol, roomCode, board, mode}) => {
    mySymbol = symbol;
    myRoomCode = roomCode;
    selectedMode = mode
    modeDisplay.textContent = '模式: ' + (modeNames[mode] ?? mode);
    roomCodeDisplay.textContent = '房間代碼: ' + roomCode;
    statusDisplay.textContent = '等待對手加入';
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    renderBoard(board);
});

socket.on('gameStart', ({mode, board}) => {
    // console.log('收到 gameStart, mode:', mode, 'board:', board);
    isGameOver = false;
    selectedMode = mode;
    gameStarted = true;
    rematchBtn.style.display = 'none';
});

socket.on('update', ({board, turn}) => {
    console.log('收到 update, turn:', turn, 'mySymbol:', mySymbol);
    renderBoard(board);
    if (turn === 0 && mySymbol === 'O') {
        statusDisplay.textContent = '輪到你了';
    }
    else if (turn === 1 && mySymbol === 'X') {
        statusDisplay.textContent = '輪到你了';
    }
    else {
        statusDisplay.textContent = '等待對手';
    }
});

const rematchBtn = document.getElementById('rematch-btn');

socket.on('gameOver', ({result, board, line}) => {
    // console.log('收到 gameOver, result:', result, 'line:', line);
    isGameOver = true;
    renderBoard(board, line);
    if (result === 'draw') {
        statusDisplay.textContent = '平局';
    }
    else if (result === mySymbol) {
        statusDisplay.textContent = '你贏了';
    }
    else {
        statusDisplay.textContent = '你輸了';
    }
    rematchBtn.style.display = 'block';
});

rematchBtn.addEventListener('click', () => {
    rematchBtn.style.display = 'none';
    socket.emit('rematch', myRoomCode);
});

socket.on('waitingRematch', () => {
    statusDisplay.textContent = '等待對手確認再來一場';
});

socket.on('playerLeft', () => {
    statusDisplay.textContent = '對手離開了';
});

socket.on('error', (msg) => {
    alert(msg);
});

const boardDiv = document.getElementById('board');

function renderBoard(board, winLine = []) {
    // console.log('renderBoard 被呼叫, selectedMode:', selectedMode);
    switch (selectedMode) {
        case 'classic':
            renderClassic(board, winLine);
            break;
        default:
            break;
    }
}

function renderClassic(board, winLine = []) {
    // console.log('renderClassic 被呼叫, board:', board);
    boardDiv.innerHTML = '';
    boardDiv.style.gridTemplateColumns = 'repeat(3, 100px)';
    boardDiv.style.gridTemplateRows = 'repeat(3, 100px)';
    board.forEach((cell, index) => {
        const cellDiv = document.createElement('div');
        cellDiv.classList.add('cell');
        if (isGameOver) {
            cellDiv.classList.add('no-hover');
        }
        cellDiv.textContent = cell ?? '';
        if (cell === 'X') {
            cellDiv.classList.add('cell-x');
        } else if (cell === 'O') {
            cellDiv.classList.add('cell-o');
        }
        if (winLine.includes(index)) {
            cellDiv.classList.add(cell === 'X' ? 'cell-x-win' : 'cell-o-win');
        }
        cellDiv.addEventListener('click', () => {
            if (!gameStarted) return;
            socket.emit('move', {roomCode: myRoomCode, index});
        });
        boardDiv.appendChild(cellDiv);
    });
    // console.log('boardDiv 內容:', boardDiv.innerHTML);
}

const leaveBtn = document.getElementById('leave-btn');

leaveBtn.addEventListener('click', () => {
    socket.emit('leaveRoom', myRoomCode);
    mySymbol = null;
    myRoomCode = null;
    selectedMode = null;
    gameStarted = false;
    boardDiv.innerHTML = '';
    modeSelect.value = '';
    codeInput.value = '';
    gameScreen.style.display = 'none';
    menuScreen.style.display = 'flex';
});