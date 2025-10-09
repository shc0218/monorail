document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const palette = document.getElementById('palette');
    const resetButton = document.getElementById('reset-button');
    const nextTurnButton = document.getElementById('next-turn-button');
    const turnInfo = document.getElementById('turn-info');

    const BOARD_SIZE = 8;
    const MAX_NEW_TILES = 3;

    // 초기 타일 위치 데이터 (4,4, 4,5)
    const INITIAL_TILES_DATA = [
        { row: 4, col: 4, index: 36, type: 'A' },
        { row: 4, col: 5, index: 37, type: 'A' }
    ];

    // 타일 색상 상수 정의
    const INITIAL_TILE_COLOR = '#66cdaa'; // 초기 배치 타일 색상
    const GENERAL_TILE_COLOR = '#f0e68c'; // 플레이어 및 AI가 놓는 일반 타일 색상

    // ------------------- 게임 상태 관리 -------------------
    let isPlayerTurn = true;
    let draggedTile = null;
    let placedTiles = [];
    let newTilesCount = 0;
    let turnStartTilesState = [];

    // ------------------- 초기 보드 및 셀 생성 -------------------
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        const cell = document.createElement('div');
        cell.classList.add('board-cell');
        cell.setAttribute('data-index', i);
        cell.setAttribute('data-row', Math.floor(i / BOARD_SIZE));
        cell.setAttribute('data-col', i % BOARD_SIZE);
        board.appendChild(cell);
    }
    const cells = document.querySelectorAll('.board-cell');

    // ------------------- 턴 관리 함수 -------------------

    function redrawBoard(tilesData) {
        cells.forEach(cell => {
            while (cell.firstChild) {
                cell.removeChild(cell.firstChild);
            }
        });

        tilesData.forEach(tileData => {
            const cell = cells[tileData.index];
            const tile = document.createElement('div');

            tile.classList.add('tile');
            tile.textContent = `${tileData.type} 타일`;

            // 타일 유형에 따라 색상 결정
            const isInitial = INITIAL_TILES_DATA.some(t => t.index === tileData.index);
            tile.style.backgroundColor = isInitial ? INITIAL_TILE_COLOR : GENERAL_TILE_COLOR;
            tile.style.margin = '0';

            cell.appendChild(tile);
        });

        placedTiles = [...tilesData];
    }

    function startTurn() {
        newTilesCount = 0;
        turnStartTilesState = JSON.parse(JSON.stringify(placedTiles));

        // **오류 수정 후 DOM 요소 사용**
        if (turnInfo) {
            turnInfo.textContent = isPlayerTurn ? "플레이어 턴" : "AI 턴";
        }

        palette.style.pointerEvents = isPlayerTurn ? 'auto' : 'none';
        nextTurnButton.disabled = !isPlayerTurn;
        resetButton.disabled = !isPlayerTurn;

        if (!isPlayerTurn) {
            setTimeout(AITurn, 1000);
        } else {
            console.log("플레이어 턴 시작. 타일 배치 가능.");
        }
    }

    function resetCurrentTurn() {
        if (!isPlayerTurn) return;

        redrawBoard(turnStartTilesState);
        newTilesCount = 0;
        console.log("현재 턴이 초기화되었습니다. 턴 시작 시점으로 돌아갑니다.");
    }

    function passTurn() {
        if (isPlayerTurn) {
            isPlayerTurn = false;
            startTurn();
        }
    }

    // ------------------- AI 로직 -------------------

    function AITurn() {
        // 1. AI가 놓을 타일 개수를 1개에서 3개 사이에서 랜덤하게 결정
        const AITilesToPlace = Math.floor(Math.random() * MAX_NEW_TILES) + 1;
        let placedThisTurn = 0; // 실제로 놓은 타일 수

        console.log(`AI가 총 ${AITilesToPlace}개의 타일을 놓으려고 시도합니다.`);

        // 2. 결정된 개수만큼 타일 배치를 시도합니다.
        for (let i = 0; i < AITilesToPlace; i++) {
            const currentCount = i; // 현재 턴에 놓으려는 타일의 순서 (0, 1, 2)
            let validDrops = [];

            // 유효한 모든 드롭 위치를 찾습니다.
            cells.forEach(cell => {
                // currentCount에 따라 (규칙 1, 2, 3) 유효성 검사 적용
                if (isValidPlacement(cell, currentCount)) {
                    const r = parseInt(cell.dataset.row);
                    const c = parseInt(cell.dataset.col);
                    const idx = parseInt(cell.dataset.index);
                    validDrops.push({ row: r, col: c, index: idx });
                }
            });

            if (validDrops.length > 0) {
                const tileTypes = ['A', 'B'];
                const randomType = tileTypes[Math.floor(Math.random() * tileTypes.length)];

                // 3. 무작위로 하나의 유효 위치 선택
                const randomIndex = Math.floor(Math.random() * validDrops.length);
                const dropLocation = validDrops[randomIndex];
                const targetCell = cells[dropLocation.index];

                // 4. 타일 생성 및 배치
                const tile = document.createElement('div');
                tile.classList.add('tile');
                tile.textContent = `${randomType} 타일`;
                tile.style.backgroundColor = GENERAL_TILE_COLOR;
                tile.style.margin = '0';

                targetCell.appendChild(tile);

                // 5. 상태 업데이트
                placedTiles.push({ ...dropLocation, type: randomType  });
                placedThisTurn++;
                console.log(`[AI] ${i + 1}번째 타일 배치 성공: (${dropLocation.row}, ${dropLocation.col}).`);
            } else {
                console.log(`[AI] ${i + 1}번째 타일을 놓을 수 있는 유효한 위치가 없어 배치를 중단합니다.`);
                break; // 더 이상 놓을 수 없으므로 반복 중단
            }
        }

        console.log(`AI 턴 완료. 총 ${placedThisTurn}개 배치.`);

        // 턴 전환
        isPlayerTurn = true;
        startTurn();
    }

    // ------------------- 이벤트 리스너 연결 -------------------
    resetButton.addEventListener('click', resetCurrentTurn);
    nextTurnButton.addEventListener('click', passTurn);

    // ------------------- 드래그 & 드롭 이벤트 핸들러 (생략: 기존 로직 동일) -------------------

    // 팔레트의 드래그 시작/종료 이벤트
    palette.querySelectorAll('.draggable').forEach(tile => {
        tile.addEventListener('dragstart', (e) => {
            if (!isPlayerTurn || newTilesCount >= MAX_NEW_TILES) {
                e.preventDefault();
                return;
            }
            const clonedTile = e.target.cloneNode(true);
            clonedTile.classList.add('is-dragging');
            draggedTile = clonedTile;
            e.dataTransfer.setData('text/plain', e.target.dataset.type);
            e.target.classList.add('is-dragging');
        });

        tile.addEventListener('dragend', (e) => {
            e.target.classList.remove('is-dragging');
            removeHighlights();
        });
    });

    // 보드 셀 드롭 이벤트
    cells.forEach(cell => {
        cell.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!isPlayerTurn || cell.children.length > 0 || !isValidPlacement(cell, newTilesCount)) {
                removeHighlights();
                return;
            }
            removeHighlights();
            cell.classList.add('highlight');
        });

        cell.addEventListener('dragleave', () => {
            cell.classList.remove('highlight');
        });

        cell.addEventListener('drop', (e) => {
            e.preventDefault();
            cell.classList.remove('highlight');

            if (isPlayerTurn && cell.children.length === 0 && draggedTile && isValidPlacement(cell, newTilesCount) && newTilesCount < MAX_NEW_TILES) {
                // 1. 타일 배치
                draggedTile.classList.remove('is-dragging');
                draggedTile.style.margin = '0';

                // 플레이어가 놓는 타일은 palette에 정의된 색상을 그대로 사용합니다.
                // CSS에서 일반 타일 색상이 '#f0e68c'로 설정되어 있다면 이 색상으로 배치됩니다.

                cell.appendChild(draggedTile);

                // 2. 게임 상태 업데이트
                newTilesCount++;
                const r = parseInt(cell.dataset.row);
                const c = parseInt(cell.dataset.col);
                const idx = parseInt(cell.dataset.index);
                const type = draggedTile.dataset.type;
                placedTiles.push({ row: r, col: c, index: idx, type: type });

                // 3. 다음 드래그를 위해 초기화
                draggedTile = null;
                console.log(`[플레이어] 타일 배치 완료: (${r}, ${c}). 현재 타일 수: ${newTilesCount}/${MAX_NEW_TILES}`);
            }
            removeHighlights();
        });
    });

    // ------------------- 유효성 검사 함수 -------------------
    function isValidPlacement(cell, currentCount) {
        if (cell.children.length > 0) return false;

        const targetRow = parseInt(cell.dataset.row);
        const targetCol = parseInt(cell.dataset.col);

        let validNeighbors = [];
        const currentPlacedCount = placedTiles.length;

        if (currentCount === 0) {
            validNeighbors = placedTiles;
        } else if (currentCount === 1) {
            validNeighbors = [placedTiles[currentPlacedCount - 1]];
        } else if (currentCount === 2) {
            validNeighbors = [placedTiles[currentPlacedCount - 1], placedTiles[currentPlacedCount - 2]];
        } else {
            return false;
        }

        return validNeighbors.some(placedTile => {
            const rowDiff = Math.abs(placedTile.row - targetRow);
            const colDiff = Math.abs(placedTile.col - targetCol);

            const isAdjacent = (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);

            return isAdjacent;
        });
    }

    // ------------------- 유틸리티 함수 -------------------
    function removeHighlights() {
        cells.forEach(cell => {
            cell.classList.remove('highlight');
        });
    }

    // 게임 시작
    redrawBoard(INITIAL_TILES_DATA);
    startTurn();
});