// Firebase配置 - 寝室厨房打扫系统
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBa5ZQFCksMe33LRG5618YcqZ2DxEwDleI",
  authDomain: "kitchen-cleaning-5f8ac.firebaseapp.com",
  projectId: "kitchen-cleaning-5f8ac",
  storageBucket: "kitchen-cleaning-5f8ac.firebasestorage.app",
  messagingSenderId: "903874994091",
  appId: "1:903874994091:web:4c14a9fd863d4210fe7cee",
  measurementId: "G-XM7CE1RH5V"
};

// 初始化Firebase
try {
    firebase.initializeApp(firebaseConfig);
} catch (error) {
    console.log("Firebase初始化错误:", error);
}

// 获取Firestore数据库实例
const db = firebase.firestore();

// 系统状态集合名称
const COLLECTION_NAME = "kitchenCleaningSystem";

// 实时数据监听器
let realTimeListener = null;

// Firebase工具类
class FirebaseManager {
    // 保存系统状态到Firebase
    static async saveState(state) {
        try {
            const stateToSave = {
                ...state,
                currentDate: state.currentDate.toISOString(),
                lastCleaningDate: state.lastCleaningDate ? state.lastCleaningDate.toISOString() : null,
                lastUpdated: new Date().toISOString()
            };
            
            await db.collection(COLLECTION_NAME).doc('systemState').set(stateToSave);
            return true;
        } catch (error) {
            console.error("保存状态失败:", error);
            return false;
        }
    }

    // 从Firebase加载系统状态
    static async loadState() {
        try {
            const doc = await db.collection(COLLECTION_NAME).doc('systemState').get();
            if (doc.exists) {
                const data = doc.data();
                return {
                    ...data,
                    currentDate: new Date(data.currentDate),
                    lastCleaningDate: data.lastCleaningDate ? new Date(data.lastCleaningDate) : null,
                    lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null
                };
            }
            return null;
        } catch (error) {
            console.error("加载状态失败:", error);
            return null;
        }
    }

    // 设置实时监听器
    static setRealtimeListener(callback) {
        // 移除之前的监听器
        if (realTimeListener) {
            realTimeListener();
        }

        realTimeListener = db.collection(COLLECTION_NAME).doc('systemState')
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    const state = {
                        ...data,
                        currentDate: new Date(data.currentDate),
                        lastCleaningDate: data.lastCleaningDate ? new Date(data.lastCleaningDate) : null,
                        lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null
                    };
                    callback(state);
                }
            }, (error) => {
                console.error("实时监听错误:", error);
            });
    }

    // 移除实时监听器
    static removeRealtimeListener() {
        if (realTimeListener) {
            realTimeListener();
            realTimeListener = null;
        }
    }

    // 检查Firebase连接状态
    static async checkConnection() {
        try {
            await db.collection(COLLECTION_NAME).doc('connectionTest').set({
                test: true,
                timestamp: new Date().toISOString()
            });
            return true;
        } catch (error) {
            return false;
        }
    }
}
