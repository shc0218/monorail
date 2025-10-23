document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const resetButton = document.getElementById('reset-button');
    const nextTurnButton = document.getElementById('next-turn-button');
    const noSolutionButton = document.getElementById('no-solution-button');
    const showRulesButton = document.getElementById('show-rules-button'); // 새로 추가
    const rulesModal = document.getElementById('rules-modal');             // 새로 추가
    const closeModalSpan = document.querySelector('#rules-modal .close'); // 새로 추가

    const turnInfo = document.getElementById('turn-info');
    const palette = document.getElementById('palette');
    const tileVariantsContainer = document.getElementById('tile-variants');

    const BOARD_SIZE = 8;
    const MAX_NEW_TILES = 3;

    // 초기 타일: y=5 (row: 5), x=4, 5 (col: 4, 5)에 타일 배치
    const INITIAL_TILES_DATA = [
        { row: 5, col: 4, index: 44, type: 'A', rotation: 0 },
        { row: 5, col: 5, index: 45, type: 'A', rotation: 0 }
    ];

    const PALETTE_TILES_DATA = [];
    [0, 90].forEach(rotation => { PALETTE_TILES_DATA.push({ type: 'A', rotation }); });
    [0, 90, 180, 270].forEach(rotation => { PALETTE_TILES_DATA.push({ type: 'B', rotation }); });
    const AI_TILES_OPTIONS = [...PALETTE_TILES_DATA];

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

    // ------------------- 타일 연결 정보 상수 (경로 찾기용) -------------------
    const TILE_CONNECTIONS = {
        'A-0': [[0, -1], [0, 1]],          // 수평 직선
        'A-90': [[-1, 0], [1, 0]],         // 수직 직선
        'B-0': [[1, 0], [0, 1]],           // 오른쪽-아래 코너
        'B-90': [[1, 0], [0, -1]],        // 왼쪽-아래 코너
        'B-180': [[-1, 0], [0, -1]],      // 왼쪽-위 코너
        'B-270': [[-1, 0], [0, 1]]       // 오른쪽-위 코너
    };

    // ------------------- 경로 확인 로직 (Pathfinding) -------------------
    function areTilesConnected(r1, c1, r2, c2, tile1Data, tile2Data) {
        const dr = r2 - r1; const dc = c2 - c1;
        const conn1Key = `${tile1Data.type}-${tile1Data.rotation}`;
        const conn1Dirs = TILE_CONNECTIONS[conn1Key] || [];
        const isConn1Valid = conn1Dirs.some(([dirR, dirC]) => dirR === dr && dirC === dc);
        if (!isConn1Valid) return false;
        const conn2Key = `${tile2Data.type}-${tile2Data.rotation}`;
        const conn2Dirs = TILE_CONNECTIONS[conn2Key] || [];
        const isConn2Valid = conn2Dirs.some(([dirR, dirC]) => dirR === -dr && dirC === -dc);
        return isConn2Valid;
    }

    function createMatrix(tiles) {
        const matrix = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
        tiles.forEach(tileData => {
            matrix[tileData.row][tileData.col] = { type: tileData.type, rotation: tileData.rotation };
        });
        return matrix;
    }

    // 깊이 우선 탐색 (DFS)을 사용하여 전체 타일을 사용한 닫힌 고리(Loop)가 있는지 확인
    function dfs(matrix, r, c, visited, parentR, parentC, totalTilesCount, depth) {
        visited[r][c] = true;
        const currentTile = matrix[r][c];
        if (!currentTile) return false;

        const connKey = `${currentTile.type}-${currentTile.rotation}`;
        const directions = TILE_CONNECTIONS[connKey] || [];

        for (const [dr, dc] of directions) {
            const nextR = r + dr;
            const nextC = c + dc;
            if (nextR < 0 || nextR >= BOARD_SIZE || nextC < 0 || nextC >= BOARD_SIZE) continue;

            const neighborTile = matrix[nextR][nextC];

            if (!neighborTile || !areTilesConnected(r, c, nextR, nextC, currentTile, neighborTile)) {
                continue;
            }

            if (visited[nextR][nextC]) {
                // 고리가 발견되었으며, 시작 타일로 돌아온 경우
                if (nextR !== parentR || nextC !== parentC) {
                    // 그리고 이 고리가 전체 타일 수를 포함하는 경우 (즉, 모든 타일이 하나의 고리)
                    if (depth === totalTilesCount) {
                        return true;
                    }
                    return false; // 고리는 발견되었으나 전체 타일을 사용하지 않음
                }
                continue;
            }

            // 재귀 탐색
            if (dfs(matrix, nextR, nextC, visited, r, c, totalTilesCount, depth + 1)) {
                return true;
            }
        }
        return false;
    }

    function isPathClosedLoop(boardMatrix, placedTiles) {
        const totalTilesCount = placedTiles.length;
        if (totalTilesCount < 4) return false;

        // 보드에 배치된 모든 타일을 시작점으로 시도해야 함 (고리의 시작점이 어디일지 모르기 때문)
        for (const startTile of placedTiles) {
            const visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
            // depth는 1부터 시작 (현재 타일 포함)
            if (dfs(boardMatrix, startTile.row, startTile.col, visited, -1, -1, totalTilesCount, 1)) {
                return true;
            }
        }
        return false;
    }

    // ----------------------------------------------------
    // 완성 불가능 선언 시 로직 (미래 가능성 검사)
    // ----------------------------------------------------

    function areAllTilesConnectedAsOneComponent(boardMatrix, placedTiles) {
        if (placedTiles.length <= 1) return true;

        const totalTiles = placedTiles.length;
        let visitedCount = 0;
        const startTile = placedTiles[0];

        const visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));

        function checkConnectionDFS(r, c) {
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || visited[r][c]) {
                return;
            }

            const currentTile = boardMatrix[r][c];
            if (!currentTile) return;

            visited[r][c] = true;
            visitedCount++;

            const connKey = `${currentTile.type}-${currentTile.rotation}`;
            const directions = TILE_CONNECTIONS[connKey] || [];

            for (const [dr, dc] of directions) {
                const nextR = r + dr;
                const nextC = c + dc;

                if (nextR >= 0 && nextR < BOARD_SIZE && nextC >= 0 && nextC < BOARD_SIZE) {
                    const neighborTile = boardMatrix[nextR][nextC];

                    if (neighborTile && areTilesConnected(r, c, nextR, nextC, currentTile, neighborTile)) {
                        checkConnectionDFS(nextR, nextC);
                    }
                }
            }
        }

        checkConnectionDFS(startTile.row, startTile.col);
        return visitedCount === totalTiles;
    }

    function isSolutionPossible(placedTiles) {
        const totalPlaced = placedTiles.length;
        const remainingCells = BOARD_SIZE * BOARD_SIZE - totalPlaced;

        if (totalPlaced < 4) return true;

        const boardMatrix = createMatrix(placedTiles);

        // 1. 단일 연결성 검사: 모든 타일이 하나의 경로로 연결되어 있지 않다면, 완성 불가능.
        if (!areAllTilesConnectedAsOneComponent(boardMatrix, placedTiles)) {
            console.log("-> [가능성 검사]: 모든 타일이 경로상 단일 덩어리(컴포넌트)를 이루지 못했습니다. 완성 불가능!");
            return false;
        }

        // 2. (휴리스틱) 공간이 너무 부족할 때 고리가 없으면 불가능 판단.
        if (totalPlaced >= 10 && remainingCells <= 5) {
            if (!isPathClosedLoop(boardMatrix, placedTiles)) {
                console.log("-> [가능성 검사]: 빈 칸이 너무 적고 고리가 없습니다. 완성 불가능!");
                return false;
            }
        }

        return true;
    }

    // ----------------------------------------------------
    // 완성 불가능 선언 핸들러 (Alert 및 초기화)
    // ----------------------------------------------------
    function handleNoSolution(initiator) {
        const isPossible = isSolutionPossible(placedTiles);
        let message = '';

        console.log(`\n==============================================`);
        console.log(`[${initiator}]가 '완성 불가능'을 선언했습니다. (총 타일 ${placedTiles.length}개)`);

        if (isPossible) {
            console.log("--- 💀 패배! (성급한 선언) ---");
            message = `패배! 🚫 아직 모든 타일을 연결하여 고리를 만들 가능성이 남아있습니다.`;
        } else {
            console.log("--- 🏆 승리! (정확한 예측) ---");
            message = `승리! 🎉 현재 상태로는 모든 타일을 연결하여 고리를 만드는 것이 불가능합니다.`;
        }
        console.log("==============================================\n");

        // NOTE: 사용자 요청에 따라 alert() 사용
        alert(`${initiator} ${message}`);

        // 게임 종료 후 초기화
        initializeGame();
    }

    // ----------------------------------------------------
    // 턴 종료 시 고리 완성 확인 함수
    // ----------------------------------------------------
    function checkClosedLoopVictory(isPlayer) {
        const boardMatrix = createMatrix(placedTiles);
        const isLoop = isPathClosedLoop(boardMatrix, placedTiles);

        if (isLoop) {
            const winner = isPlayer ? "플레이어" : "AI";
            console.log(`--- 🏆 ${winner} 승리: 모든 타일이 고리 완성! ---`);

            // NOTE: 사용자 요청에 따라 alert() 사용
            alert(`🎉 축하합니다! ${winner} 승리: 모든 타일이 완벽한 하나의 고리를 완성했습니다!`);

            initializeGame();
            return true; // 게임 종료
        }
        return false; // 게임 계속
    }


    // ------------------- 초기화 함수 -------------------
    function initializeGame() {
        placedTiles = [];
        newTilesCount = 0;
        turnStartTilesState = [];
        isPlayerTurn = true;
        redrawBoard(INITIAL_TILES_DATA);

        // 버튼 상태 초기화
        nextTurnButton.disabled = false;
        resetButton.disabled = false;
        noSolutionButton.disabled = false;

        startTurn();
    }

    // ------------------- 기타 유틸리티 및 턴 관리 함수 -------------------

    function setTileAppearance(tileElement, type, rotation) {
        tileElement.classList.forEach(cls => {
            if (cls.startsWith('tile-') && cls.includes(type)) {
                tileElement.classList.remove(cls);
            }
        });
        const appearanceClass = `tile-${type}-${rotation}`;
        tileElement.classList.add(appearanceClass);
    }

    function removeHighlights() {
        cells.forEach(cell => {
            cell.classList.remove('highlight');
        });
    }

    function generatePaletteTiles() {
        tileVariantsContainer.innerHTML = '';
        PALETTE_TILES_DATA.forEach((data) => {
            const tile = document.createElement('div');
            tile.classList.add('tile', 'draggable');
            tile.setAttribute('draggable', true);
            tile.setAttribute('data-type', data.type);
            tile.setAttribute('data-rotation', data.rotation);
            setTileAppearance(tile, data.type, data.rotation);
            tileVariantsContainer.appendChild(tile);
        });
        attachDragListeners();
    }

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
            setTileAppearance(tile, tileData.type, tileData.rotation || 0);
            tile.style.margin = '0';
            cell.appendChild(tile);
        });
        placedTiles = JSON.parse(JSON.stringify(tilesData));
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
        noSolutionButton.disabled = !isPlayerTurn;
        if (isPlayerTurn) {
            generatePaletteTiles();
        }
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

    /**
     * 플레이어 턴 종료 로직 (고리 완성 확인 포함)
     */
    function passTurn() {
        if (isPlayerTurn) {
            // 1. 타일을 배치했다면 고리 완성 여부 확인
            if (newTilesCount > 0) {
                if (checkClosedLoopVictory(true)) {
                    return; // 승리로 게임 종료
                }
            }

            // 2. 승리가 아니면 AI 턴으로 전환
            isPlayerTurn = false;
            startTurn();
        }
    }

    /**
     * AI 턴 로직 (10% 완성 불가능 및 고리 완성 확인 포함)
     */
    function AITurn() {
        // 1. 10% 확률로 완성 불가능 선언 시도 (게임이 여기서 끝날 수 있음)
        if (Math.random() < 0.10) {
            console.log("[AI] 완성 불가능 선언을 시도합니다.");
            handleNoSolution('AI');
            return;
        }

        // 2. 일반 타일 배치 로직
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
                const randomOptionIndex = Math.floor(Math.random() * AI_TILES_OPTIONS.length);
                const { type: randomType, rotation: randomRotation } = AI_TILES_OPTIONS[randomOptionIndex];
                const randomIndex = Math.floor(Math.random() * validDrops.length);
                const dropLocation = validDrops[randomIndex];
                const targetCell = cells[dropLocation.index];
                const tile = document.createElement('div');
                tile.classList.add('tile');
                setTileAppearance(tile, randomType, randomRotation);
                tile.style.margin = '0';
                targetCell.appendChild(tile);
                placedTiles.push({ ...dropLocation, type: randomType, rotation: randomRotation });
                placedThisTurn++;
            } else {
                break;
            }
        }
        console.log(`[AI] 타일 ${placedThisTurn}개 배치 완료.`);

        // 3. AI의 타일 배치 후 고리 완성 여부 확인
        if (placedThisTurn > 0) {
            if (checkClosedLoopVictory(false)) {
                return; // 승리로 게임 종료
            }
        }

        // 4. 승리가 아니면 플레이어 턴으로 전환
        isPlayerTurn = true;
        startTurn();
    }

    function attachDragListeners() {
        palette.querySelectorAll('.draggable').forEach(tile => {
            tile.addEventListener('dragstart', (e) => {
                if (!isPlayerTurn || newTilesCount >= MAX_NEW_TILES) {
                    e.preventDefault();
                    return;
                }
                const rotation = e.target.dataset.rotation;
                e.dataTransfer.setDragImage(e.target, 25, 25);
                e.dataTransfer.setData('text/type', e.target.dataset.type);
                e.dataTransfer.setData('text/rotation', rotation);
                e.target.classList.add('is-dragging');
            });
            tile.addEventListener('dragend', (e) => {
                e.target.classList.remove('is-dragging');
                removeHighlights();
                draggedTile = null;
            });
        });
    }

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
            const type = e.dataTransfer.getData('text/type');
            const rotation = parseInt(e.dataTransfer.getData('text/rotation'));

            if (isPlayerTurn && cell.children.length === 0 && type && !isNaN(rotation) && isValidPlacement(cell, newTilesCount) && newTilesCount < MAX_NEW_TILES) {
                const newTile = document.createElement('div');
                newTile.classList.add('tile');
                setTileAppearance(newTile, type, rotation);
                newTile.style.margin = '0';
                cell.appendChild(newTile);
                newTilesCount++;
                const r = parseInt(cell.dataset.row);
                const c = parseInt(cell.dataset.col);
                const idx = parseInt(cell.dataset.index);
                placedTiles.push({ row: r, col: c, index: idx, type: type, rotation: rotation });
                draggedTile = null;
                console.log(`[플레이어] 타일 배치 완료: (${r}, ${c}). 회전: ${rotation}deg. 현재 타일 수: ${newTilesCount}/${MAX_NEW_TILES}`);
            }
            removeHighlights();
        });
    });

    function isValidPlacement(cell, currentCount) {
        if (cell.children.length > 0) return false;
        const targetRow = parseInt(cell.dataset.row);
        const targetCol = parseInt(cell.dataset.col);
        let validNeighbors = [];
        const currentPlacedCount = placedTiles.length;
        if (currentCount === 0) {
            validNeighbors = turnStartTilesState;
        } else if (currentCount === 1) {
            const previousTiles = placedTiles.slice(turnStartTilesState.length);
            validNeighbors = [...turnStartTilesState, ...previousTiles];
        } else if (currentCount === 2) {
            if (currentPlacedCount < turnStartTilesState.length + 2) return false;
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


    // ------------------- 모달 이벤트 리스너 (새로 추가) -------------------
    showRulesButton.onclick = function() {
        rulesModal.style.display = "block";
    }

    closeModalSpan.onclick = function() {
        rulesModal.style.display = "none";
    }

    // 모달 밖 클릭 시 닫기
    window.onclick = function(event) {
        if (event.target == rulesModal) {
            rulesModal.style.display = "none";
        }
    }

    // ------------------- 게임 이벤트 리스너 연결 -------------------
    resetButton.addEventListener('click', resetCurrentTurn);
    nextTurnButton.addEventListener('click', passTurn);
    noSolutionButton.addEventListener('click', () => handleNoSolution('플레이어'));

    // 게임 시작
    initializeGame();
});