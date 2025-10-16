document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const palette = document.getElementById('palette');
    const resetButton = document.getElementById('reset-button');
    const nextTurnButton = document.getElementById('next-turn-button');
    const incompleteButton = document.getElementById('incomplete-button');
    const turnInfo = document.getElementById('turn-info');
    const timerDisplay = document.getElementById('timer-display');

    const BOARD_SIZE = 8;
    const MAX_NEW_TILES = 3;

    // 초기 타일 위치 데이터 (4,4, 4,5)
    const INITIAL_TILES_DATA = [
        { row: 4, col: 4, index: 36, type: 'A' },
        { row: 4, col: 5, index: 37, type: 'A' }
    ];

    // ✨ 이미지 경로 매핑 상수 추가 ✨
    const TILE_IMAGE_MAP = {
        'A': 'url(image/line.png)',
        'B': 'url(image/angle.png)'
    };

    // 타일 색상 상수 정의 (이제 사용되지 않지만 유지를 위해 남겨둠)
    const INITIAL_TILE_COLOR = '#66cdaa';
    const GENERAL_TILE_COLOR = '#f0e68c';

    // ------------------- 게임 상태 관리 -------------------
    let isPlayerTurn = true;
    let draggedTile = null;
    let placedTiles = [];
    let newTilesCount = 0;
    let turnStartTilesState = [];

    // ------------------- 타이머 상태 관리 -------------------
    let timerInterval = null;
    let timeLeft = 60;


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

    // ------------------- 타이머 및 승패 함수 -------------------
    function declareWinner(initiator) {
        alert(`${initiator}가 '미완성'을 선언했습니다! 승패 판정 로직을 실행합니다.`);
    }

    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        if (timerDisplay) {
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        if (timeLeft <= 0) {
            stopTimer();
            alert("타이머 시간이 초과되었습니다!");
        }

        timeLeft--;
    }

    function startTimer() {
        stopTimer();
        timeLeft = 60;
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
        console.log("1분 타이머가 실행되었습니다.");
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            if (timerDisplay) timerDisplay.textContent = `--:--`;
        }
    }

    function handleIncomplete(initiator) {
        if (initiator === 'AI') {
            startTimer();
        }
        declareWinner(initiator);
    }

    // ------------------- 유틸리티 함수 (이미지 적용) -------------------

    function setTileImage(tileElement, type) {
        // ✨ 타일 유형에 따라 배경 이미지 적용
        tileElement.style.backgroundImage = TILE_IMAGE_MAP[type] || 'none';
        tileElement.textContent = `${type} 타일`; // 텍스트는 CSS로 숨김 처리됨
    }

    function removeHighlights() {
        cells.forEach(cell => {
            cell.classList.remove('highlight');
        });
    }

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
            setTileImage(tile, tileData.type); // ✨ 이미지 적용

            // 타일 색상 로직은 이미지 적용으로 대체되지만, 클래스는 유지할 수 있음
            // const isInitial = INITIAL_TILES_DATA.some(t => t.index === tileData.index);
            // tile.style.backgroundColor = isInitial ? INITIAL_TILE_COLOR : GENERAL_TILE_COLOR;
            tile.style.margin = '0';

            cell.appendChild(tile);
        });

        placedTiles = [...tilesData];

        // ✨ 팔레트 타일에도 이미지 적용 ✨
        palette.querySelectorAll('.draggable').forEach(tile => {
            setTileImage(tile, tile.dataset.type);
        });
    }

    function startTurn() {
        newTilesCount = 0;
        turnStartTilesState = JSON.parse(JSON.stringify(placedTiles));

        if (turnInfo) {
            turnInfo.textContent = isPlayerTurn ? "플레이어 턴" : "AI 턴";
        }

        palette.style.pointerEvents = isPlayerTurn ? 'auto' : 'none';
        nextTurnButton.disabled = !isPlayerTurn;
        resetButton.disabled = !isPlayerTurn;
        incompleteButton.disabled = !isPlayerTurn;

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
        const AITilesToPlace = Math.floor(Math.random() * MAX_NEW_TILES) + 1;
        let placedThisTurn = 0;

        for (let i = 0; i < AITilesToPlace; i++) {
            const currentCount = i;
            let validDrops = [];

            cells.forEach(cell => {
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

                const randomIndex = Math.floor(Math.random() * validDrops.length);
                const dropLocation = validDrops[randomIndex];
                const targetCell = cells[dropLocation.index];

                const tile = document.createElement('div');
                tile.classList.add('tile');

                setTileImage(tile, randomType); // ✨ 이미지 적용

                tile.style.margin = '0';

                targetCell.appendChild(tile);

                placedTiles.push({ ...dropLocation, type: randomType  });
                placedThisTurn++;
            } else {
                break;
            }
        }

        console.log(`AI 턴 완료. 총 ${placedThisTurn}개 배치.`);

        isPlayerTurn = true;
        startTurn();
    }

    // ------------------- 드래그 & 드롭 이벤트 핸들러 -------------------

    // 팔레트의 드래그 시작/종료 이벤트
    palette.querySelectorAll('.draggable').forEach(tile => {
        tile.addEventListener('dragstart', (e) => {
            if (!isPlayerTurn || newTilesCount >= MAX_NEW_TILES) {
                e.preventDefault();
                return;
            }

            // draggedTile에 원본 타일의 복사본을 저장합니다.
            const clonedTile = e.target.cloneNode(true);
            clonedTile.classList.add('is-dragging');
            draggedTile = clonedTile;

            e.dataTransfer.setData('text/plain', e.target.dataset.type);
            e.target.classList.add('is-dragging'); // 원본 타일에도 드래그 효과 적용
        });

        tile.addEventListener('dragend', (e) => {
            e.target.classList.remove('is-dragging');
            removeHighlights();
            draggedTile = null;
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

                const type = draggedTile.dataset.type;

                const newTile = document.createElement('div');
                newTile.classList.add('tile');

                setTileImage(newTile, type); // ✨ 이미지 적용

                newTile.style.margin = '0';

                cell.appendChild(newTile);

                // 2. 게임 상태 업데이트
                newTilesCount++;
                const r = parseInt(cell.dataset.row);
                const c = parseInt(cell.dataset.col);
                const idx = parseInt(cell.dataset.index);
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
            if (currentPlacedCount === turnStartTilesState.length) {
                validNeighbors = placedTiles;
            } else {
                validNeighbors = [placedTiles[placedTiles.length - 1]];
            }
        } else if (currentCount === 2) {
            if (currentPlacedCount < 2) return false;
            validNeighbors = [placedTiles[placedTiles.length - 1], placedTiles[placedTiles.length - 2]];
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

    // ------------------- 이벤트 리스너 연결 -------------------
    resetButton.addEventListener('click', resetCurrentTurn);
    nextTurnButton.addEventListener('click', passTurn);
    incompleteButton.addEventListener('click', () => handleIncomplete('플레이어'));

    // 게임 시작
    redrawBoard(INITIAL_TILES_DATA);
    startTurn();
});