// 用户版本 - 寝室厨房打扫系统（实时同步版本）
class UserVersionSync {
    constructor() {
        // 房间顺序
        this.roomOrder = [301, 303, 305, 307, 309, 311, 302, 304, 306, 308, 310, 312, 314, 316, 318, 320, 322, 324, 326, 328, 330, 332, 334, 336, 338, 340, 342];
        
        // 当前用户房间
        this.currentUserRoom = null;
        
        // 系统状态
        this.state = {
            currentDate: new Date(),
            currentRoomIndex: 0,
            skippedRooms: [], // 永久跳过的房间
            cleaningHistory: [] // 打扫历史记录
        };

        // DOM元素
        this.domElements = {};

        // Firebase连接状态
        this.firebaseConnected = false;
        this.isSyncing = false;

        // 初始化系统
        this.init();
    }

    // 初始化系统
    async init() {
        this.cacheDOM();
        await this.initFirebase();
        
        // 如果Firebase未连接，加载本地状态
        if (!this.firebaseConnected) {
            this.loadLocalState();
        }
        
        this.setupEventListeners();
        this.generateRoomButtons();
        this.updateDateDisplay();
        
        // 检查是否已经选择了房间
        const savedRoom = sessionStorage.getItem('currentUserRoom');
        if (savedRoom) {
            this.currentUserRoom = savedRoom;
            this.showSystemInfo();
        }
        
        this.startAutoUpdate();
    }

    // 缓存DOM元素
    cacheDOM() {
        this.domElements = {
            currentDate: document.getElementById('current-date'),
            connectionBadge: document.getElementById('connection-badge'),
            roomsGrid: document.getElementById('rooms-grid'),
            enterBtn: document.getElementById('enter-btn'),
            systemInfo: document.getElementById('system-info'),
            currentRoom: document.getElementById('current-room'),
            roomStatus: document.getElementById('room-status'),
            myRoomNumber: document.getElementById('my-room-number'),
            myRoomStatus: document.getElementById('my-room-status'),
            toggleSkipBtn: document.getElementById('toggle-skip-btn'),
            activeCount: document.getElementById('active-count'),
            skipCount: document.getElementById('skip-count'),
            roomsContainer: document.getElementById('rooms-container'),
            cameraInput: document.getElementById('camera-input'),
            uploadBtn: document.getElementById('upload-btn'),
            historyList: document.getElementById('history-list'),
            changeRoomBtn: document.getElementById('change-room-btn'),
            skipModal: new bootstrap.Modal(document.getElementById('skipModal')),
            rejoinModal: new bootstrap.Modal(document.getElementById('rejoinModal')),
            skipRoomNumber: document.getElementById('skip-room-number'),
            rejoinRoomNumber: document.getElementById('rejoin-room-number'),
            confirmSkip: document.getElementById('confirm-skip'),
            confirmRejoin: document.getElementById('confirm-rejoin')
        };
    }

    // 初始化Firebase
    async initFirebase() {
        try {
            // 检查Firebase配置
            if (!firebaseConfig || firebaseConfig.apiKey === "your-api-key-here") {
                console.warn("Firebase配置未设置，使用本地存储模式");
                this.updateConnectionStatus('local');
                return;
            }

            // 检查连接
            const connected = await FirebaseManager.checkConnection();
            if (connected) {
                this.firebaseConnected = true;
                this.updateConnectionStatus('connected');
                
                // 加载云端状态
                await this.loadCloudState();
                
                // 设置实时监听
                FirebaseManager.setRealtimeListener((state) => {
                    if (!this.isSyncing) {
                        this.state = state;
                        this.updateSystemUI();
                        this.showNotification('系统状态已更新', 'info');
                    }
                });
            } else {
                this.updateConnectionStatus('error');
            }
        } catch (error) {
            console.error("Firebase初始化失败:", error);
            this.updateConnectionStatus('error');
        }
    }

    // 更新连接状态显示
    updateConnectionStatus(status) {
        const badge = this.domElements.connectionBadge;
        switch(status) {
            case 'connected':
                badge.textContent = '✓ 已连接';
                badge.className = 'badge bg-success';
                break;
            case 'local':
                badge.textContent = '⚠ 本地模式';
                badge.className = 'badge bg-warning';
                break;
            case 'error':
                badge.textContent = '✗ 连接失败';
                badge.className = 'badge bg-danger';
                break;
            default:
                badge.textContent = '连接中...';
                badge.className = 'badge bg-warning';
        }
    }

    // 加载云端状态
    async loadCloudState() {
        try {
            const cloudState = await FirebaseManager.loadState();
            if (cloudState) {
                this.state = cloudState;
                // 强制更新日期为当前日期，确保日期正确
                this.state.currentDate = new Date();
                this.saveLocalState(); // 同步到本地
                return true;
            }
        } catch (error) {
            console.error("加载云端状态失败:", error);
        }
        return false;
    }

    // 保存状态到云端和本地
    async saveState() {
        // 保存到本地
        this.saveLocalState();
        
        // 如果Firebase已连接，保存到云端
        if (this.firebaseConnected) {
            this.isSyncing = true;
            try {
                await FirebaseManager.saveState(this.state);
            } catch (error) {
                console.error("保存到云端失败:", error);
                this.showNotification('保存失败，请检查网络连接', 'error');
            } finally {
                this.isSyncing = false;
            }
        }
    }

    // 保存到本地存储
    saveLocalState() {
        const stateToSave = {
            ...this.state,
            currentDate: this.state.currentDate.toISOString(),
            lastCleaningDate: this.state.lastCleaningDate ? this.state.lastCleaningDate.toISOString() : null
        };
        localStorage.setItem('kitchenCleaningState', JSON.stringify(stateToSave));
    }

    // 从本地存储加载状态
    loadLocalState() {
        const savedState = localStorage.getItem('kitchenCleaningState');
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            this.state = {
                ...this.state,
                ...parsedState,
                currentDate: new Date(), // 总是使用当前日期
                lastCleaningDate: parsedState.lastCleaningDate ? new Date(parsedState.lastCleaningDate) : null
            };
        } else {
            // 首次使用，设置初始状态并自动计算房间索引
            this.updateCurrentRoomIndex();
            this.saveLocalState();
        }
    }

    // 更新当前房间索引（基于日期）
    updateCurrentRoomIndex() {
        const startDate = new Date('2025-11-01'); // 从固定日期开始
        const today = new Date();
        const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        
        const activeRooms = this.getActiveRooms();
        this.state.currentRoomIndex = daysDiff % activeRooms.length;
    }

    // 获取活跃房间列表（排除永久跳过的房间）
    getActiveRooms() {
        return this.roomOrder.filter(room => !this.state.skippedRooms.includes(room));
    }

    // 获取当前打扫房间
    getCurrentRoom() {
        const activeRooms = this.getActiveRooms();
        return activeRooms[this.state.currentRoomIndex] || activeRooms[0] || '无';
    }

    // 设置事件监听器
    setupEventListeners() {
        // 进入系统按钮
        this.domElements.enterBtn.addEventListener('click', () => {
            this.showSystemInfo();
        });

        // 更换房间按钮
        this.domElements.changeRoomBtn.addEventListener('click', () => {
            this.showRoomSelection();
        });

        // 跳过/重新加入按钮
        this.domElements.toggleSkipBtn.addEventListener('click', () => {
            this.toggleSkipStatus();
        });

        // 永久跳过确认
        this.domElements.confirmSkip.addEventListener('click', () => {
            this.permanentlySkipRoom();
        });

        // 重新加入确认
        this.domElements.confirmRejoin.addEventListener('click', () => {
            this.rejoinRoom();
        });

            // 拍照上传
            this.domElements.cameraInput.addEventListener('change', (e) => {
                this.handleImageUpload(e);
            });

            this.domElements.uploadBtn.addEventListener('click', () => {
                this.confirmCleaning();
            });

            // 手动标记完成
            this.domElements.markCompleteBtn = document.getElementById('mark-complete-btn');
            this.domElements.markCompleteBtn.addEventListener('click', () => {
                this.markCleaningComplete();
            });
    }

    // 生成房间按钮
    generateRoomButtons() {
        this.domElements.roomsGrid.innerHTML = '';
        
        this.roomOrder.forEach(room => {
            const button = document.createElement('button');
            button.className = 'room-btn';
            button.textContent = room;
            button.onclick = () => this.selectRoom(room);
            this.domElements.roomsGrid.appendChild(button);
        });
    }

    // 选择房间
    selectRoom(room) {
        this.currentUserRoom = room;
        
        // 移除所有选中状态
        document.querySelectorAll('.room-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // 添加选中状态到当前房间
        event.target.classList.add('selected');
        
        // 启用进入按钮
        this.domElements.enterBtn.disabled = false;
    }

    // 显示系统信息
    showSystemInfo() {
        if (!this.currentUserRoom) return;
        
        // 保存选择的房间到sessionStorage
        sessionStorage.setItem('currentUserRoom', this.currentUserRoom);
        
        // 隐藏房间选择区域，显示系统信息
        document.querySelector('.card:first-child').style.display = 'none';
        this.domElements.systemInfo.style.display = 'block';
        
        // 更新系统信息
        this.updateSystemUI();
    }

    // 显示房间选择
    showRoomSelection() {
        // 清除当前选择
        this.currentUserRoom = null;
        sessionStorage.removeItem('currentUserRoom');
        
        // 显示房间选择区域，隐藏系统信息
        document.querySelector('.card:first-child').style.display = 'block';
        this.domElements.systemInfo.style.display = 'none';
        
        // 重置按钮状态
        this.domElements.enterBtn.disabled = true;
        document.querySelectorAll('.room-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
    }

    // 开始自动更新
    startAutoUpdate() {
        // 每分钟更新一次日期和时间
        setInterval(() => {
            this.state.currentDate = new Date();
            this.updateDateDisplay();
            if (this.currentUserRoom) {
                this.updateSystemUI();
            }
        }, 60000);
    }

    // 更新日期显示
    updateDateDisplay() {
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        };
        this.domElements.currentDate.textContent = this.state.currentDate.toLocaleDateString('zh-CN', options);
    }

    // 更新系统UI
    updateSystemUI() {
        this.updateCurrentRoomDisplay();
        this.updateMyRoomStatus();
        this.updateRoomList();
        this.updateStatistics();
        this.updateHistory();
    }

    // 更新当前房间显示
    updateCurrentRoomDisplay() {
        const currentRoom = this.getCurrentRoom();
        this.domElements.currentRoom.textContent = currentRoom;
        
        // 检查今天是否已经打扫过
        const today = this.state.currentDate.toDateString();
        const todayCleaned = this.state.cleaningHistory.some(record => 
            new Date(record.date).toDateString() === today && record.room === currentRoom
        );

        if (todayCleaned) {
            this.domElements.roomStatus.textContent = '✓ 今日已打扫';
            this.domElements.roomStatus.className = 'mt-2 text-success fw-bold';
        } else {
            this.domElements.roomStatus.textContent = '待打扫';
            this.domElements.roomStatus.className = 'mt-2 text-warning fw-bold';
        }
    }

    // 更新我的房间状态
    updateMyRoomStatus() {
        this.domElements.myRoomNumber.textContent = this.currentUserRoom;
        
        const isSkipped = this.state.skippedRooms.includes(parseInt(this.currentUserRoom));
        const currentRoom = this.getCurrentRoom();
        const isMyTurn = parseInt(this.currentUserRoom) === currentRoom;
        const today = this.state.currentDate.toDateString();
        const todayCleaned = this.state.cleaningHistory.some(record => 
            new Date(record.date).toDateString() === today && record.room === currentRoom
        );
        
        // 更新手动标记完成按钮状态
        if (isMyTurn && !todayCleaned) {
            this.domElements.markCompleteBtn.disabled = false;
        } else {
            this.domElements.markCompleteBtn.disabled = true;
        }
        
        if (isSkipped) {
            this.domElements.myRoomStatus.textContent = '状态: 永久跳过';
            this.domElements.myRoomStatus.className = 'h5 mb-4 text-danger';
            this.domElements.toggleSkipBtn.textContent = '重新加入打扫';
            this.domElements.toggleSkipBtn.className = 'btn btn-success btn-lg w-100';
        } else if (isMyTurn && todayCleaned) {
            this.domElements.myRoomStatus.textContent = '状态: 今日已打扫 ✓';
            this.domElements.myRoomStatus.className = 'h5 mb-4 text-success';
            this.domElements.toggleSkipBtn.textContent = '永久跳过打扫';
            this.domElements.toggleSkipBtn.className = 'btn btn-danger btn-lg w-100';
        } else if (isMyTurn) {
            this.domElements.myRoomStatus.textContent = '状态: 今日轮到打扫';
            this.domElements.myRoomStatus.className = 'h5 mb-4 text-warning';
            this.domElements.toggleSkipBtn.textContent = '永久跳过打扫';
            this.domElements.toggleSkipBtn.className = 'btn btn-danger btn-lg w-100';
        } else {
            this.domElements.myRoomStatus.textContent = '状态: 参与打扫';
            this.domElements.myRoomStatus.className = 'h5 mb-4 text-info';
            this.domElements.toggleSkipBtn.textContent = '永久跳过打扫';
            this.domElements.toggleSkipBtn.className = 'btn btn-danger btn-lg w-100';
        }
    }

    // 切换跳过状态
    toggleSkipStatus() {
        const isSkipped = this.state.skippedRooms.includes(parseInt(this.currentUserRoom));
        
        if (isSkipped) {
            // 显示重新加入确认模态框
            this.domElements.rejoinRoomNumber.textContent = this.currentUserRoom;
            this.domElements.rejoinModal.show();
        } else {
            // 显示跳过确认模态框
            this.domElements.skipRoomNumber.textContent = this.currentUserRoom;
            this.domElements.skipModal.show();
        }
    }

    // 永久跳过房间
    async permanentlySkipRoom() {
        if (!this.state.skippedRooms.includes(parseInt(this.currentUserRoom))) {
            this.state.skippedRooms.push(parseInt(this.currentUserRoom));
            this.updateCurrentRoomIndex(); // 重新计算当前房间
            
            await this.saveState();
            this.updateSystemUI();
            this.domElements.skipModal.hide();
            this.showNotification(`房间 ${this.currentUserRoom} 已永久跳过打扫`, 'success');
        }
    }

    // 重新加入房间
    async rejoinRoom() {
        this.state.skippedRooms = this.state.skippedRooms.filter(room => room !== parseInt(this.currentUserRoom));
        this.updateCurrentRoomIndex(); // 重新计算当前房间
        
        await this.saveState();
        this.updateSystemUI();
        this.domElements.rejoinModal.hide();
        this.showNotification(`房间 ${this.currentUserRoom} 已重新加入打扫顺序`, 'success');
    }

    // 更新房间列表
    updateRoomList() {
        const activeRooms = this.getActiveRooms();
        const currentRoom = this.getCurrentRoom();
        
        this.domElements.roomsContainer.innerHTML = '';
        
        this.roomOrder.forEach(room => {
            const isActive = activeRooms.includes(room);
            const isCurrent = room === currentRoom;
            const isSkipped = this.state.skippedRooms.includes(room);
            const isUserRoom = room === parseInt(this.currentUserRoom);
            
            const roomCard = this.createRoomCard(room, isActive, isCurrent, isSkipped, isUserRoom);
            this.domElements.roomsContainer.appendChild(roomCard);
        });
    }

    // 创建房间卡片
    createRoomCard(room, isActive, isCurrent, isSkipped, isUserRoom) {
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-lg-3 mb-3';
        
        const card = document.createElement('div');
        card.className = `room-card ${isCurrent ? 'active' : ''} ${isSkipped ? 'skipped' : ''} ${isUserRoom ? 'border-primary' : ''}`;
        if (isUserRoom) {
            card.style.borderWidth = '3px';
        }
        
        const roomNumber = document.createElement('div');
        roomNumber.className = 'room-number';
        roomNumber.textContent = room;
        if (isUserRoom) {
            roomNumber.innerHTML = `${room} <small class="badge bg-primary">我的</small>`;
        }
        
        const roomStatus = document.createElement('div');
        roomStatus.className = 'room-status';
        
        if (isSkipped) {
            roomStatus.textContent = '永久跳过';
            roomStatus.className += ' text-danger';
        } else if (isCurrent) {
            roomStatus.textContent = '今日打扫';
            roomStatus.className += ' text-success';
        } else {
            roomStatus.textContent = '等待中';
            roomStatus.className += ' text-muted';
        }
        
        card.appendChild(roomNumber);
        card.appendChild(roomStatus);
        col.appendChild(card);
        
        return col;
    }

    // 更新统计信息
    updateStatistics() {
        const activeRooms = this.getActiveRooms();
        this.domElements.activeCount.textContent = activeRooms.length;
        this.domElements.skipCount.textContent = this.state.skippedRooms.length;
    }

    // 处理图片上传
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.uploadedImage = e.target.result;
                
                // 检查是否轮到用户房间打扫
                const currentRoom = this.getCurrentRoom();
                if (parseInt(this.currentUserRoom) === currentRoom) {
                    this.domElements.uploadBtn.disabled = false;
                } else {
                    this.domElements.uploadBtn.disabled = true;
                    this.showNotification('今天不是您房间打扫，无法上传照片', 'error');
                }
            };
            reader.readAsDataURL(file);
        }
    }

    // 手动标记完成打扫
    async markCleaningComplete() {
        // 检查是否轮到用户房间打扫
        const currentRoom = this.getCurrentRoom();
        if (parseInt(this.currentUserRoom) !== currentRoom) {
            this.showNotification('今天不是您房间打扫，无法标记完成', 'error');
            return;
        }

        // 检查今天是否已经打扫过
        const today = this.state.currentDate.toDateString();
        const todayCleaned = this.state.cleaningHistory.some(record => 
            new Date(record.date).toDateString() === today && record.room === currentRoom
        );

        if (todayCleaned) {
            this.showNotification('今天已经标记过打扫完成了', 'info');
            return;
        }

        const cleaningRecord = {
            date: new Date().toISOString(),
            room: currentRoom,
            manual: true // 标记为手动完成
        };

        this.state.cleaningHistory.unshift(cleaningRecord);
        this.state.lastCleaningDate = new Date();
        
        await this.saveState();
        this.updateSystemUI();
        
        this.showNotification(`房间 ${currentRoom} 已标记为完成打扫`, 'success');
    }

    // 确认打扫完成（带照片）
    async confirmCleaning() {
        if (!this.uploadedImage) {
            this.showNotification('请先选择照片', 'error');
            return;
        }

        // 检查是否轮到用户房间打扫
        const currentRoom = this.getCurrentRoom();
        if (parseInt(this.currentUserRoom) !== currentRoom) {
            this.showNotification('今天不是您房间打扫，无法上传照片', 'error');
            return;
        }

        const cleaningRecord = {
            date: new Date().toISOString(),
            room: currentRoom,
            image: this.uploadedImage
        };

        this.state.cleaningHistory.unshift(cleaningRecord);
        this.state.lastCleaningDate = new Date();
        
        await this.saveState();
        this.updateSystemUI();
        
        // 重置上传状态
        this.domElements.cameraInput.value = '';
        this.domElements.uploadBtn.disabled = true;
        this.uploadedImage = null;
        
        this.showNotification(`房间 ${currentRoom} 打扫记录已保存`, 'success');
    }

    // 更新历史记录
    updateHistory() {
        this.domElements.historyList.innerHTML = '';
        
        // 显示最近10条记录
        const recentHistory = this.state.cleaningHistory.slice(0, 10);
        
        if (recentHistory.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'list-group-item text-muted text-center';
            emptyItem.textContent = '暂无打扫记录';
            this.domElements.historyList.appendChild(emptyItem);
            return;
        }
        
        recentHistory.forEach(record => {
            const historyItem = this.createHistoryItem(record);
            this.domElements.historyList.appendChild(historyItem);
        });
    }

    // 创建历史记录项
    createHistoryItem(record) {
        const item = document.createElement('div');
        item.className = 'list-group-item history-item completed';
        
        const date = new Date(record.date);
        const dateStr = date.toLocaleDateString('zh-CN');
        const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>房间 ${record.room}</strong>
                    <div class="text-muted small">${dateStr} ${timeStr}</div>
                </div>
                <span class="badge bg-success">已打扫</span>
            </div>
        `;
        
        return item;
    }

    // 显示通知
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 1050; min-width: 300px;';
        
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
}

// 当DOM加载完成后初始化系统
document.addEventListener('DOMContentLoaded', () => {
    new UserVersionSync();
});
