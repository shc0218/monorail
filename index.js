const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 64;
const BOARD_COLS = 8;
const BOARD_ROWS = 8;
const BOARD_WIDTH = BOARD_COLS * TILE_SIZE;
const BOARD_HEIGHT = BOARD_ROWS * TILE_SIZE;
const PALETTE_Y = BOARD_HEIGHT + 20;

// 보드 상태
const board = Array.from({length: BOARD_COLS}, () => Array(BOARD_ROWS).fill(null));


// 이미지 로드
const lineImg = new Image();
lineImg.src = './image/line.png';
const angleImg = new Image();
angleImg.src = './image/angle.png';

// 팔레트 타일
const palette = [
    { type: 'line', x: 20, y: PALETTE_Y, img: lineImg, rotation: 0 },
    { type: 'angle', x: 120, y: PALETTE_Y, img: angleImg, rotation: 0 }
];

let selectedTile = null;
let offsetX = 0;
let offsetY = 0;

board[3][3] = { type: 'line', img: lineImg, rotation: 0 };
board[4][3] = { type: 'line', img: lineImg, rotation: 0 };

// 마우스 이벤트
canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (let t of palette) {
        if (mx > t.x && mx < t.x + TILE_SIZE && my > t.y && my < t.y + TILE_SIZE) {
            selectedTile = { ...t }; // 복사
            offsetX = mx - t.x;
            offsetY = my - t.y;
        }
    }
});

canvas.addEventListener('mousemove', e => {
    if (selectedTile) {
        const rect = canvas.getBoundingClientRect();
        selectedTile.x = e.clientX - rect.left - offsetX;
        selectedTile.y = e.clientY - rect.top - offsetY;
        draw();
    }
});

let currentTurnTiles = []; // 이번 턴에 놓은 타일

canvas.addEventListener('mouseup', e => {
    if (!selectedTile) return;

    const boardX = Math.floor(selectedTile.x / TILE_SIZE);
    const boardY = Math.floor(selectedTile.y / TILE_SIZE);

    // 보드 영역 밖이거나 이미 타일 있는 칸은 배치 불가
    if (
        boardX < 0 || boardX >= BOARD_COLS ||
        boardY < 0 || boardY >= BOARD_ROWS ||
        board[boardX][boardY] !== null ||
        currentTurnTiles.length >= 3 // 이번 턴 최대 3개 제한
    ) {
        selectedTile = null;
        draw();
        return;
    }

    let canPlace = false;

    if (currentTurnTiles.length === 0) {
        // 이번 턴 첫 타일 → 기존 보드 타일에 인접
        canPlace = isAdjacentToBoard(boardX, boardY);
    } else if (currentTurnTiles.length === 1) {
        // 두 번째 타일 → 이번 턴 첫 타일에 인접
        canPlace = isAdjacentToTiles(boardX, boardY, [currentTurnTiles[0]]);
    } else {
        // 세 번째 타일 → 이번 턴 첫 타일 또는 마지막 놓은 타일에 인접
        const lastTile = currentTurnTiles[currentTurnTiles.length - 1];
        const firstTile = currentTurnTiles[0];
        canPlace = isAdjacentToTiles(boardX, boardY, [lastTile, firstTile]);
    }

    if (canPlace) {
        board[boardX][boardY] = { type: selectedTile.type, img: selectedTile.img, rotation: selectedTile.rotation };
        currentTurnTiles.push([boardX, boardY]);
    }

    selectedTile = null;
    draw();
});


// 보드 전체에 인접 체크
function isAdjacentToBoard(x, y) {
    const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
    for (let [dx,dy] of dirs){
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < BOARD_COLS && ny >= 0 && ny < BOARD_ROWS) {
            if (board[nx][ny] !== null) return true;
        }
    }
    return false;
}

// 특정 타일 배열에 인접 체크
function isAdjacentToTiles(x, y, tiles) {
    const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
    for (let [dx,dy] of dirs){
        const nx = x + dx;
        const ny = y + dy;
        for (let [tx,ty] of tiles){
            if (nx === tx && ny === ty) return true;
        }
    }
    return false;
}

// 턴 종료 시 호출
function endTurn() {
    currentTurnTiles = [];
}

// 회전 이벤트
window.addEventListener('keydown', e => {
    if (selectedTile && e.key.toLowerCase() === 'r') {
        selectedTile.rotation = (selectedTile.rotation + 90) % 360;
        draw();
    }
});

// 회전된 타일 그리기 함수
function drawTile(img, x, y, rotation) {
    ctx.save();
    ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.drawImage(img, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    ctx.restore();
}

// 렌더링
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 보드
    for (let x = 0; x < BOARD_COLS; x++) {
        for (let y = 0; y < BOARD_ROWS; y++) {
            ctx.strokeStyle = '#999';
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            const tile = board[x][y];
            if (tile && tile.img && tile.img.complete && tile.img.naturalWidth !== 0) {
                drawTile(tile.img, x * TILE_SIZE, y * TILE_SIZE, tile.rotation);
            }
        }
    }

    // 팔레트
    for (let t of palette) {
        if (t.img && t.img.complete && t.img.naturalWidth !== 0) {
            drawTile(t.img, t.x, t.y, t.rotation);
            ctx.strokeRect(t.x, t.y, TILE_SIZE, TILE_SIZE);
        }
    }

    // 드래그 중인 타일
    if (selectedTile && selectedTile.img && selectedTile.img.complete && selectedTile.img.naturalWidth !== 0) {
        drawTile(selectedTile.img, selectedTile.x, selectedTile.y, selectedTile.rotation);
        ctx.strokeRect(selectedTile.x, selectedTile.y, TILE_SIZE, TILE_SIZE);
    }
}

const undoBtn = document.getElementById('undoBtn');

undoBtn.addEventListener('click', () => {
    // 이번 턴에 놓은 타일 모두 되돌리기
    while(currentTurnTiles.length > 0) {
        const [x, y] = currentTurnTiles.pop();
        board[x][y] = null;
    }
    draw();
});

// 이미지 로드 완료 시 초기 렌더
lineImg.onload = draw;
angleImg.onload = draw;
