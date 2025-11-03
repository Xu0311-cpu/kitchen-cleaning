// 寝室厨房打扫管理系统
class KitchenCleaningSystem {
    constructor() {
        // 房间顺序（用户提供的顺序）
        this.roomOrder = [301, 303, 305, 307, 309, 311, 302, 304, 306, 308, 310, 312, 314, 316, 318, 320, 322, 324, 326, 328, 330, 332, 334, 336, 338, 340, 342];
        
        // 系统状态
        this.state = {
            currentDate: new Date(),
            currentRoomIndex: 0,
            skippedRooms: [], // 永久跳过的房间
            cleaningHistory: [], // 打扫历史记录
            lastCleaningDate: null // 上次打扫日期
        };

        // DOM元素
        this.domElements = {};

        // 初始化系统
        this.init();
    }

    // 初始化系统
    init() {
        this.cacheDOM();
        this.loadState();
        this.setupEventListeners();
        this.updateUI();
        this.startAutoUpdate();
    }

    // 缓存DOM元素
    cacheDOM() {
        this.domElements = {
            currentDate: document.getElementById('current-date'),
            currentRoom: document.getElementById('current-room'),
            roomStatus: document.getElementById('room-status'),
            activeCount: document.getElementById('active-count'),
            skipCount: document.getElementById('skip-count'),
            roomsContainer: document.getElementById('rooms-container'),
            cameraInput: document.getElementById('camera-input'),
            uploadBtn: document.getElementById('upload-btn'),
            historyList: document.getElementById('history-list'),
            adminBtn: document.getElementById('admin-btn'),
            adminModal: new bootstrap.Modal(document.getElementById('adminModal')),
            setRoomSelect: document.getElementById('set-room-select'),
            resetDataBtn: document.getElementById('reset-data'),
            saveAdminSettings: document.getElementById('save-admin-settings'),
            skipModal: new bootstrap.Modal(document.getElementById('skipModal')),
            rejoinModal: new bootstrap.Modal(document.getElementById('rejoinModal')),
            skipRoomNumber: document.getElementById('skip-room-number'),
            rejoinRoomNumber: document.getElementById('rejoin-room-number'),
            confirmSkip: document.getElementById('confirm-skip'),
            confirmRejoin: document.getElementById('confirm-rejoin')
        };
    }

    // 加载状态
    loadState() {
        const savedState = localStorage.getItem('kitchenCleaningState');
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            this.state = {
                ...this.state,
                ...parsedState,
                currentDate: new Date(), // 总是使用当前日期
                lastCleaningDate: parsedState.lastCleaningDate ? new Date(parsedState.lastCleaningDate) : null
            };
            
            // 更新当前房间索引（基于日期）
            this.updateCurrentRoomIndex();
        } else {
            // 首次使用，设置初始状态
            this.saveState();
        }
    }

    // 保存状态
    saveState() {
        const stateToSave = {
            ...this.state,
            currentDate: this.state.currentDate.toISOString(),
            lastCleaningDate: this.state.lastCleaningDate ? this.state.lastCleaningDate.toISOString() : null
        };
        localStorage.setItem('kitchenCleaningState', JSON.stringify(stateToSave));
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
        // 拍照上传
        this.domElements.cameraInput.addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });

        this.domElements.uploadBtn.addEventListener('click', () => {
            this.confirmCleaning();
        });

        // 永久跳过确认
        this.domElements.confirmSkip.addEventListener('click', () => {
            this.permanentlySkipRoom();
        });

        // 重新加入确认
        this.domElements.confirmRejoin.addEventListener('click', () => {
            this.rejoinRoom();
        });

        // 管理功能
        this.domElements.adminBtn.addEventListener('click', () => {
            this.showAdminModal();
        });

        this.domElements.resetDataBtn.addEventListener('click', () => {
            this.resetAllData();
        });

        this.domElements.saveAdminSettings.addEventListener('click', () => {
            this.saveAdminSettings();
        });
    }

    // 开始自动更新
    startAutoUpdate() {
        // 每分钟更新一次日期和时间
        setInterval(() => {
            this.state.currentDate = new Date();
            this.updateUI();
        }, 60000);
    }

    // 更新UI
    updateUI() {
        this.updateDateDisplay();
        this.updateCurrentRoomDisplay();
        this.updateRoomList();
        this.updateStatistics();
        this.updateHistory();
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

    // 更新房间列表
    updateRoomList() {
        const activeRooms = this.getActiveRooms();
        const currentRoom = this.getCurrentRoom();
        
        this.domElements.roomsContainer.innerHTML = '';
        
        this.roomOrder.forEach(room => {
            const isActive = activeRooms.includes(room);
            const isCurrent = room === currentRoom;
            const isSkipped = this.state.skippedRooms.includes(room);
            
            const roomCard = this.createRoomCard(room, isActive, isCurrent, isSkipped);
            this.domElements.roomsContainer.appendChild(roomCard);
        });
    }

    // 创建房间卡片
    createRoomCard(room, isActive, isCurrent, isSkipped) {
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-lg-3 mb-3';
        
        const card = document.createElement('div');
        card.className = `room-card ${isCurrent ? 'active' : ''} ${isSkipped ? 'skipped' : ''}`;
        
        const roomNumber = document.createElement('div');
        roomNumber.className = 'room-number';
        roomNumber.textContent = room;
        
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
        
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'btn-group w-100 mt-2';
        
        if (isSkipped) {
            const rejoinBtn = document.createElement('button');
            rejoinBtn.className = 'btn btn-success btn-sm';
            rejoinBtn.textContent = '重新加入';
            rejoinBtn.onclick = () => this.showRejoinModal(room);
            buttonGroup.appendChild(rejoinBtn);
        } else {
            const skipBtn = document.createElement('button');
            skipBtn.className = 'btn btn-danger btn-sm';
            skipBtn.textContent = '永久跳过';
            skipBtn.onclick = () => this.showSkipModal(room);
            buttonGroup.appendChild(skipBtn);
        }
        
        card.appendChild(roomNumber);
        card.appendChild(roomStatus);
        card.appendChild(buttonGroup);
        col.appendChild(card);
        
        return col;
    }

    // 显示永久跳过确认模态框
    showSkipModal(room) {
        this.domElements.skipRoomNumber.textContent = room;
        this.currentSkipRoom = room;
        this.domElements.skipModal.show();
    }

    // 显示重新加入确认模态框
    showRejoinModal(room) {
        this.domElements.rejoinRoomNumber.textContent = room;
        this.currentRejoinRoom = room;
        this.domElements.rejoinModal.show();
    }

    // 永久跳过房间
    permanentlySkipRoom() {
        if (this.currentSkipRoom && !this.state.skippedRooms.includes(this.currentSkipRoom)) {
            this.state.skippedRooms.push(this.currentSkipRoom);
            this.updateCurrentRoomIndex(); // 重新计算当前房间
            this.saveState();
            this.updateUI();
            this.domElements.skipModal.hide();
            this.showNotification(`房间 ${this.currentSkipRoom} 已永久跳过打扫`, 'success');
        }
    }

    // 重新加入房间
    rejoinRoom() {
        if (this.currentRejoinRoom) {
            this.state.skippedRooms = this.state.skippedRooms.filter(room => room !== this.currentRejoinRoom);
            this.updateCurrentRoomIndex(); // 重新计算当前房间
            this.saveState();
            this.updateUI();
            this.domElements.rejoinModal.hide();
            this.showNotification(`房间 ${this.currentRejoinRoom} 已重新加入打扫顺序`, 'success');
        }
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
                this.domElements.uploadBtn.disabled = false;
                
                // 显示图片预览（可选）
                this.showImagePreview(this.uploadedImage);
            };
            reader.readAsDataURL(file);
        }
    }

    // 显示图片预览
    showImagePreview(imageData) {
        // 移除现有的预览
        const existingPreview = document.querySelector('.photo-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
        
        const preview = document.createElement('img');
        preview.className = 'photo-preview';
        preview.src = imageData;
        preview.style.display = 'block';
        
        this.domElements.uploadBtn.parentNode.appendChild(preview);
    }

    // 确认打扫完成
    confirmCleaning() {
        if (!this.uploadedImage) {
            this.showNotification('请先选择照片', 'error');
            return;
        }

        const currentRoom = this.getCurrentRoom();
        const cleaningRecord = {
            date: new Date().toISOString(),
            room: currentRoom,
            image: this.uploadedImage
        };

        this.state.cleaningHistory.unshift(cleaningRecord);
        this.state.lastCleaningDate = new Date();
        
        this.saveState();
        this.updateUI();
        
        // 重置上传状态
        this.domElements.cameraInput.value = '';
        this.domElements.uploadBtn.disabled = true;
        this.uploadedImage = null;
        
        // 移除预览
        const preview = document.querySelector('.photo-preview');
        if (preview) {
            preview.remove();
        }
        
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
                <button class="btn btn-outline-primary btn-sm view-photo" data-image="${record.image}">
                    查看照片
                </button>
            </div>
        `;
        
        // 添加查看照片事件
        const viewBtn = item.querySelector('.view-photo');
        viewBtn.addEventListener('click', () => {
            this.showPhotoModal(record.image, `房间 ${record.room} - ${dateStr}`);
        });
        
        return item;
    }

    // 显示照片模态框
    showPhotoModal(imageData, title) {
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img src="${imageData}" class="img-fluid" style="max-height: 70vh;">
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // 模态框关闭后移除元素
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    // 显示管理模态框
    showAdminModal() {
        // 填充房间选择下拉框
        this.domElements.setRoomSelect.innerHTML = '<option value="">-- 选择房间 --</option>';
        const activeRooms = this.getActiveRooms();
        activeRooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room;
            option.textContent = room;
            if (room === this.getCurrentRoom()) {
                option.selected = true;
            }
            this.domElements.setRoomSelect.appendChild(option);
        });
        
        this.domElements.adminModal.show();
    }

    // 重置所有数据
    resetAllData() {
        if (confirm('确定要重置所有数据吗？这将清除所有打扫记录和跳过状态。')) {
            this.state = {
                currentDate: new Date(),
                currentRoomIndex: 0,
                skippedRooms: [],
                cleaningHistory: [],
                lastCleaningDate: null
            };
            this.saveState();
            this.updateUI();
            this.domElements.adminModal.hide();
            this.showNotification('所有数据已重置', 'success');
        }
    }

    // 保存管理设置
    saveAdminSettings() {
        const selectedRoom = this.domElements.setRoomSelect.value;
        
        if (selectedRoom) {
            const activeRooms = this.getActiveRooms();
            const roomIndex = activeRooms.indexOf(parseInt(selectedRoom));
            if (roomIndex !== -1) {
                this.state.currentRoomIndex = roomIndex;
                this.saveState();
                this.updateUI();
                this.domElements.adminModal.hide();
                this.showNotification(`已设置房间 ${selectedRoom} 为今日打扫房间`, 'success');
            }
        } else {
            this.domElements.adminModal.hide();
        }
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
    new KitchenCleaningSystem();
});
