// ==================== 后端 API 通信层 ====================
// 本文件负责前端与后端 Spring Boot 服务的所有 HTTP 通信
// 包括：登录/注册、存档读写、单局存档读写

const API_BASE = 'http://localhost:8080/api';

// 从 localStorage 读取之前保存的登录态（页面刷新后自动恢复）
let authToken = localStorage.getItem('dungeon_auth_token') || null;
let authUsername = localStorage.getItem('dungeon_auth_user') || null;

const api = {
    // 计算属性：是否已登录
    get isLoggedIn() { return !!authToken; },
    get token() { return authToken; },
    get username() { return authUsername; },

    /** 退出登录：清除内存和本地存储的 Token */
    logout() {
        authToken = null;
        authUsername = null;
        localStorage.removeItem('dungeon_auth_token');
        localStorage.removeItem('dungeon_auth_user');
    },

    /** 设置登录态：保存 Token 到内存和 localStorage */
    setAuth(token, username) {
        authToken = token;
        authUsername = username;
        localStorage.setItem('dungeon_auth_token', token);
        localStorage.setItem('dungeon_auth_user', username);
    },

    /**
     * 底层 HTTP 请求封装
     * 自动附加 Content-Type: application/json 和 Authorization: Bearer Token
     * @param path    API 路径（如 '/save/load'）
     * @param options fetch 选项（method、body 等）
     * @returns {Promise<any>} 解析后的 JSON 响应
     */
    async _fetch(path, options = {}) {
        const url = API_BASE + path;
        const opts = {
            headers: {
                'Content-Type': 'application/json',
                // 如果有 Token，自动附加到请求头
                ...(authToken ? { 'Authorization': 'Bearer ' + authToken } : {}),
                ...(options.headers || {})
            },
            ...options
        };
        // 自动将 JS 对象序列化为 JSON 字符串
        if (opts.body && typeof opts.body === 'object') {
            opts.body = JSON.stringify(opts.body);
        }
        const res = await fetch(url, opts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }
        return data;
    },

    // ==================== 认证接口 ====================

    /** 注册新账号，注册成功后自动设置登录态 */
    async register(username, password) {
        const data = await this._fetch('/auth/register', {
            method: 'POST',
            body: { username, password }
        });
        this.setAuth(data.token, data.username);
        return data;
    },

    /** 登录账号，登录成功后自动设置登录态 */
    async login(username, password) {
        const data = await this._fetch('/auth/login', {
            method: 'POST',
            body: { username, password }
        });
        this.setAuth(data.token, data.username);
        return data;
    },

    // ==================== 大厅永久存档接口 ====================

    /** 从服务器读取大厅存档（宝石、升级、统计） */
    async loadSave() {
        return this._fetch('/save/load', { method: 'GET' });
    },

    /** 将大厅存档保存到服务器
     * @param saveData { gems, upgradesJson, statsJson }
     */
    async saveSave(saveData) {
        return this._fetch('/save/save', {
            method: 'POST',
            body: saveData
        });
    },

    // ==================== 单局中途存档接口 ====================

    /** 从服务器读取单局中途存档（用于断点续玩） */
    async loadRunSave() {
        return this._fetch('/save/run/load', { method: 'GET' });
    },

    /** 将单局中途存档保存到服务器（暂停/退出时调用）
     * @param runData { hasRun, floorNum, kills, coins, playerJson, roomsJson, ... }
     */
    async saveRunSave(runData) {
        return this._fetch('/save/run/save', {
            method: 'POST',
            body: runData
        });
    },

    /** 删除单局中途存档（死亡或通关后调用） */
    async deleteRunSave() {
        return this._fetch('/save/run/delete', { method: 'POST' });
    }
};
