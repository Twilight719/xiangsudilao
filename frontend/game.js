// ==================== 元气地牢 - Roguelike ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let screenW = window.innerWidth;
let screenH = window.innerHeight;
let dpr = window.devicePixelRatio || 1;

function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    screenW = window.innerWidth;
    screenH = window.innerHeight;
    canvas.width = screenW * dpr;
    canvas.height = screenH * dpr;
    canvas.style.width = screenW + 'px';
    canvas.style.height = screenH + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ==================== 全局存档 ====================
const SAVE_KEY = 'yuanqi_dungeon_save';
let globalSave = {
    gems: 0,
    upgrades: {
        maxHp: 0,
        maxShield: 0,
        maxEnergy: 0,
        cooldownReduct: 0,
        chestQuality: 0,
    },
    stats: { totalRuns: 0, totalKills: 0, bestFloor: 0 },
};

/** 加载存档：优先读本地 localStorage，如果已登录则从服务器同步云端存档 */
async function loadSave() {
    // 1. 先读浏览器本地缓存（游客模式或离线时也能用）
    try {
        const s = localStorage.getItem(SAVE_KEY);
        if (s) globalSave = { ...globalSave, ...JSON.parse(s) };
    } catch(e) {}
    // 2. 如果已登录，再从后端 H2 数据库拉取最新存档，覆盖本地数据
    if (api.isLoggedIn) {
        try {
            const cloud = await api.loadSave();        // 调用后端 /api/save/load
            globalSave.gems = cloud.gems ?? globalSave.gems;
            if (cloud.upgradesJson) {
                const up = JSON.parse(cloud.upgradesJson);
                globalSave.upgrades = { ...globalSave.upgrades, ...up };
            }
            if (cloud.statsJson) {
                const st = JSON.parse(cloud.statsJson);
                globalSave.stats = { ...globalSave.stats, ...st };
            }
            // 把云端数据也写回本地，保证离线时数据一致
            localStorage.setItem(SAVE_KEY, JSON.stringify(globalSave));
        } catch(e) { console.warn('Cloud load failed:', e); }
    }
}

/** 保存大厅永久存档：先写本地，再同步到后端 H2 数据库 */
async function saveToDisk() {
    // 1. 无论是否登录，都先保存到浏览器本地（localStorage）
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(globalSave)); } catch(e) {}
    // 2. 如果已登录，再调用后端接口写入 H2 数据库持久化
    if (api.isLoggedIn) {
        try {
            await api.saveSave({                         // 调用后端 /api/save/save
                gems: globalSave.gems,
                upgradesJson: JSON.stringify(globalSave.upgrades),
                statsJson: JSON.stringify(globalSave.stats)
            });
        } catch(e) { console.warn('Cloud save failed:', e); }
    }
}

// ==================== 序列化辅助 ====================
function serializeWeapons(weapons) {
    return weapons.map(w => ({
        key: Object.keys(WEAPONS).find(k => WEAPONS[k].name === w.name),
        tier: w.tier
    }));
}
function deserializeWeapons(data) {
    return data.map(d => cloneWeapon(d.key, d.tier));
}

function serializeTalents(player) {
    return Array.from(player.acquiredTalents);
}

function serializePlayer(player) {
    return {
        x: player.x, y: player.y,
        hp: player.hp, maxHp: player.maxHp,
        shield: player.shield, maxShield: player.maxShield,
        energy: player.energy, maxEnergy: player.maxEnergy,
        level: player.level, exp: player.exp, expToNext: player.expToNext,
        weapons: serializeWeapons(player.weapons),
        weaponIndex: player.weaponIndex,
        acquiredTalents: serializeTalents(player),
        bonusDamage: player.bonusDamage,
        fireRateMult: player.fireRateMult,
        critChance: player.critChance,
        shieldRegenMult: player.shieldRegenMult,
        killHeal: player.killHeal,
        meleeDmgBonus: player.meleeDmgBonus,
        fireProjBonus: player.fireProjBonus,
        piercingShot: player.piercingShot,
        poisonTouch: player.poisonTouch,
        rollCdMult: player.rollCdMult,
        energyRegenFlat: player.energyRegenFlat,
        killEnergyGain: player.killEnergyGain,
        magnetRange: player.magnetRange,
        talentBounce: player.talentBounce,
    };
}

function deserializePlayer(data, x, y) {
    const p = new Player(x, y);
    p.hp = Math.min(data.hp ?? p.hp, data.maxHp ?? p.maxHp);
    p.maxHp = data.maxHp ?? p.maxHp;
    p.shield = Math.min(data.shield ?? p.shield, data.maxShield ?? p.maxShield);
    p.maxShield = data.maxShield ?? p.maxShield;
    p.energy = Math.min(data.energy ?? p.energy, data.maxEnergy ?? p.maxEnergy);
    p.maxEnergy = data.maxEnergy ?? p.maxEnergy;
    p.level = data.level ?? p.level;
    p.exp = data.exp ?? p.exp;
    p.expToNext = data.expToNext ?? p.expToNext;
    if (data.weapons && data.weapons.length > 0) {
        p.weapons = deserializeWeapons(data.weapons);
    }
    p.weaponIndex = data.weaponIndex ?? 0;
    p.bonusDamage = data.bonusDamage ?? 0;
    p.fireRateMult = data.fireRateMult ?? 1;
    p.critChance = data.critChance ?? 0.05;
    p.shieldRegenMult = data.shieldRegenMult ?? 1;
    p.killHeal = data.killHeal ?? false;
    p.meleeDmgBonus = data.meleeDmgBonus ?? 0;
    p.fireProjBonus = data.fireProjBonus ?? 0;
    p.piercingShot = data.piercingShot ?? false;
    p.poisonTouch = data.poisonTouch ?? false;
    p.rollCdMult = data.rollCdMult ?? 1;
    p.energyRegenFlat = data.energyRegenFlat ?? 0.3;
    p.killEnergyGain = data.killEnergyGain ?? 0;
    p.magnetRange = data.magnetRange ?? 0;
    p.talentBounce = data.talentBounce ?? false;
    p.acquiredTalents = new Set(data.acquiredTalents || []);
    for (const tid of p.acquiredTalents) {
        const talent = TALENTS.find(t => t.id === tid);
        if (talent) talent.effect(p);
    }
    return p;
}

function serializeRooms(rooms) {
    return rooms.map(r => ({
        gx: r.gx, gy: r.gy, type: r.type,
        doors: r.doors, visited: r.visited, cleared: r.cleared
    }));
}

function serializeRoomState(room) {
    return {
        gx: room.gx, gy: room.gy,
        enemies: room.enemies.filter(e => !e.dead).map(e => ({
            type: e.type, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp
        })),
        drops: room.drops.filter(d => d.active).map(d => ({
            type: d.type, x: d.x, y: d.y, value: d.value
        })),
        bullets: room.bullets.filter(b => b.active).map(b => ({
            x: b.x, y: b.y, vx: b.vx, vy: b.vy, damage: b.damage,
            radius: b.radius, isEnemy: b.isEnemy, color: b.color, life: b.life
        })),
        chests: room.chests.map(c => ({
            x: c.x, y: c.y, quality: c.quality, opened: c.opened
        })),
        portalActive: room.portal ? room.portal.active : false
    };
}

loadSave();

// ==================== UI 引用 ====================
const UI = {
    loading: document.getElementById('loading'),
    loadingBar: document.getElementById('loading-progress'),
    loadingText: document.getElementById('loading-text'),
    backendStatus: document.getElementById('backend-status'),
    mainMenu: document.getElementById('main-menu'),
    hall: document.getElementById('hall'),
    hallGems: document.getElementById('hall-gems'),
    hallUpgrades: document.getElementById('hall-upgrades'),
    talentSelect: document.getElementById('talent-select'),
    talentLevelText: document.getElementById('talent-level-text'),
    talentOptions: document.getElementById('talent-options'),
    weaponSelect: document.getElementById('weapon-select'),
    weaponOptions: document.getElementById('weapon-options'),
    shopMenu: document.getElementById('shop-menu'),
    shopOptions: document.getElementById('shop-options'),
    pauseMenu: document.getElementById('pause-menu'),
    settlement: document.getElementById('settlement'),
    settleTitle: document.getElementById('settle-title'),
    settleKills: document.getElementById('settle-kills'),
    settleFloor: document.getElementById('settle-floor'),
    settleGems: document.getElementById('settle-gems'),
    interactHint: document.getElementById('interact-hint'),
    gameOver: document.getElementById('game-over'),
    authPanel: document.getElementById('auth-panel'),
    authTitle: document.getElementById('auth-title'),
    authUsername: document.getElementById('auth-username'),
    authPassword: document.getElementById('auth-password'),
    authPassword2: document.getElementById('auth-password2'),
    authError: document.getElementById('auth-error'),
    userInfo: document.getElementById('user-info'),
    userName: document.getElementById('user-name'),
};

// ==================== 工具函数 ====================
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function angleBetween(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
function circleRectCollision(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
}

// ==================== 对象池 ====================
class ObjectPool {
    constructor(create, reset, initialSize = 30) {
        this.create = create;
        this.reset = reset;
        this.free = [];
        for (let i = 0; i < initialSize; i++) this.free.push(create());
    }
    acquire() { return this.free.length > 0 ? this.free.pop() : this.create(); }
    release(obj) { this.reset(obj); this.free.push(obj); }
}

// ==================== 资源路径 ====================
const ASSET_BASE = 'assets/characters';
const ASSETS = {
    knight_idle: `${ASSET_BASE}/Knight/Knight/Knight-Idle.png`,
    knight_run: `${ASSET_BASE}/Knight/Knight/Knight-Run.png`,
    knight_attack1: `${ASSET_BASE}/Knight/Knight/Knight-Attack01.png`,
    knight_hurt: `${ASSET_BASE}/Knight/Knight/Knight-Hurt.png`,
    knight_death: `${ASSET_BASE}/Knight/Knight/Knight-Death.png`,
    slime_idle: `${ASSET_BASE}/Slime/Slime/Idle.png`,
    slime_walk: `${ASSET_BASE}/Slime/Slime/Walk.png`,
    slime_death: `${ASSET_BASE}/Slime/Slime/Death.png`,
    skeleton_idle: `${ASSET_BASE}/Skeleton/Skeleton/Idle.png`,
    skeleton_walk: `${ASSET_BASE}/Skeleton/Skeleton/Walk.png`,
    skeleton_attack: `${ASSET_BASE}/Skeleton/Skeleton/Attack.png`,
    skeleton_hurt: `${ASSET_BASE}/Skeleton/Skeleton/Hurt.png`,
    skeleton_death: `${ASSET_BASE}/Skeleton/Skeleton/Death.png`,
    mushroom_idle: `${ASSET_BASE}/mushroom/mushroom/Idle.png`,
    mushroom_jump: `${ASSET_BASE}/mushroom/mushroom/Jump.png`,
    mushroom_attack: `${ASSET_BASE}/mushroom/mushroom/Attack.png`,
    mushroom_death: `${ASSET_BASE}/mushroom/mushroom/Death.png`,
    wizard_idle: `${ASSET_BASE}/Wizard/Wizard/Idle.png`,
    wizard_run: `${ASSET_BASE}/Wizard/Wizard/Run.png`,
    wizard_attack1: `${ASSET_BASE}/Wizard/Wizard/Attack01.png`,
    wizard_hurt: `${ASSET_BASE}/Wizard/Wizard/Hurt.png`,
    wizard_death: `${ASSET_BASE}/Wizard/Wizard/Death.png`,
    boss_idle: `${ASSET_BASE}/boss/BOSS/boss-Idle.png`,
    boss_attack: `${ASSET_BASE}/boss/BOSS/boss-Attack.png`,
    boss_hurt: `${ASSET_BASE}/boss/BOSS/boss-Hurt.png`,
    boss_death: `${ASSET_BASE}/boss/BOSS/boss-Death.png`,
    boss_fly: `${ASSET_BASE}/boss/BOSS/boss-Fly.png`,
    chestClosed: 'assets/props/chestClosed.png',
    chestOpen: 'assets/props/chestOpen.png',
    // Decoration props
    deco_barrel: 'assets/props/deco/barrel.png',
    deco_barrelsStacked: 'assets/props/deco/barrelsStacked.png',
    deco_stoneColumn: 'assets/props/deco/stoneColumn.png',
    deco_woodenCrate: 'assets/props/deco/woodenCrate.png',
    deco_tableRound: 'assets/props/deco/tableRound.png',
    deco_chair: 'assets/props/deco/chair.png',
    deco_candleStand: 'assets/props/deco/candleStand.png',
    deco_floorCarpet: 'assets/props/deco/floorCarpet.png',
    deco_bookcaseBooks: 'assets/props/deco/bookcaseBooks.png',
    deco_displayCaseSword: 'assets/props/deco/displayCaseSword.png',
    deco_longTable: 'assets/props/deco/longTable.png',
    deco_hayBales: 'assets/props/deco/hayBales.png',
    deco_fenceLow: 'assets/props/deco/fenceLow.png',
    // Tilemap
    tilemap: 'assets/tilemaps/tilemaps.png',
};

// ==================== 资源加载器 ====================
class AssetLoader {
    constructor() {
        this.images = {};
        this.loaded = 0;
        this.total = Object.keys(ASSETS).length;
    }
    loadAll() {
        return new Promise((resolve) => {
            if (this.total === 0) { resolve(); return; }
            let resolved = false;
            const doResolve = () => {
                if (!resolved) { resolved = true; resolve(); }
            };
            setTimeout(() => {
                if (!resolved) {
                    console.warn('Asset load timeout, continuing...');
                    doResolve();
                }
            }, 8000);
            for (const [key, src] of Object.entries(ASSETS)) {
                const img = new Image();
                img.onload = () => {
                    this.loaded++;
                    const pct = (this.loaded / this.total) * 100;
                    UI.loadingBar.style.width = pct + '%';
                    UI.loadingText.textContent = `加载中... (${this.loaded}/${this.total})`;
                    if (this.loaded >= this.total) doResolve();
                };
                img.onerror = () => {
                    this.loaded++;
                    img._loadFailed = true;
                    console.warn('Failed to load:', src);
                    if (this.loaded >= this.total) doResolve();
                };
                img.src = src;
                this.images[key] = img;
            }
        });
    }
    get(key) { return this.images[key]; }
}
const assetLoader = new AssetLoader();

// ==================== 输入管理 ====================
class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, rightDown: false, rightPressed: false };
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (e.code === 'Escape') game.onEscape();
            if (e.code === 'KeyF') game.onInteract();
        });
        window.addEventListener('keyup', e => { this.keys[e.code] = false; });
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        canvas.addEventListener('mousedown', e => {
            if (e.button === 0) this.mouse.down = true;
            if (e.button === 2) { this.mouse.rightDown = true; this.mouse.rightPressed = true; }
        });
        canvas.addEventListener('mouseup', e => {
            if (e.button === 0) this.mouse.down = false;
            if (e.button === 2) this.mouse.rightDown = false;
        });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
    }
    isDown(code) { return !!this.keys[code]; }
    getWorldMouse(cam) {
        return {
            x: (this.mouse.x - screenW / 2) / game.zoom + cam.x,
            y: (this.mouse.y - screenH / 2) / game.zoom + cam.y
        };
    }
}
const input = new InputManager();

// ==================== 触控输入管理器（手机端） ====================
class TouchInputManager {
    constructor() {
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (!this.isTouchDevice) return;

        this.touches = {};
        this.joystickActive = false;
        this.joystickId = null;
        this.joystickBaseX = 0;
        this.joystickBaseY = 0;
        this.joystickDx = 0;
        this.joystickDy = 0;
        this.JOYSTICK_MAX_DIST = 60;
        this.JOYSTICK_DEADZONE = 8;

        this.shootActive = false;
        this.shootId = null;
        this.shootWorldX = 0;
        this.shootWorldY = 0;
        this._shootHoldTimer = 0;
        this._shotFiredThisTouch = false;
        this.TAP_THRESHOLD = 0.2;
        this.LONG_PRESS_THRESHOLD = 0.2;

        this.rollPending = false;
        this._switchCooldown = 0;
        this._consumeInteract = false;

        this.setupZones();
        this.bindEvents();
    }

    setupZones() {
        this.joystickZoneW = screenW * 0.35;
        this.shootZoneX = screenW * 0.35;
    }

    bindEvents() {
        canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        canvas.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
        canvas.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });
    }

    _isInJoystickZone(x) { return x < this.joystickZoneW; }
    _isInShootZone(x) { return x >= this.shootZoneX; }

    _checkButtonHit(x, y) {
        const s = Math.min(screenW / 960, screenH / 640);
        const btnR = 28 * s;
        const rollX = screenW - 65 * s;
        const rollY = screenH - 65 * s;
        const interactX = screenW / 2 - 50 * s;
        const interactY = screenH - 55 * s;
        const switchX = screenW / 2 + 10 * s;
        const switchY = screenH - 55 * s;
        const pauseX = screenW - 35 * s;
        const pauseY = 35 * s;

        if (Math.hypot(x - rollX, y - rollY) < btnR + 5) return 'roll';
        if (Math.hypot(x - interactX, y - interactY) < btnR) return 'interact';
        if (Math.hypot(x - switchX, y - switchY) < btnR) return 'switch';
        if (Math.hypot(x - pauseX, y - pauseY) < btnR - 5) return 'pause';
        return null;
    }

    _onTouchStart(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const rect = canvas.getBoundingClientRect();
            const tx = touch.clientX - rect.left;
            const ty = touch.clientY - rect.top;

            const btn = this._checkButtonHit(tx, ty);
            if (btn) {
                this._handleButton(btn);
                this.touches[touch.identifier] = { id: touch.identifier, zone: 'button', btn };
                continue;
            }

            if (this._isInJoystickZone(tx) && this.joystickId === null) {
                this.joystickId = touch.identifier;
                this.joystickActive = true;
                this.joystickBaseX = tx;
                this.joystickBaseY = ty;
                this.joystickDx = 0;
                this.joystickDy = 0;
                this.touches[touch.identifier] = { id: touch.identifier, zone: 'joystick' };
            } else if (this._isInShootZone(tx) && this.shootId === null) {
                this.shootId = touch.identifier;
                this.shootActive = true;
                this._shootHoldTimer = 0;
                this._shotFiredThisTouch = false;
                this._updateShootTarget(tx, ty);
                this._tryFire();
                this._shotFiredThisTouch = true;
                this.touches[touch.identifier] = { id: touch.identifier, zone: 'shoot' };
            }
        }
    }

    _onTouchMove(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const t = this.touches[touch.identifier];
            if (!t) continue;
            const rect = canvas.getBoundingClientRect();
            const tx = touch.clientX - rect.left;
            const ty = touch.clientY - rect.top;

            if (t.zone === 'joystick' && touch.identifier === this.joystickId) {
                const rawDx = tx - this.joystickBaseX;
                const rawDy = ty - this.joystickBaseY;
                const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
                if (dist < this.JOYSTICK_DEADZONE) {
                    this.joystickDx = 0;
                    this.joystickDy = 0;
                } else {
                    const clamped = Math.min(dist, this.JOYSTICK_MAX_DIST);
                    this.joystickDx = (rawDx / dist) * (clamped / this.JOYSTICK_MAX_DIST);
                    this.joystickDy = (rawDy / dist) * (clamped / this.JOYSTICK_MAX_DIST);
                }
                this.joystickBaseX = tx;
                this.joystickBaseY = ty;
                if (dist > this.JOYSTICK_MAX_DIST * 1.5) {
                    this.joystickBaseX = tx - (rawDx / dist) * this.JOYSTICK_MAX_DIST;
                    this.joystickBaseY = ty - (rawDy / dist) * this.JOYSTICK_MAX_DIST;
                }
            }

            if (t.zone === 'shoot' && touch.identifier === this.shootId) {
                this._updateShootTarget(tx, ty);
            }
        }
    }

    _onTouchEnd(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const t = this.touches[touch.identifier];
            if (!t) continue;

            if (t.zone === 'joystick' && touch.identifier === this.joystickId) {
                this.joystickActive = false;
                this.joystickId = null;
                this.joystickDx = 0;
                this.joystickDy = 0;
            }

            if (t.zone === 'shoot' && touch.identifier === this.shootId) {
                if (!this._shotFiredThisTouch) {
                    this._tryFire();
                }
                this.shootActive = false;
                this.shootId = null;
            }

            delete this.touches[touch.identifier];
        }
    }

    _updateShootTarget(tx, ty) {
        this.shootWorldX = (tx - screenW / 2) / game.zoom + game.camera.x;
        this.shootWorldY = (ty - screenH / 2) / game.zoom + game.camera.y;
    }

    _handleButton(btn) {
        if (btn === 'roll') this.rollPending = true;
        if (btn === 'interact') this._consumeInteract = true;
        if (btn === 'switch') {
            if (this._switchCooldown <= 0 && game.player) {
                game.player.weaponIndex = (game.player.weaponIndex + 1) % game.player.weapons.length;
                this._switchCooldown = 0.3;
            }
        }
        if (btn === 'pause') {
            if (game && game.onEscape) game.onEscape();
        }
    }

    _tryFire() {
        if (!game || !game.player || game.state !== 'playing') return;
        if (!game.currentRoom) return;
        const p = game.player;
        if (p.dead || p.rollDuration > 0) return;
        const room = game.currentRoom;
        const angle = angleBetween(p.x, p.y, this.shootWorldX, this.shootWorldY);
        if (this.shootWorldX > p.x) p.facing = 1;
        else if (this.shootWorldX < p.x) p.facing = -1;
        if (p.currentWeapon.fire(p, angle, room)) {
            p.attacking = true;
            p.attackTimer = 0.2;
            p.anims.attack.reset();
        }
    }

    getMoveVector() {
        if (!this.joystickActive) return { dx: 0, dy: 0 };
        return { dx: this.joystickDx, dy: this.joystickDy };
    }

    consumeRoll() {
        if (this.rollPending) { this.rollPending = false; return true; }
        return false;
    }

    update(dt) {
        if (!this.isTouchDevice) return;
        if (this._switchCooldown > 0) this._switchCooldown -= dt;
        if (this._consumeInteract && game.state === 'playing') {
            this._consumeInteract = false;
            game.onInteract();
        }
        if (this.shootActive) {
            this._shootHoldTimer += dt;
            if (this._shootHoldTimer > this.LONG_PRESS_THRESHOLD) {
                this._tryFire();
            }
        }
    }

    draw(ctx) {
        if (!this.isTouchDevice || !game.player) return;
        this._drawJoystick(ctx);
        this._drawButtons(ctx);
    }

    _drawJoystick(ctx) {
        if (!this.joystickActive) return;
        const baseX = this.joystickBaseX;
        const baseY = this.joystickBaseY;
        const stickX = baseX + this.joystickDx * this.JOYSTICK_MAX_DIST;
        const stickY = baseY + this.joystickDy * this.JOYSTICK_MAX_DIST;

        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(baseX, baseY, this.JOYSTICK_MAX_DIST, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fill();

        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(stickX, stickY, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    _drawButtons(ctx) {
        const s = Math.min(screenW / 960, screenH / 640);
        const r = 28 * s;

        // Roll button (bottom-right)
        const rollX = screenW - 65 * s;
        const rollY = screenH - 65 * s;
        const cdRatio = game.player ? Math.max(0, game.player.rollCooldown / (2.5 * game.player.rollCdMult)) : 0;
        this._drawRoundBtn(ctx, rollX, rollY, r + 5, '翻', cdRatio > 0 ? '#555' : '#e94560', s);

        // Interact button (bottom-center-left)
        const interactX = screenW / 2 - 50 * s;
        const interactY = screenH - 55 * s;
        this._drawRoundBtn(ctx, interactX, interactY, r, 'F', '#ffd700', s);

        // Switch button (bottom-center-right)
        const switchX = screenW / 2 + 10 * s;
        const switchY = screenH - 55 * s;
        this._drawRoundBtn(ctx, switchX, switchY, r, 'Q', '#fff', s);

        // Pause button (top-right)
        const pauseX = screenW - 35 * s;
        const pauseY = 35 * s;
        this._drawRoundBtn(ctx, pauseX, pauseY, r - 6, '||', '#fff', s * 0.8);
    }

    _drawRoundBtn(ctx, x, y, r, label, color, s) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.round(14 * s)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y);
        ctx.restore();
    }
}
const touchInput = new TouchInputManager();

// ==================== 动画系统 ====================
class Animator {
    constructor(img, frameW, frameH, fps = 8) {
        this.img = img;
        this.frameW = frameW;
        this.frameH = frameH;
        this.fps = fps;
        this.frames = img ? Math.floor(img.width / frameW) : 1;
        this.currentFrame = 0;
        this.timer = 0;
        this.done = false;
    }
    update(dt) {
        if (!this.img || this.frames <= 1) return;
        this.timer += dt;
        const frameTime = 1 / this.fps;
        if (this.timer >= frameTime) {
            this.timer -= frameTime;
            this.currentFrame++;
            if (this.currentFrame >= this.frames) {
                this.currentFrame = 0;
                this.done = true;
            }
        }
    }
    reset() { this.currentFrame = 0; this.timer = 0; this.done = false; }
    draw(ctx, x, y, flip = false, alpha = 1) {
        if (!this.img) {
            ctx.fillStyle = '#f0f';
            ctx.fillRect(x - 16, y - 16, 32, 32);
            return;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        if (flip) {
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.drawImage(this.img, this.currentFrame * this.frameW, 0, this.frameW, this.frameH, -this.frameW / 2, -this.frameH / 2, this.frameW, this.frameH);
        } else {
            ctx.drawImage(this.img, this.currentFrame * this.frameW, 0, this.frameW, this.frameH, x - this.frameW / 2, y - this.frameH / 2, this.frameW, this.frameH);
        }
        ctx.restore();
    }
}

// ==================== 粒子系统 ====================
class Particle {
    constructor(x, y, color, speed, life, size) {
        this.init(x, y, color, speed, life, size);
    }
    init(x, y, color, speed, life, size) {
        this.x = x; this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = life;
        this.maxLife = life;
        this.size = size;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.vx *= 0.98;
        this.vy *= 0.98;
    }
    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}
class ParticleSystem {
    constructor(pool) {
        this.particles = [];
        this.pool = pool;
    }
    emit(x, y, color, count = 5, speed = 60, life = 0.5, size = 3) {
        for (let i = 0; i < count; i++) {
            const p = this.pool ? this.pool.acquire() : new Particle();
            p.init(x, y, color, rand(speed * 0.5, speed), rand(life * 0.5, life), rand(size * 0.5, size));
            this.particles.push(p);
        }
    }
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) {
                if (this.pool) this.pool.release(this.particles[i]);
                this.particles[i] = this.particles[this.particles.length - 1];
                this.particles.pop();
            }
        }
    }
    draw(ctx) {
        for (const p of this.particles) p.draw(ctx);
    }
}

// ==================== 浮动文字 ====================
class FloatingText {
    constructor(x, y, text, color, size = 14) {
        this.init(x, y, text, color, size);
    }
    init(x, y, text, color, size = 14) {
        this.x = x; this.y = y;
        this.text = text;
        this.color = color;
        this.size = size;
        this.life = 1.0;
        this.vy = -40;
    }
    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// ==================== 子弹类 ====================
class Bullet {
    constructor(x, y, angle, speed, damage, radius, isEnemy, color = '#ffeb3b') {
        this.init(x, y, angle, speed, damage, radius, isEnemy, color);
    }
    init(x, y, angle, speed, damage, radius, isEnemy, color = '#ffeb3b') {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.damage = damage;
        this.radius = radius;
        this.isEnemy = isEnemy;
        this.color = color;
        this.life = 5;
        this.active = true;
        this.pierceRemaining = 0;
    }
    update(dt, room) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) { this.active = false; return; }
        for (const wall of room.walls) {
            if (circleRectCollision(this.x, this.y, this.radius, wall.x, wall.y, wall.w, wall.h)) {
                this.active = false;
                game.particles.emit(this.x, this.y, '#888', 3, 30, 0.3, 2);
                return;
            }
        }
        if (this.x < room.x || this.x > room.x + room.w || this.y < room.y || this.y > room.y + room.h) {
            this.active = false;
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// ==================== 武器系统 ====================
const TIER_MULT = { 1: 1.0, 2: 1.6, 3: 2.3 };
const TIER_LABEL = { 1: '', 2: '+', 3: '++' };

class Weapon {
    constructor(name, category, baseDamage, energyCost, fireRate, projectileSpeed, projectileCount = 1, spread = 0.1, color = '#ffeb3b', tier = 1) {
        this.name = name;
        this.category = category;
        this.tier = tier;
        this.baseDamage = baseDamage;
        this.damage = Math.floor(baseDamage * TIER_MULT[tier]);
        this.energyCost = energyCost;
        this.fireRate = fireRate;
        this.cooldown = 0;
        this.projectileSpeed = projectileSpeed;
        this.projectileCount = projectileCount;
        this.spread = spread;
        this.color = color;
    }
    get fullName() { return this.name + TIER_LABEL[this.tier]; }
    canFire() { return this.cooldown <= 0; }
    fire(owner, angle, room) {
        if (!this.canFire()) return false;
        if (owner.energy < this.energyCost) return false;
        owner.energy -= this.energyCost;
        this.cooldown = this.fireRate;
        if (this.category === 'melee') {
            const bonusDmg = (owner.meleeDmgBonus || 0);
            const mx = owner.x + Math.cos(angle) * 30;
            const my = owner.y + Math.sin(angle) * 30;
            game.meleeHits.push({ x: mx, y: my, r: 40, damage: this.damage + bonusDmg, owner, life: 0.08, angle, hitSet: new Set(), poison: owner.poisonTouch || false });
            game.particles.emit(mx, my, this.color, 4, 40, 0.2, 3);
        } else {
            const extraProj = (owner.fireProjBonus && this.name === '火焰法杖') ? owner.fireProjBonus : 0;
            const totalProj = this.projectileCount + extraProj;
            for (let i = 0; i < totalProj; i++) {
                const sa = angle + (Math.random() - 0.5) * this.spread * (totalProj > 1 ? 1 : 0.5);
                const bx = owner.x + Math.cos(angle) * 20;
                const by = owner.y + Math.sin(angle) * 20;
                const b = game.bulletPool.acquire();
                b.init(bx, by, sa, this.projectileSpeed, this.damage, 4, owner.isEnemy, this.color);
                b.pierceRemaining = (owner.piercingShot && !owner.isEnemy) ? 1 : 0;
                room.bullets.push(b);
            }
        }
        return true;
    }
    update(dt) { if (this.cooldown > 0) this.cooldown -= dt; }
}

const WEAPONS = {
    pistol: new Weapon('破旧手枪', 'gun', 3, 1, 0.25, 380, 1, 0.05, '#ffeb3b'),
    rifle: new Weapon('突击步枪', 'gun', 4, 2, 0.12, 420, 1, 0.08, '#ff9800'),
    shotgun: new Weapon('霰弹枪', 'gun', 3, 3, 0.6, 320, 5, 0.4, '#ff5722'),
    sniper: new Weapon('狙击枪', 'gun', 12, 5, 0.8, 600, 1, 0.0, '#00e5ff'),
    sword: new Weapon('短刀', 'melee', 5, 0, 0.35, 0, 1, 0, '#e0e0e0'),
    battleaxe: new Weapon('战斧', 'melee', 10, 0, 0.7, 0, 1, 0, '#ff6d00'),
    dagger: new Weapon('匕首', 'melee', 3, 0, 0.15, 0, 1, 0, '#b0bec5'),
    staff: new Weapon('法杖', 'staff', 6, 4, 0.4, 300, 3, 0.3, '#9c27b0'),
    crossbow: new Weapon('十字弩', 'gun', 15, 4, 1.0, 500, 1, 0.0, '#ffab00'),
    firewand: new Weapon('火焰法杖', 'staff', 4, 5, 0.5, 250, 5, 0.5, '#ff3d00'),
};

function cloneWeapon(key, tier = 1) {
    const w = WEAPONS[key];
    return new Weapon(w.name, w.category, w.baseDamage, w.energyCost, w.fireRate, w.projectileSpeed, w.projectileCount, w.spread, w.color, tier);
}

// All weapon keys for equal-probability random selection
const ALL_WEAPON_KEYS = ['pistol', 'rifle', 'shotgun', 'sniper', 'sword', 'battleaxe', 'dagger', 'staff', 'crossbow', 'firewand'];

function randomWeaponByFloor(floorNum) {
    const key = randItem(ALL_WEAPON_KEYS);
    // Tier probability based on floor
    let tier = 1;
    const roll = Math.random();
    if (floorNum >= 3) {
        if (roll < 0.20) tier = 1; else if (roll < 0.55) tier = 2; else tier = 3;
    } else if (floorNum >= 2) {
        if (roll < 0.40) tier = 1; else if (roll < 0.75) tier = 2; else tier = 3;
    } else {
        if (roll < 0.70) tier = 1; else if (roll < 0.95) tier = 2; else tier = 3;
    }
    return cloneWeapon(key, tier);
}

// ==================== 掉落物 ====================
class Drop {
    constructor(x, y, type, value = 1) {
        this.x = x; this.y = y;
        this.type = type;
        this.value = value;
        this.radius = 10;
        this.life = 15;
        this.bob = 0;
        this.active = true;
    }
    update(dt, player) {
        this.life -= dt;
        this.bob += dt * 4;
        if (this.life <= 0) { this.active = false; return; }
        const d = dist(this.x, this.y, player.x, player.y);
        if (d < 120) {
            this.x = lerp(this.x, player.x, 6 * dt);
            this.y = lerp(this.y, player.y, 6 * dt);
        }
        if (d < player.radius + this.radius) {
            this.collect(player);
            this.active = false;
        }
    }
    collect(player) {
        if (this.type === 'coin') {
            game.coins += this.value;
            game.addFloatText(this.x, this.y, `+${this.value}金币`, '#ffd700');
        } else if (this.type === 'hp') {
            player.hp = Math.min(player.maxHp, player.hp + this.value);
            game.addFloatText(this.x, this.y, `+${this.value}生命`, '#f44336');
        } else if (this.type === 'energy') {
            player.energy = Math.min(player.maxEnergy, player.energy + this.value);
            game.addFloatText(this.x, this.y, `+${this.value}能量`, '#2196f3');
        } else if (this.type === 'weapon') {
            const picked = player.pickupWeapon(this.value, { x: this.x, y: this.y });
            if (picked) game.addFloatText(this.x, this.y, `获得 ${this.value.fullName}`, '#fff');
        } else if (this.type === 'gem') {
            game.gemsThisRun += this.value;
            game.addFloatText(this.x, this.y, `+${this.value}宝石`, '#e040fb');
        }
    }
    draw(ctx) {
        const bobY = Math.sin(this.bob) * 3;
        ctx.save();
        ctx.translate(this.x, this.y + bobY);
        if (this.type === 'coin') {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2; ctx.stroke();
        } else if (this.type === 'hp') {
            ctx.fillStyle = '#f44336';
            ctx.fillRect(-5, -2, 10, 4);
            ctx.fillRect(-2, -5, 4, 10);
        } else if (this.type === 'energy') {
            ctx.fillStyle = '#2196f3';
            ctx.beginPath();
            ctx.moveTo(0, -6); ctx.lineTo(4, 2); ctx.lineTo(-2, 2);
            ctx.lineTo(2, 6); ctx.lineTo(-4, -2); ctx.lineTo(2, -2);
            ctx.closePath(); ctx.fill();
        } else if (this.type === 'weapon') {
            ctx.fillStyle = '#fff'; ctx.fillRect(-6, -3, 12, 6);
            ctx.fillStyle = '#999'; ctx.fillRect(-2, -2, 4, 4);
        } else if (this.type === 'gem') {
            ctx.fillStyle = '#e040fb';
            ctx.beginPath();
            ctx.moveTo(0, -5); ctx.lineTo(4, 0); ctx.lineTo(0, 5); ctx.lineTo(-4, 0);
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }
}

// ==================== 宝箱 ====================
class Chest {
    constructor(x, y, quality = 1) {
        this.x = x; this.y = y;
        this.quality = quality;
        this.opened = false;
        this.radius = 18;
        this.imgClosed = assetLoader.get('chestClosed');
        this.imgOpen = assetLoader.get('chestOpen');
        this.scale = 0.6;
    }
    canInteract(player) {
        return !this.opened && dist(this.x, this.y, player.x, player.y) < this.radius + player.radius + 10;
    }
    open(room) {
        if (this.opened) return;
        this.opened = true;
        game.particles.emit(this.x, this.y, '#ffd700', 10, 50, 0.6, 4);
        // Drop rewards based on quality
        const q = this.quality;
        const coinAmount = randInt(10, 20) * q;
        room.drops.push(new Drop(this.x, this.y, 'coin', coinAmount));
        if (Math.random() < 0.5 * q) room.drops.push(new Drop(this.x + 10, this.y, 'hp', 1));
        if (Math.random() < 0.8) room.drops.push(new Drop(this.x - 10, this.y, 'energy', randInt(30, 60)));
        if (Math.random() < 0.3 + (q - 1) * 0.2) {
            room.drops.push(new Drop(this.x, this.y + 10, 'weapon', randomWeaponByFloor(game.floor)));
        }
        game.addFloatText(this.x, this.y - 30, '宝箱开启!', '#ffd700');
    }
    draw(ctx) {
        const img = this.opened ? this.imgOpen : this.imgClosed;
        const w = 64 * this.scale;
        const h = 64 * this.scale;
        const imgReady = img && img.complete && img.naturalWidth > 0 && !img._loadFailed;
        if (imgReady) {
            ctx.drawImage(img, 0, 0, 64, 64, this.x - w / 2, this.y - h, w, h);
        } else {
            ctx.fillStyle = this.opened ? '#8d6e63' : '#ffd700';
            ctx.fillRect(this.x - 12, this.y - 20, 24, 20);
            ctx.strokeStyle = '#ffeb3b';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x - 12, this.y - 20, 24, 20);
        }
        if (!this.opened) {
            ctx.fillStyle = 'rgba(255,215,0,0.3)';
            ctx.beginPath();
            ctx.arc(this.x, this.y - 5, 16 + Math.sin(Date.now() / 300) * 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ==================== 装饰道具 ====================
class DecoProp {
    constructor(x, y, imgKey, scale = 0.2, collidable = false) {
        this.x = x; this.y = y;
        this.imgKey = imgKey;
        this.scale = scale;
        this.collidable = collidable;
        this.radius = collidable ? 18 : 0;
        this.img = assetLoader.get(imgKey);
        const imgReady = this.img && this.img.complete && this.img.naturalWidth > 0 && !this.img._loadFailed;
        this.w = imgReady ? this.img.width * scale : 32;
        this.h = imgReady ? this.img.height * scale : 64;
    }
    draw(ctx) {
        const img = this.img;
        const imgReady = img && img.complete && img.naturalWidth > 0 && !img._loadFailed;
        if (imgReady) {
            ctx.drawImage(img, this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
        }
    }
}

// ==================== 传送门 ====================
class Portal {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = 20;
        this.active = true;
        this.pulse = 0;
    }
    canInteract(player) {
        return this.active && dist(this.x, this.y, player.x, player.y) < this.radius + player.radius + 15;
    }
    draw(ctx) {
        this.pulse += 0.05;
        const glow = 20 + Math.sin(this.pulse) * 8;
        
        // Outer glow
        const grad = ctx.createRadialGradient(this.x, this.y, 5, this.x, this.y, glow);
        grad.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
        grad.addColorStop(0.5, 'rgba(50, 150, 255, 0.4)');
        grad.addColorStop(1, 'rgba(50, 150, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glow, 0, Math.PI * 2);
        ctx.fill();
        
        // Portal center
        ctx.fillStyle = '#2196f3';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner swirl
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, this.pulse, this.pulse + Math.PI * 1.5);
        ctx.stroke();
        
        // Label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('传送门', this.x, this.y - 22);
    }
}

// ==================== 天赋数据库 ====================
const TALENTS = [
    { id: 'bullet_bounce', name: '子弹反弹', desc: '子弹可反弹1次', tier: '攻击', effect: (p) => { p.talentBounce = true; } },
    { id: 'atk_up', name: '攻击力提升', desc: '子弹伤害+1', tier: '攻击', effect: (p) => { p.bonusDamage += 1; } },
    { id: 'fire_rate', name: '攻速提升', desc: '射击速度+15%', tier: '攻击', effect: (p) => { p.fireRateMult *= 1.15; } },
    { id: 'crit_up', name: '暴击精通', desc: '暴击率+10%', tier: '攻击', effect: (p) => { p.critChance += 0.10; } },
    { id: 'shield_up', name: '护甲强化', desc: '护甲上限+1，回复+20%', tier: '防御', effect: (p) => { p.maxShield += 1; p.shield = Math.min(p.shield + 1, p.maxShield); p.shieldRegenMult *= 1.2; } },
    { id: 'hp_up', name: '生命强化', desc: '生命上限+1', tier: '防御', effect: (p) => { p.maxHp += 1; p.hp += 1; } },
    { id: 'kill_heal', name: '击杀回血', desc: '击杀敌人回复1HP', tier: '防御', effect: (p) => { p.killHeal = true; } },
    { id: 'move_speed', name: '移速提升', desc: '移动速度+15%', tier: '移动', effect: (p) => { p.speed *= 1.15; } },
    { id: 'roll_cd', name: '灵活身法', desc: '翻滚冷却-20%', tier: '移动', effect: (p) => { p.rollCdMult *= 0.8; } },
    { id: 'energy_up', name: '能量扩容', desc: '能量上限+40', tier: '资源', effect: (p) => { p.maxEnergy += 40; p.energy += 40; } },
    { id: 'energy_regen', name: '能量回流', desc: '每秒回复+2.5能量', tier: '资源', effect: (p) => { p.energyRegenFlat += 2.5; } },
    { id: 'kill_energy', name: '击杀回能', desc: '击杀敌人恢复15能量', tier: '资源', effect: (p) => { p.killEnergyGain += 15; } },
    { id: 'coin_magnet', name: '吸金体质', desc: '拾取范围+50%', tier: '资源', effect: (p) => { p.magnetRange += 60; } },
    { id: 'melee_up', name: '近战精通', desc: '近战武器伤害+3', tier: '攻击', effect: (p) => { p.meleeDmgBonus += 3; } },
    { id: 'fire_up', name: '火焰强化', desc: '火系武器弹丸+2', tier: '攻击', effect: (p) => { p.fireProjBonus += 2; } },
    { id: 'pierce', name: '穿透射击', desc: '子弹穿透1个敌人', tier: '攻击', effect: (p) => { p.piercingShot = true; } },
    { id: 'poison_touch', name: '淬毒之刃', desc: '近战命中附加2点持续伤害', tier: '攻击', effect: (p) => { p.poisonTouch = true; } },
];

// ==================== 玩家类 ====================
class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = 14;
        this.speed = 200;
        this.maxHp = 6 + globalSave.upgrades.maxHp;
        this.hp = this.maxHp;
        this.maxShield = 4 + globalSave.upgrades.maxShield;
        this.shield = this.maxShield;
        this.maxEnergy = 150 + globalSave.upgrades.maxEnergy * 20;
        this.energy = this.maxEnergy;
        this.isEnemy = false;
        this.invincible = 0;
        this.dead = false;
        this.facing = 1;
        
        // Talents / bonuses
        this.acquiredTalents = new Set();
        this.talentBounce = false;
        this.bonusDamage = 0;
        this.fireRateMult = 1;
        this.critChance = 0.05;
        this.shieldRegenMult = 1;
        this.killHeal = false;
        this.meleeDmgBonus = 0;
        this.fireProjBonus = 0;
        this.piercingShot = false;
        this.poisonTouch = false;
        this.rollCdMult = 1 - globalSave.upgrades.cooldownReduct * 0.12;
        this.energyRegenFlat = 0.3; // Very slow base regen (0.3/sec)
        this.killEnergyGain = 0;
        this.magnetRange = 0;
        
        // Exp / Level
        this.level = 1;
        this.exp = 0;
        this.expToNext = 8;
        
        // Roll
        this.rollCooldown = 0;
        this.rollDuration = 0;
        this.rollDir = { x: 0, y: 0 };
        
        // Animations
        this.anims = {
            idle: new Animator(assetLoader.get('knight_idle'), 64, 64, 6),
            run: new Animator(assetLoader.get('knight_run'), 64, 64, 10),
            attack: new Animator(assetLoader.get('knight_attack1'), 64, 64, 12),
            hurt: new Animator(assetLoader.get('knight_hurt'), 64, 64, 8),
            death: new Animator(assetLoader.get('knight_death'), 64, 64, 6),
        };
        this.currentAnim = 'idle';
        this.attacking = false;
        this.attackTimer = 0;
        this._prevX = x; this._prevY = y; this._qPressed = false;
        
        // Weapons
        this.weapons = [cloneWeapon('pistol'), cloneWeapon('sword')];
        this.weaponIndex = 0;
    }
    get currentWeapon() { return this.weapons[this.weaponIndex]; }
    pickupWeapon(w, dropPos) {
        if (this.weapons.length >= 2) {
            game.showWeaponSelect(this.weapons, w, dropPos);
            return false;
        }
        this.weapons.push(w);
        this.weaponIndex = this.weapons.length - 1;
        return true;
    }
    gainExp(amount) {
        this.exp += amount;
        if (this.exp >= this.expToNext) {
            this.exp -= this.expToNext;
            this.level++;
            this.expToNext = Math.floor(this.expToNext * 1.4);
            game.onPlayerLevelUp();
        }
    }
    
    update(dt, room) {
        if (this.dead) {
            this.anims.death.update(dt);
            return;
        }
        
        if (this.rollDuration > 0) {
            this.rollDuration -= dt;
            this.x += this.rollDir.x * 350 * dt;
            this.y += this.rollDir.y * 350 * dt;
            this.invincible = this.rollDuration;
            if (this.rollDuration <= 0) {
                this.rollCooldown = 2.5 * this.rollCdMult;
            }
        } else {
            let dx = 0, dy = 0;
            if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy -= 1;
            if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy += 1;
            if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
            if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
            
            if (dx !== 0 || dy !== 0) {
                const len = Math.sqrt(dx * dx + dy * dy);
                dx /= len; dy /= len;
                this.x += dx * this.speed * dt;
                this.y += dy * this.speed * dt;
                if (dx > 0) this.facing = 1;
                if (dx < 0) this.facing = -1;
            }
            
            if (this.rollCooldown > 0) this.rollCooldown -= dt;
            if (input.mouse.rightPressed && this.rollCooldown <= 0) {
                input.mouse.rightPressed = false;
                this.rollDuration = 0.35;
                let rdx = 0, rdy = 0;
                if (input.isDown('KeyW')) rdy -= 1;
                if (input.isDown('KeyS')) rdy += 1;
                if (input.isDown('KeyA')) rdx -= 1;
                if (input.isDown('KeyD')) rdx += 1;
                if (rdx === 0 && rdy === 0) { rdx = this.facing; }
                const rlen = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
                this.rollDir.x = rdx / rlen;
                this.rollDir.y = rdy / rlen;
                this.facing = this.rollDir.x >= 0 ? 1 : -1;
            }
            if (!input.mouse.rightDown) input.mouse.rightPressed = false;
            
            if (input.isDown('KeyQ')) {
                if (!this._qPressed) {
                    this.weaponIndex = (this.weaponIndex + 1) % this.weapons.length;
                    this._qPressed = true;
                }
            } else {
                this._qPressed = false;
            }
            
            const mpos = input.getWorldMouse(game.camera);
            const angle = angleBetween(this.x, this.y, mpos.x, mpos.y);
            if (mpos.x > this.x) this.facing = 1; else if (mpos.x < this.x) this.facing = -1;
            
            if (input.mouse.down) {
                if (this.currentWeapon.fire(this, angle, room)) {
                    this.attacking = true;
                    this.attackTimer = 0.2;
                    this.anims.attack.reset();
                }
            }
        }
        
        this.currentWeapon.update(dt);
        
        if (this.invincible > 0) this.invincible -= dt;
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) this.attacking = false;
        }
        
        // Energy regen (very slow by default, improved by talents)
        this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegenFlat * dt);
        // Shield regen (slowly)
        if (this.shield < this.maxShield) {
            this.shield = Math.min(this.maxShield, this.shield + 0.3 * this.shieldRegenMult * dt);
        }
        
        // Animation state
        if (this.dead) this.currentAnim = 'death';
        else if (this.attacking) this.currentAnim = 'attack';
        else if (this.rollDuration > 0) this.currentAnim = 'run';
        else if (Math.abs(this.x - this._prevX) > 0.1 || Math.abs(this.y - this._prevY) > 0.1) this.currentAnim = 'run';
        else this.currentAnim = 'idle';
        this._prevX = this.x; this._prevY = this.y;
        this.anims[this.currentAnim].update(dt);
        
        // Wall collision
        for (const wall of room.walls) {
            if (circleRectCollision(this.x, this.y, this.radius, wall.x, wall.y, wall.w, wall.h)) {
                const closestX = clamp(this.x, wall.x, wall.x + wall.w);
                const closestY = clamp(this.y, wall.y, wall.y + wall.h);
                const dx = this.x - closestX;
                const dy = this.y - closestY;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                this.x += (dx / d) * (this.radius + 2 - d);
                this.y += (dy / d) * (this.radius + 2 - d);
            }
        }
        
        if (!room.doorsOpen) {
            this.x = clamp(this.x, room.x + 20, room.x + room.w - 20);
            this.y = clamp(this.y, room.y + 20, room.y + room.h - 20);
        } else {
            this.x = clamp(this.x, room.x - 20, room.x + room.w + 20);
            this.y = clamp(this.y, room.y - 20, room.y + room.h + 20);
        }
    }
    
    takeDamage(dmg) {
        if (this.dead || this.invincible > 0) return;
        this.invincible = 1.0;
        if (this.shield > 0) {
            this.shield -= dmg;
            if (this.shield < 0) { this.hp += this.shield; this.shield = 0; }
        } else {
            this.hp -= dmg;
        }
        game.addFloatText(this.x, this.y - 20, `-${dmg}`, '#fff');
        game.shake = 0.15;
        game.particles.emit(this.x, this.y, '#f44336', 8, 60, 0.5, 3);
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.anims.death.reset();
        }
    }
    
    draw(ctx) {
        const alpha = this.invincible > 0 ? 0.5 + Math.sin(this.invincible * 20) * 0.3 : 1;
        this.anims[this.currentAnim].draw(ctx, this.x, this.y - 12, this.facing < 0, alpha);
        if (!this.dead && this.currentWeapon) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.currentWeapon.fullName, this.x, this.y - 38);
        }
    }
}

// ==================== 敌人类 ====================
class Enemy {
    constructor(x, y, type) {
        this.x = x; this.y = y;
        this.type = type;
        this.radius = 14;
        this.active = true;
        this.dead = false;
        this.invincible = 0;
        this.facing = -1;
        this.anim = 'idle';
        this.flash = 0;
        this.attackCooldown = 0;
        this.state = 'idle';
        this.stateTimer = 0;
        this.expValue = 2;
    }
    update(dt, room, player) {
        if (this.dead) {
            this.anims.death.update(dt);
            if (this.anims.death.done) this.active = false;
            return;
        }
        if (this.invincible > 0) this.invincible -= dt;
        if (this.flash > 0) this.flash -= dt;
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        // Poison damage
        if (this.poisonTimer > 0) {
            this.poisonTimer -= dt;
            if (Math.floor(this.poisonTimer * 10) % 5 === 0 && this.poisonStack > 0) {
                this.hp -= this.poisonStack;
                game.particles.emit(this.x, this.y, '#76ff03', 2, 20, 0.15, 2);
                if (this.hp <= 0) this.die();
            }
        } else {
            this.poisonStack = 0;
        }
        
        const d = dist(this.x, this.y, player.x, player.y);
        this.ai(dt, room, player, d);
        
        for (const wall of room.walls) {
            if (circleRectCollision(this.x, this.y, this.radius, wall.x, wall.y, wall.w, wall.h)) {
                const closestX = clamp(this.x, wall.x, wall.x + wall.w);
                const closestY = clamp(this.y, wall.y, wall.y + wall.h);
                const dx = this.x - closestX;
                const dy = this.y - closestY;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                this.x += (dx / len) * (this.radius + 2 - len);
                this.y += (dy / len) * (this.radius + 2 - len);
            }
        }
        this.x = clamp(this.x, room.x + 20, room.x + room.w - 20);
        this.y = clamp(this.y, room.y + 20, room.y + room.h - 20);
        this.anims[this.anim].update(dt);
    }
    ai(dt, room, player, distToPlayer) {}
    takeDamage(dmg) {
        if (this.dead || this.invincible > 0) return;
        this.hp -= dmg;
        this.invincible = 0.15;
        this.flash = 0.1;
        game.addFloatText(this.x, this.y - 20, `${dmg}`, '#ffeb3b');
        game.particles.emit(this.x, this.y, '#fff', 3, 30, 0.2, 2);
        if (this.hp <= 0) this.die();
    }
    die() {
        this.dead = true;
        this.anims.death.reset();
        game.kills++;
        if (game.player && game.player.killHeal) {
            game.player.hp = Math.min(game.player.maxHp, game.player.hp + 1);
        }
        if (game.player && game.player.killEnergyGain > 0) {
            game.player.energy = Math.min(game.player.maxEnergy, game.player.energy + game.player.killEnergyGain);
        }
        game.player.gainExp(this.expValue);
        game.particles.emit(this.x, this.y, '#f44336', 10, 50, 0.6, 4);
        const roll = Math.random();
        if (roll < 0.35) game.currentRoom.drops.push(new Drop(this.x, this.y, 'coin', randInt(1, 3)));
        else if (roll < 0.60) game.currentRoom.drops.push(new Drop(this.x, this.y, 'energy', randInt(10, 25)));
        else if (roll < 0.68) game.currentRoom.drops.push(new Drop(this.x, this.y, 'hp', 1));
        else if (roll < 0.73) game.currentRoom.drops.push(new Drop(this.x, this.y, 'gem', randInt(1, 3)));
    }
    draw(ctx) {
        if (!this.active) return;
        const alpha = this.flash > 0 ? 0.5 : 1;
        this.anims[this.anim].draw(ctx, this.x, this.y - 10, this.facing > 0, alpha);
        if (!this.dead && this.hp < this.maxHp) {
            const bw = 24, bh = 4;
            const pct = this.hp / this.maxHp;
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x - bw / 2, this.y - 36, bw, bh);
            ctx.fillStyle = pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#f44336';
            ctx.fillRect(this.x - bw / 2, this.y - 36, bw * pct, bh);
        }
    }
}

class SlimeEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'slime');
        this.hp = 4; this.maxHp = 4;
        this.speed = 60;
        this.damage = 2;
        this.radius = 16;
        this.expValue = 2;
        this.anims = {
            idle: new Animator(assetLoader.get('slime_idle'), 64, 64, 4),
            walk: new Animator(assetLoader.get('slime_walk'), 64, 64, 4),
            death: new Animator(assetLoader.get('slime_death'), 64, 64, 5),
        };
    }
    ai(dt, room, player, d) {
        if (d < 250) {
            this.state = 'chase'; this.anim = 'walk';
            const angle = angleBetween(this.x, this.y, player.x, player.y);
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
            this.facing = Math.cos(angle) > 0 ? 1 : -1;
            if (d < this.radius + player.radius) player.takeDamage(this.damage);
        } else { this.state = 'idle'; this.anim = 'idle'; }
    }
}

class SkeletonEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'skeleton');
        this.hp = 7; this.maxHp = 7;
        this.speed = 90;
        this.damage = 3;
        this.radius = 16;
        this.expValue = 3;
        this.anims = {
            idle: new Animator(assetLoader.get('skeleton_idle'), 64, 64, 6),
            walk: new Animator(assetLoader.get('skeleton_walk'), 64, 64, 8),
            attack: new Animator(assetLoader.get('skeleton_attack'), 64, 64, 8),
            hurt: new Animator(assetLoader.get('skeleton_hurt'), 64, 64, 6),
            death: new Animator(assetLoader.get('skeleton_death'), 64, 64, 6),
        };
    }
    ai(dt, room, player, d) {
        if (d < 300) {
            if (d < 40) {
                this.anim = 'attack';
                if (this.attackCooldown <= 0) { player.takeDamage(this.damage); this.attackCooldown = 1.2; }
            } else {
                this.anim = 'walk';
                const angle = angleBetween(this.x, this.y, player.x, player.y);
                this.x += Math.cos(angle) * this.speed * dt;
                this.y += Math.sin(angle) * this.speed * dt;
                this.facing = Math.cos(angle) > 0 ? 1 : -1;
            }
        } else { this.anim = 'idle'; }
    }
    takeDamage(dmg) { super.takeDamage(dmg); if (!this.dead) this.anim = 'hurt'; }
}

class MushroomEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'mushroom');
        this.hp = 10; this.maxHp = 10;
        this.speed = 50;
        this.damage = 3;
        this.radius = 18;
        this.expValue = 4;
        this.anims = {
            idle: new Animator(assetLoader.get('mushroom_idle'), 64, 64, 5),
            jump: new Animator(assetLoader.get('mushroom_jump'), 64, 64, 7),
            attack: new Animator(assetLoader.get('mushroom_attack'), 64, 64, 7),
            death: new Animator(assetLoader.get('mushroom_death'), 64, 64, 5),
        };
        this.jumpTarget = null;
        this.jumpTimer = 0;
    }
    ai(dt, room, player, d) {
        this.jumpTimer -= dt;
        if (this.jumpTarget) {
            this.x = lerp(this.x, this.jumpTarget.x, 4 * dt);
            this.y = lerp(this.y, this.jumpTarget.y, 4 * dt);
            this.anim = 'jump';
            if (dist(this.x, this.y, this.jumpTarget.x, this.jumpTarget.y) < 5) {
                this.jumpTarget = null; this.attackCooldown = 1.0;
            }
        } else if (d < 350) {
            if (d < 35 && this.attackCooldown <= 0) {
                this.anim = 'attack'; player.takeDamage(this.damage); this.attackCooldown = 1.0;
            } else if (d > 100 && this.jumpTimer <= 0) {
                const angle = angleBetween(this.x, this.y, player.x, player.y);
                this.jumpTarget = { x: player.x - Math.cos(angle) * 20, y: player.y - Math.sin(angle) * 20 };
                this.jumpTimer = 3;
                this.facing = Math.cos(angle) > 0 ? 1 : -1;
            } else { this.anim = 'idle'; }
        } else { this.anim = 'idle'; }
    }
}

class WizardEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'wizard');
        this.hp = 5; this.maxHp = 5;
        this.speed = 50;
        this.damage = 3;
        this.radius = 16;
        this.expValue = 4;
        this.anims = {
            idle: new Animator(assetLoader.get('wizard_idle'), 64, 64, 5),
            run: new Animator(assetLoader.get('wizard_run'), 64, 64, 8),
            attack: new Animator(assetLoader.get('wizard_attack1'), 64, 64, 8),
            hurt: new Animator(assetLoader.get('wizard_hurt'), 64, 64, 6),
            death: new Animator(assetLoader.get('wizard_death'), 64, 64, 6),
        };
    }
    ai(dt, room, player, d) {
        if (d < 400) {
            const angle = angleBetween(this.x, this.y, player.x, player.y);
            this.facing = Math.cos(angle) > 0 ? 1 : -1;
            if (d < 120) {
                this.anim = 'run';
                this.x -= Math.cos(angle) * this.speed * dt;
                this.y -= Math.sin(angle) * this.speed * dt;
            } else if (d < 350 && this.attackCooldown <= 0) {
                this.anim = 'attack';
                const wb = game.bulletPool.acquire();
                wb.init(this.x, this.y, angle, 220, this.damage, 5, true, '#e040fb');
                room.bullets.push(wb);
                this.attackCooldown = 1.8;
            } else { this.anim = 'idle'; }
        } else { this.anim = 'idle'; }
    }
    takeDamage(dmg) { super.takeDamage(dmg); if (!this.dead) this.anim = 'hurt'; }
}

class BossEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'boss');
        this.hp = 120; this.maxHp = 120;
        this.speed = 70;
        this.damage = 8;
        this.radius = 34;
        this.expValue = 20;
        this.anims = {
            idle: new Animator(assetLoader.get('boss_idle'), 64, 64, 5),
            attack: new Animator(assetLoader.get('boss_attack'), 64, 64, 6),
            hurt: new Animator(assetLoader.get('boss_hurt'), 64, 64, 6),
            death: new Animator(assetLoader.get('boss_death'), 64, 64, 6),
            fly: new Animator(assetLoader.get('boss_fly'), 64, 64, 5),
        };
        this.phase = 1;
        this.burstTimer = 0;
        this.summonTimer = 0;
    }
    get phaseThreshold() {
        const p = this.hp / this.maxHp;
        if (p > 0.6) return 1;
        if (p > 0.3) return 2;
        return 3;
    }
    ai(dt, room, player, d) {
        this.phase = this.phaseThreshold;
        const angle = angleBetween(this.x, this.y, player.x, player.y);
        this.facing = Math.cos(angle) > 0 ? 1 : -1;
        if (d > 60) {
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
            this.anim = 'fly';
        }
        this.burstTimer -= dt;
        this.summonTimer -= dt;
        if (this.burstTimer <= 0) {
            this.anim = 'attack';
            if (this.phase === 1) {
                for (let i = -1; i <= 1; i++) {
                    const bb = game.bulletPool.acquire();
                    bb.init(this.x, this.y, angle + i * 0.25, 200, 2, 6, true, '#ff5252');
                    room.bullets.push(bb);
                }
                this.burstTimer = 1.5;
            } else if (this.phase === 2) {
                for (let i = 0; i < 8; i++) {
                    const bb = game.bulletPool.acquire();
                    bb.init(this.x, this.y, (Math.PI * 2 / 8) * i + Math.random() * 0.3, 180, 2, 5, true, '#ff5252');
                    room.bullets.push(bb);
                }
                this.burstTimer = 1.2;
            } else {
                for (let i = 0; i < 12; i++) {
                    const bb = game.bulletPool.acquire();
                    bb.init(this.x, this.y, angle + (Math.random() - 0.5) * 1.0, 220 + Math.random() * 60, 2, 5, true, '#ff1744');
                    room.bullets.push(bb);
                }
                this.burstTimer = 0.8;
            }
        }
        if (this.phase >= 3 && this.summonTimer <= 0) {
            room.enemies.push(new SlimeEnemy(this.x + rand(-80, 80), this.y + rand(-80, 80)));
            this.summonTimer = 5;
        }
        if (d < this.radius + player.radius && this.attackCooldown <= 0) {
            player.takeDamage(this.damage); this.attackCooldown = 1.0;
        }
    }
    takeDamage(dmg) {
        super.takeDamage(dmg);
        if (!this.dead) { this.anim = 'hurt'; game.shake = 0.2; }
    }
    die() {
        this.dead = true;
        this.anims.death.reset();
        game.kills++;
        game.shake = 0.5;
        game.particles.emit(this.x, this.y, '#ff5252', 30, 80, 1.0, 6);
        game.particles.emit(this.x, this.y, '#ffd700', 20, 60, 1.0, 4);
        game.currentRoom.drops.push(new Drop(this.x, this.y, 'gem', randInt(10, 20)));
        game.currentRoom.drops.push(new Drop(this.x + 20, this.y, 'hp', 2));
        game.currentRoom.drops.push(new Drop(this.x - 20, this.y, 'weapon', randomWeaponByFloor(game.floor)));
    }
}

// ==================== 精英敌人变体 ====================
class EliteSlimeEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'slime');
        this.hp = 14; this.maxHp = 14;
        this.speed = 80;
        this.damage = 5;
        this.radius = 22;
        this.expValue = 5;
        this.anims = {
            idle: new Animator(assetLoader.get('slime_idle'), 64, 64, 4),
            walk: new Animator(assetLoader.get('slime_walk'), 64, 64, 4),
            death: new Animator(assetLoader.get('slime_death'), 64, 64, 5),
        };
        this.splitOnDeath = true;
    }
    ai(dt, room, player, d) {
        if (d < 280) {
            this.state = 'chase'; this.anim = 'walk';
            const angle = angleBetween(this.x, this.y, player.x, player.y);
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
            this.facing = Math.cos(angle) > 0 ? 1 : -1;
            if (d < this.radius + player.radius) player.takeDamage(this.damage);
        } else { this.state = 'idle'; this.anim = 'idle'; }
    }
    die() {
        this.dead = true;
        this.anims.death.reset();
        game.kills++;
        game.player.gainExp(this.expValue);
        game.particles.emit(this.x, this.y, '#4caf50', 12, 50, 0.6, 4);
        // Split into 2 small slimes
        for (let i = 0; i < 2; i++) {
            const sx = this.x + rand(-30, 30);
            const sy = this.y + rand(-30, 30);
            game.currentRoom.enemies.push(new SlimeEnemy(sx, sy));
        }
        game.currentRoom.drops.push(new Drop(this.x, this.y, 'coin', randInt(3, 8)));
        if (Math.random() < 0.4) game.currentRoom.drops.push(new Drop(this.x, this.y, 'gem', randInt(1, 3)));
    }
}

class SkeletonArcherEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'skeleton');
        this.hp = 5; this.maxHp = 5;
        this.speed = 50;
        this.damage = 3;
        this.radius = 16;
        this.expValue = 4;
        this.anims = {
            idle: new Animator(assetLoader.get('skeleton_idle'), 64, 64, 6),
            walk: new Animator(assetLoader.get('skeleton_walk'), 64, 64, 8),
            attack: new Animator(assetLoader.get('skeleton_attack'), 64, 64, 8),
            hurt: new Animator(assetLoader.get('skeleton_hurt'), 64, 64, 6),
            death: new Animator(assetLoader.get('skeleton_death'), 64, 64, 6),
        };
        this.fleeTimer = 0;
    }
    ai(dt, room, player, d) {
        this.fleeTimer -= dt;
        const angle = angleBetween(this.x, this.y, player.x, player.y);
        this.facing = Math.cos(angle) > 0 ? 1 : -1;
        if (d < 100) {
            // Flee from player
            this.anim = 'walk';
            this.x -= Math.cos(angle) * this.speed * dt;
            this.y -= Math.sin(angle) * this.speed * dt;
            this.fleeTimer = 0.5;
        } else if (d < 350 && this.attackCooldown <= 0) {
            this.anim = 'attack';
            const ab = game.bulletPool.acquire();
            ab.init(this.x, this.y, angle, 300, this.damage, 5, true, '#ff9800');
            room.bullets.push(ab);
            this.attackCooldown = 1.5;
        } else if (d > 350 && this.fleeTimer <= 0) {
            this.anim = 'walk';
            this.x += Math.cos(angle) * this.speed * 0.5 * dt;
            this.y += Math.sin(angle) * this.speed * 0.5 * dt;
        } else {
            this.anim = 'idle';
        }
    }
    takeDamage(dmg) { super.takeDamage(dmg); if (!this.dead) this.anim = 'hurt'; }
}

class EnragedMushroomEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'mushroom');
        this.hp = 18; this.maxHp = 18;
        this.speed = 70;
        this.damage = 6;
        this.radius = 20;
        this.expValue = 6;
        this.anims = {
            idle: new Animator(assetLoader.get('mushroom_idle'), 64, 64, 5),
            jump: new Animator(assetLoader.get('mushroom_jump'), 64, 64, 7),
            attack: new Animator(assetLoader.get('mushroom_attack'), 64, 64, 7),
            death: new Animator(assetLoader.get('mushroom_death'), 64, 64, 5),
        };
        this.jumpTarget = null;
        this.jumpTimer = 0;
        this.rageThreshold = 0.5;
    }
    get enraged() { return this.hp < this.maxHp * this.rageThreshold; }
    ai(dt, room, player, d) {
        this.jumpTimer -= dt;
        const spd = this.enraged ? this.speed * 1.6 : this.speed;
        if (this.jumpTarget) {
            const lerpSpd = this.enraged ? 7 : 4;
            this.x = lerp(this.x, this.jumpTarget.x, lerpSpd * dt);
            this.y = lerp(this.y, this.jumpTarget.y, lerpSpd * dt);
            this.anim = 'jump';
            if (dist(this.x, this.y, this.jumpTarget.x, this.jumpTarget.y) < 5) {
                this.jumpTarget = null; this.attackCooldown = this.enraged ? 0.4 : 1.0;
            }
        } else if (d < 380) {
            if (d < 35 && this.attackCooldown <= 0) {
                this.anim = 'attack';
                player.takeDamage(this.damage);
                this.attackCooldown = this.enraged ? 0.5 : 1.0;
                if (this.enraged) game.particles.emit(this.x, this.y, '#ff3d00', 5, 40, 0.3, 3);
            } else if (d > 80 && this.jumpTimer <= 0) {
                const angle = angleBetween(this.x, this.y, player.x, player.y);
                this.jumpTarget = { x: player.x - Math.cos(angle) * 15, y: player.y - Math.sin(angle) * 15 };
                this.jumpTimer = this.enraged ? 1.5 : 3;
                this.facing = Math.cos(angle) > 0 ? 1 : -1;
            } else { this.anim = 'idle'; }
        } else { this.anim = 'idle'; }
    }
}

// ==================== 房间系统 ====================
class Room {
    constructor(gx, gy, type) {
        this.gx = gx; this.gy = gy;
        this.type = type;
        this.w = 720; this.h = 480;
        this.x = gx * 800; this.y = gy * 520;
        this.cleared = false;
        this.visited = false;
        this.doors = { top: false, bottom: false, left: false, right: false };
        this.neighbors = { top: null, bottom: null, left: null, right: null };
        this.walls = [];
        this.enemies = [];
        this.bullets = [];
        this.drops = [];
        this.chests = [];
        this.portal = null;
        this.doorsOpen = true;
        this.bgCanvas = null;
        this.decorations = [];
        this.generateWalls();
    }
    renderBackground() {
        const w = this.w, h = this.h;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        // Floor color by room type
        const floorColors = { boss: '#2a1a1a', elite: '#1a2a1a', start: '#1e2a1e', normal: '#1e1e2e', chest: '#1e1e2a', shop: '#2a2a1e' };
        cx.fillStyle = floorColors[this.type] || '#1e1e2e';
        cx.fillRect(0, 0, w, h);
        // Tilemap floor texture (subtle)
        const tileImg = assetLoader.get('tilemap');
        if (tileImg && tileImg.complete && tileImg.naturalWidth > 0 && !tileImg._loadFailed) {
            cx.globalAlpha = 0.08;
            const pattern = cx.createPattern(tileImg, 'repeat');
            if (pattern) { cx.fillStyle = pattern; cx.fillRect(0, 0, w, h); }
            cx.globalAlpha = 1;
        }
        // Grid overlay
        cx.strokeStyle = 'rgba(255,255,255,0.02)';
        cx.lineWidth = 1;
        for (let i = 0; i < w; i += 40) { cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i, h); cx.stroke(); }
        for (let i = 0; i < h; i += 40) { cx.beginPath(); cx.moveTo(0, i); cx.lineTo(w, i); cx.stroke(); }
        // Walls
        const wallColor = this.type === 'boss' ? '#3e2723' : '#2d2d44';
        for (const wl of this.walls) {
            const rx = wl.x - this.x, ry = wl.y - this.y;
            cx.fillStyle = wallColor;
            cx.fillRect(rx, ry, wl.w, wl.h);
            cx.fillStyle = 'rgba(255,255,255,0.05)';
            cx.fillRect(rx, ry, wl.w, 2);
        }
        // Doors
        if (this.doorsOpen) {
            cx.fillStyle = 'rgba(0,0,0,0.3)';
            const dw = 100, dh = 20;
            if (this.doors.top) cx.fillRect(w / 2 - dw / 2, -5, dw, dh);
            if (this.doors.bottom) cx.fillRect(w / 2 - dw / 2, h - 15, dw, dh);
            if (this.doors.left) cx.fillRect(-5, h / 2 - dw / 2, dh, dw);
            if (this.doors.right) cx.fillRect(w - 15, h / 2 - dw / 2, dh, dw);
        }
        // Label
        if (this.type === 'boss') {
            cx.fillStyle = 'rgba(244,67,54,0.25)';
            cx.font = 'bold 20px sans-serif'; cx.textAlign = 'center';
            cx.fillText('☠ BOSS ☠', w / 2, 35);
        } else if (this.type === 'shop') {
            cx.fillStyle = 'rgba(255,215,0,0.2)';
            cx.font = 'bold 16px sans-serif'; cx.textAlign = 'center';
            cx.fillText('💰 商店', w / 2, 30);
        } else if (this.type === 'chest') {
            cx.fillStyle = 'rgba(224,64,251,0.2)';
            cx.font = 'bold 16px sans-serif'; cx.textAlign = 'center';
            cx.fillText('📦 宝箱房', w / 2, 30);
        } else if (this.type === 'elite') {
            cx.fillStyle = 'rgba(255,152,0,0.18)';
            cx.font = 'bold 15px sans-serif'; cx.textAlign = 'center';
            cx.fillText('⚔ 精英房', w / 2, 30);
        } else {
            cx.fillStyle = 'rgba(255,255,255,0.1)';
            cx.font = '14px sans-serif'; cx.textAlign = 'center';
            const labels = { start: '起点', normal: '战斗房' };
            cx.fillText(labels[this.type] || '', w / 2, 30);
        }
        this.bgCanvas = c;
    }
    generateWalls() {
        const wallThick = 20;
        const w = this.w, h = this.h;
        if (!this.doors.top) {
            this.walls.push({ x: this.x, y: this.y, w: w, h: wallThick });
        } else {
            this.walls.push({ x: this.x, y: this.y, w: w * 0.35, h: wallThick });
            this.walls.push({ x: this.x + w * 0.65, y: this.y, w: w * 0.35, h: wallThick });
        }
        if (!this.doors.bottom) {
            this.walls.push({ x: this.x, y: this.y + h - wallThick, w: w, h: wallThick });
        } else {
            this.walls.push({ x: this.x, y: this.y + h - wallThick, w: w * 0.35, h: wallThick });
            this.walls.push({ x: this.x + w * 0.65, y: this.y + h - wallThick, w: w * 0.35, h: wallThick });
        }
        if (!this.doors.left) {
            this.walls.push({ x: this.x, y: this.y, w: wallThick, h: h });
        } else {
            this.walls.push({ x: this.x, y: this.y, w: wallThick, h: h * 0.35 });
            this.walls.push({ x: this.x, y: this.y + h * 0.65, w: wallThick, h: h * 0.35 });
        }
        if (!this.doors.right) {
            this.walls.push({ x: this.x + w - wallThick, y: this.y, w: wallThick, h: h });
        } else {
            this.walls.push({ x: this.x + w - wallThick, y: this.y, w: wallThick, h: h * 0.35 });
            this.walls.push({ x: this.x + w - wallThick, y: this.y + h * 0.65, w: wallThick, h: h * 0.35 });
        }
        if (this.type !== 'start' && this.type !== 'boss') {
            const obstacleCount = randInt(0, 3);
            for (let i = 0; i < obstacleCount; i++) {
                const ow = rand(40, 100), oh = rand(40, 100);
                const ox = this.x + rand(80, w - 80 - ow);
                const oy = this.y + rand(80, h - 80 - oh);
                this.walls.push({ x: ox, y: oy, w: ow, h: oh });
            }
        }
        this.renderBackground();
    }
    spawnEnemies(floorNum) {
        if (this.cleared || this.type === 'start' || this.type === 'chest' || this.type === 'shop') return;
        const difficulty = 1 + (floorNum - 1) * 0.3;
        let count = 0;
        const types = [];
        if (this.type === 'normal') {
            count = randInt(3 + Math.floor(difficulty), 6 + Math.floor(difficulty));
            types.push('slime', 'slime', 'skeleton', 'skeleton_archer');
            if (floorNum >= 2) types.push('mushroom', 'elite_slime');
            if (floorNum >= 3) types.push('wizard', 'enraged_mushroom');
        } else if (this.type === 'elite') {
            count = randInt(4, 7);
            types.push('skeleton', 'skeleton_archer', 'mushroom', 'elite_slime');
            if (floorNum >= 2) types.push('wizard', 'enraged_mushroom');
        } else if (this.type === 'boss') {
            this.enemies.push(new BossEnemy(this.x + this.w / 2, this.y + this.h / 2));
        }
        for (let i = 0; i < count; i++) {
            const t = randItem(types);
            let ex, ey, safe = false, attempts = 0;
            while (!safe && attempts < 50) {
                ex = this.x + rand(60, this.w - 60);
                ey = this.y + rand(60, this.h - 60);
                safe = true;
                for (const w of this.walls) {
                    if (circleRectCollision(ex, ey, 20, w.x, w.y, w.w, w.h)) { safe = false; break; }
                }
                attempts++;
            }
            if (t === 'slime') this.enemies.push(new SlimeEnemy(ex, ey));
            else if (t === 'skeleton') this.enemies.push(new SkeletonEnemy(ex, ey));
            else if (t === 'mushroom') this.enemies.push(new MushroomEnemy(ex, ey));
            else if (t === 'wizard') this.enemies.push(new WizardEnemy(ex, ey));
            else if (t === 'elite_slime') this.enemies.push(new EliteSlimeEnemy(ex, ey));
            else if (t === 'skeleton_archer') this.enemies.push(new SkeletonArcherEnemy(ex, ey));
            else if (t === 'enraged_mushroom') this.enemies.push(new EnragedMushroomEnemy(ex, ey));
        }
        // HP scaling per floor (+20% per floor)
        if (floorNum > 1) {
            const hpScale = 1 + (floorNum - 1) * 0.2;
            for (const e of this.enemies) {
                e.hp = Math.floor(e.hp * hpScale);
                e.maxHp = e.hp;
            }
        }
    }
    spawnChests() {
        if (this.type !== 'chest' || this.chests.length > 0) return;
        const quality = 1 + Math.floor(Math.random() * (1 + globalSave.upgrades.chestQuality * 0.3));
        this.chests.push(new Chest(this.x + this.w / 2, this.y + this.h / 2, Math.min(quality, 3)));
    }
    generateDecorations() {
        this.decorations = [];
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const margin = 60;
        // Helper to find a safe position (not inside walls, not too close to center)
        const findPos = () => {
            for (let attempt = 0; attempt < 30; attempt++) {
                const px = this.x + rand(margin, this.w - margin);
                const py = this.y + rand(margin, this.h - margin);
                const distToCenter = dist(px, py, cx, cy);
                if (distToCenter < 50) continue;
                let blocked = false;
                for (const w of this.walls) {
                    if (circleRectCollision(px, py, 20, w.x, w.y, w.w, w.h)) { blocked = true; break; }
                }
                if (!blocked) return { x: px, y: py };
            }
            return null;
        };
        const addProp = (imgKey, scale = 0.2, collidable = false) => {
            const pos = findPos();
            if (pos) this.decorations.push(new DecoProp(pos.x, pos.y, imgKey, scale, collidable));
        };
        // Decoration themes by room type
        if (this.type === 'normal') {
            const pool = ['deco_barrel', 'deco_barrelsStacked', 'deco_woodenCrate', 'deco_chair', 'deco_hayBales'];
            const count = randInt(2, 4);
            for (let i = 0; i < count; i++) addProp(randItem(pool), rand(0.15, 0.22), Math.random() < 0.3);
        } else if (this.type === 'elite') {
            const pool = ['deco_stoneColumn', 'deco_candleStand', 'deco_barrelsStacked', 'deco_tableRound'];
            const count = randInt(3, 5);
            for (let i = 0; i < count; i++) addProp(randItem(pool), rand(0.18, 0.25), Math.random() < 0.5);
        } else if (this.type === 'boss') {
            const bossProps = ['deco_stoneColumn', 'deco_stoneColumn', 'deco_candleStand', 'deco_candleStand'];
            const count = randInt(4, 6);
            for (let i = 0; i < count; i++) addProp(randItem(bossProps), rand(0.2, 0.28), Math.random() < 0.6);
            // Add a carpet in the center
            this.decorations.push(new DecoProp(cx, cy, 'deco_floorCarpet', 0.35, false));
        } else if (this.type === 'chest') {
            const pool = ['deco_bookcaseBooks', 'deco_displayCaseSword', 'deco_candleStand', 'deco_chair'];
            const count = randInt(2, 3);
            for (let i = 0; i < count; i++) addProp(randItem(pool), rand(0.15, 0.22), Math.random() < 0.4);
        } else if (this.type === 'shop') {
            const pool = ['deco_longTable', 'deco_chair', 'deco_candleStand', 'deco_bookcaseBooks'];
            const count = randInt(3, 5);
            for (let i = 0; i < count; i++) addProp(randItem(pool), rand(0.16, 0.22), Math.random() < 0.4);
        }
        // Add border fence for start room
        if (this.type === 'start') {
            const fCount = randInt(2, 3);
            for (let i = 0; i < fCount; i++) addProp('deco_fenceLow', rand(0.18, 0.22), true);
        }
    }
    checkCombat(player) {
        if (this.cleared) return false;
        if (this.type === 'start' || this.type === 'chest') return false;
        if (this.type === 'shop') {
            if (!this.visited) {
                this.visited = true;
                game.addFloatText(player.x, player.y - 30, '按 F 打开商店', '#ffd700');
            }
            return false;
        }
        if (!this.visited) {
            this.visited = true;
            this.doorsOpen = false;
            this.walls = []; this.generateWalls(); this.generateDecorations();
            this.spawnEnemies(game.floor);
            return true;
        }
        if (!this.doorsOpen && this.enemies.length === 0) {
            this.cleared = true;
            this.doorsOpen = true;
            this.walls = []; this.generateWalls(); this.generateDecorations();
            if (this.type === 'elite') {
                this.drops.push(new Drop(this.x + this.w / 2, this.y + this.h / 2, 'weapon', randomWeaponByFloor(game.floor)));
            } else if (this.type === 'normal' && Math.random() < 0.3) {
                this.drops.push(new Drop(this.x + this.w / 2, this.y + this.h / 2, 'coin', randInt(5, 15)));
            } else if (this.type === 'boss') {
                this.portal = new Portal(this.x + this.w / 2, this.y + this.h / 2);
                game.addFloatText(this.x + this.w / 2, this.y + this.h / 2 - 40, '传送门已开启！', '#2196f3');
            }
            game.addFloatText(this.x + this.w / 2, this.y + this.h / 2 - 30, '房间清理完成！', '#4caf50');
            return false;
        }
        return !this.doorsOpen;
    }
    update(dt, player) {
        // Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].update(dt, this);
            if (!this.bullets[i].active) {
                game.bulletPool.release(this.bullets[i]);
                this.bullets[i] = this.bullets[this.bullets.length - 1];
                this.bullets.pop();
                continue;
            }
            const b = this.bullets[i];
            if (b.isEnemy) {
                if (dist(b.x, b.y, player.x, player.y) < player.radius + b.radius) {
                    player.takeDamage(b.damage); b.active = false;
                }
            } else {
                for (const e of this.enemies) {
                    if (!e.dead && dist(b.x, b.y, e.x, e.y) < e.radius + b.radius) {
                        let dmg = b.damage + player.bonusDamage;
                        if (Math.random() < player.critChance) { dmg = Math.floor(dmg * 2); game.addFloatText(e.x, e.y - 30, '暴击!', '#ffd700'); }
                        e.takeDamage(dmg);
                        if (player.poisonTouch && b.color === '#ff3d00') {
                            e.poisonStack = (e.poisonStack || 0) + 2;
                            e.poisonTimer = 3;
                        }
                        if (b.pierceRemaining > 0) {
                            b.pierceRemaining--;
                        } else {
                            b.active = false;
                        }
                        break;
                    }
                }
            }
        }
        // Melee hits
        for (let i = game.meleeHits.length - 1; i >= 0; i--) {
            const mh = game.meleeHits[i];
            mh.life -= dt;
            if (mh.life <= 0) {
                game.meleeHits[i] = game.meleeHits[game.meleeHits.length - 1];
                game.meleeHits.pop();
                continue;
            }
            if (mh.owner === player) {
                for (const e of this.enemies) {
                    if (!e.dead && !mh.hitSet.has(e) && dist(mh.x, mh.y, e.x, e.y) < e.radius + mh.r) {
                        mh.hitSet.add(e);
                        let dmg = mh.damage + player.bonusDamage;
                        if (Math.random() < player.critChance) dmg = Math.floor(dmg * 2);
                        e.takeDamage(dmg);
                        if (mh.poison) {
                            e.poisonStack = (e.poisonStack || 0) + 2;
                            e.poisonTimer = 3;
                        }
                    }
                }
            } else {
                if (!mh.hitSet.has(player) && dist(mh.x, mh.y, player.x, player.y) < player.radius + mh.r) {
                    mh.hitSet.add(player); player.takeDamage(mh.damage);
                }
            }
        }
        // Enemies
        for (const e of this.enemies) e.update(dt, this, player);
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (!this.enemies[i].active) {
                this.enemies[i] = this.enemies[this.enemies.length - 1];
                this.enemies.pop();
            }
        }
        // Drops
        for (const d of this.drops) d.update(dt, player);
        for (let i = this.drops.length - 1; i >= 0; i--) {
            if (!this.drops[i].active) {
                this.drops[i] = this.drops[this.drops.length - 1];
                this.drops.pop();
            }
        }
        // Chests
        for (const c of this.chests) {
            if (!c.opened && c.canInteract(player)) {
                UI.interactHint.style.display = 'block';
                UI.interactHint.textContent = '按 F 打开宝箱';
                game.nearChest = c;
            }
        }
        // Shop room interact hint
        if (this.type === 'shop') {
            UI.interactHint.style.display = 'block';
            UI.interactHint.textContent = '按 F 打开商店';
        }
        // Portal
        if (this.portal && this.portal.active && this.portal.canInteract(player)) {
            UI.interactHint.style.display = 'block';
            UI.interactHint.textContent = '按 F 进入下一层';
            game.nearPortal = this.portal;
        }
    }
    draw(ctx) {
        if (this.bgCanvas) {
            ctx.drawImage(this.bgCanvas, this.x, this.y);
        } else {
            ctx.fillStyle = '#1e1e2e';
            ctx.fillRect(this.x, this.y, this.w, this.h);
        }
    }
    drawEntities(ctx) {
        // Draw decorations first (behind entities)
        for (const deco of this.decorations) deco.draw(ctx);
        if (this.portal) this.portal.draw(ctx);
        for (const c of this.chests) c.draw(ctx);
        for (const d of this.drops) d.draw(ctx);
        for (const e of this.enemies) e.draw(ctx);
        for (const b of this.bullets) b.draw(ctx);
        for (const mh of game.meleeHits) {
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(mh.x, mh.y, mh.r, mh.angle - 0.8, mh.angle + 0.8);
            ctx.stroke();
        }
    }
}

// ==================== 地图生成 ====================
function generateDungeon(floorNum) {
    const rooms = [];
    const grid = Array(5).fill().map(() => Array(5).fill(null));
    const startX = 2, startY = 2;
    let cx = startX, cy = startY;
    grid[cy][cx] = new Room(cx, cy, 'start');
    rooms.push(grid[cy][cx]);
    const directions = [[0, -1, 'top', 'bottom'], [0, 1, 'bottom', 'top'], [-1, 0, 'left', 'right'], [1, 0, 'right', 'left']];
    const roomCount = randInt(7, 12);
    while (rooms.length < roomCount) {
        const validDirs = directions.filter(([dx, dy]) => {
            const nx = cx + dx, ny = cy + dy;
            return nx >= 0 && nx < 5 && ny >= 0 && ny < 5 && !grid[ny][nx];
        });
        if (validDirs.length === 0) {
            const candidates = rooms.filter(r => directions.some(([dx, dy]) => {
                const nx = r.gx + dx, ny = r.gy + dy;
                return nx >= 0 && nx < 5 && ny >= 0 && ny < 5 && !grid[ny][nx];
            }));
            if (candidates.length === 0) break;
            const pick = randItem(candidates);
            cx = pick.gx; cy = pick.gy;
            continue;
        }
        const [dx, dy, dir, opp] = randItem(validDirs);
        cx += dx; cy += dy;
        let type = 'normal';
        const roll = Math.random();
        if (roll < 0.15) type = 'elite';
        else if (roll < 0.25) type = 'chest';
        else if (roll < 0.3) type = 'shop';
        const room = new Room(cx, cy, type);
        grid[cy][cx] = room; rooms.push(room);
        const prev = grid[cy - dy][cx - dx];
        prev.doors[dir] = true; room.doors[opp] = true;
    }
    let furthest = rooms[0], maxDist = 0;
    for (const r of rooms) {
        const d = Math.abs(r.gx - startX) + Math.abs(r.gy - startY);
        if (d > maxDist) { maxDist = d; furthest = r; }
    }
    if (furthest.type !== 'start') furthest.type = 'boss';
    else if (rooms.length > 1) rooms[rooms.length - 1].type = 'boss';
    // Guarantee at least one chest room and one shop room per floor
    const hasChest = rooms.some(r => r.type === 'chest');
    const hasShop = rooms.some(r => r.type === 'shop');
    const mutable = rooms.filter(r => r.type !== 'start' && r.type !== 'boss');
    if (!hasChest && mutable.length > 0) {
        const pick = randItem(mutable);
        pick.type = 'chest';
        // Remove from mutable so shop doesn't pick the same room
        const idx = mutable.indexOf(pick);
        if (idx >= 0) mutable.splice(idx, 1);
    }
    if (!hasShop && mutable.length > 0) {
        randItem(mutable).type = 'shop';
    }
    for (const r of rooms) { r.walls = []; r.generateWalls(); r.generateDecorations(); }
    // Pre-compute neighbors
    for (const r of rooms) {
        r.neighbors.top = grid[r.gy - 1] ? grid[r.gy - 1][r.gx] : null;
        r.neighbors.bottom = grid[r.gy + 1] ? grid[r.gy + 1][r.gx] : null;
        r.neighbors.left = grid[r.gy] ? grid[r.gy][r.gx - 1] : null;
        r.neighbors.right = grid[r.gy] ? grid[r.gy][r.gx + 1] : null;
    }
    return { rooms, grid, startRoom: grid[startY][startX] };
}

// ==================== 游戏主类 ====================
class Game {
    constructor() {
        this.state = 'loading';
        this.camera = { x: 0, y: 0 };
        this.zoom = 1;
        this.shake = 0;
        this.shakeIntensity = 0;

        // Object pools
        this.bulletPool = new ObjectPool(() => new Bullet(0, 0, 0, 0, 0, 0, false), (b) => { b.active = false; }, 60);
        this.particlePool = new ObjectPool(() => new Particle(0, 0, '#000', 0, 0, 0), (p) => { p.life = 0; }, 100);
        this.floatTextPool = new ObjectPool(() => new FloatingText(0, 0, '', '#fff'), (ft) => { ft.life = 0; }, 20);

        this.particles = new ParticleSystem(this.particlePool);
        this.floatTexts = [];
        this.meleeHits = [];
        this.nearChest = null;
        this.nearPortal = null;

        this.floor = 1;
        this.rooms = [];
        this.currentRoom = null;
        this.player = null;
        this.kills = 0;
        this.coins = 0;
        this.gemsThisRun = 0;
        this.transition = 0;
        this.transitionTarget = null;

        this._floorAdvanceTimer = 0;
        this._cloudSaveTimer = 0;
    }

    // ==================== 单局中途存档（断点续玩）====================

    /** 保存单局实时进度到后端（暂停、切房间、或定时自动保存时调用） */
    async saveRunState() {
        // 只有登录状态且正在游戏中才保存
        if (!api.isLoggedIn || this.state !== 'playing') return;
        try {
            // 将当前所有房间状态序列化为可传输的JSON对象
            const rooms = serializeRooms(this.rooms);
            const curIdx = this.rooms.indexOf(this.currentRoom);
            // 当前房间需要额外保存敌人、宝箱等实时状态
            rooms[curIdx] = { ...rooms[curIdx], ...serializeRoomState(this.currentRoom) };
            // 调用后端 /api/save/run/save 写入 H2 数据库
            await api.saveRunSave({
                hasRun: true,
                floorNum: this.floor,                        // 当前层数
                kills: this.kills,                           // 本局击杀数
                coins: this.coins,                           // 当前金币
                gemsThisRun: this.gemsThisRun,               // 本局获得宝石
                playerJson: JSON.stringify(serializePlayer(this.player)), // 玩家状态JSON
                roomsJson: JSON.stringify(rooms),            // 房间地图JSON
                currentRoomIndex: curIdx                     // 当前所在房间索引
            });
        } catch(e) { console.warn('Run save failed:', e); }
    }

    /** 从后端加载单局中途存档，恢复游戏现场（断点续玩）
     * @returns {boolean} true=成功恢复，false=没有存档或恢复失败
     */
    async loadRunState() {
        if (!api.isLoggedIn) return false;           // 未登录无法读取云端单局存档
        try {
            // 1. 从后端 H2 数据库读取单局存档
            const data = await api.loadRunSave();    // 调用 /api/save/run/load
            if (!data.hasRun) return false;          // 没有进行中的单局

            // 2. 恢复单局基础数据
            this.floor = data.floorNum ?? 1;
            this.kills = data.kills ?? 0;
            this.coins = data.coins ?? 0;
            this.gemsThisRun = data.gemsThisRun ?? 0;

            // 3. 重建房间地图（从 JSON 反序列化）
            const roomsData = JSON.parse(data.roomsJson || '[]');
            this.rooms = [];
            const grid = Array(5).fill().map(() => Array(5).fill(null));
            for (const rd of roomsData) {
                const r = new Room(rd.gx, rd.gy, rd.type);
                r.visited = rd.visited;                // 是否已探索
                r.cleared = rd.cleared;                // 是否已清空敌人
                r.doors = rd.doors;                    // 门的状态
                this.rooms.push(r);
                grid[rd.gy][rd.gx] = r;
            }
            // 重建房间之间的邻居关系（上下左右）
            for (const r of this.rooms) {
                r.neighbors.top = grid[r.gy - 1] ? grid[r.gy - 1][r.gx] : null;
                r.neighbors.bottom = grid[r.gy + 1] ? grid[r.gy + 1][r.gx] : null;
                r.neighbors.left = grid[r.gy] ? grid[r.gy][r.gx - 1] : null;
                r.neighbors.right = grid[r.gy] ? grid[r.gy][r.gx + 1] : null;
                r.walls = [];
                r.generateWalls();
                r.generateDecorations();
                if (r.type === 'chest') r.spawnChests();
            }
            // 设置当前所在房间
            this.currentRoom = this.rooms[data.currentRoomIndex ?? 0];

            // 4. 恢复玩家状态（位置、血量、武器、天赋等）
            const playerData = JSON.parse(data.playerJson || '{}');
            const px = this.currentRoom.x + this.currentRoom.w / 2;
            const py = this.currentRoom.y + this.currentRoom.h / 2;
            this.player = deserializePlayer(playerData, px, py);

            // 5. 恢复当前房间的实时细节状态（敌人、掉落物、宝箱）
            const allRoomsData = JSON.parse(data.roomsJson || '[]');
            const curRoomData = allRoomsData.find(r => r.gx === this.currentRoom.gx && r.gy === this.currentRoom.gy);
            if (curRoomData) {
                this.currentRoom.cleared = curRoomData.cleared;
                this.currentRoom.visited = curRoomData.visited;
                // 如果房间已清空，重新生成开门状态和装饰
                if (this.currentRoom.cleared) {
                    this.currentRoom.doorsOpen = true;
                    this.currentRoom.walls = [];
                    this.currentRoom.generateWalls();
                    this.currentRoom.generateDecorations();
                }
                // 如果是 BOSS 房且已击败，恢复传送门
                if (curRoomData.portalActive && this.currentRoom.type === 'boss') {
                    this.currentRoom.portal = new Portal(this.currentRoom.x + this.currentRoom.w / 2, this.currentRoom.y + this.currentRoom.h / 2);
                }
                // 恢复敌人（仅当房间未清空时）
                if (curRoomData.enemies && !this.currentRoom.cleared) {
                    this.currentRoom.enemies = curRoomData.enemies.map(e => {
                        let enemy;
                        if (e.type === 'slime') enemy = new SlimeEnemy(e.x, e.y);
                        else if (e.type === 'skeleton') enemy = new SkeletonEnemy(e.x, e.y);
                        else if (e.type === 'mushroom') enemy = new MushroomEnemy(e.x, e.y);
                        else if (e.type === 'wizard') enemy = new WizardEnemy(e.x, e.y);
                        else if (e.type === 'elite_slime') enemy = new EliteSlimeEnemy(e.x, e.y);
                        else if (e.type === 'skeleton_archer') enemy = new SkeletonArcherEnemy(e.x, e.y);
                        else if (e.type === 'enraged_mushroom') enemy = new EnragedMushroomEnemy(e.x, e.y);
                        else enemy = new SlimeEnemy(e.x, e.y);
                        enemy.hp = e.hp;
                        enemy.maxHp = e.maxHp;
                        return enemy;
                    });
                }
                // 恢复地面掉落物
                if (curRoomData.drops) {
                    this.currentRoom.drops = curRoomData.drops.map(d => {
                        const drop = new Drop(d.x, d.y, d.type, d.value);
                        if (d.type === 'weapon' && typeof d.value === 'object') {
                            drop.value = new Weapon(d.value.name, d.value.category, d.value.baseDamage, d.value.energyCost, d.value.fireRate, d.value.projectileSpeed, d.value.projectileCount, d.value.spread, d.value.color, d.value.tier);
                        }
                        return drop;
                    });
                }
                // 恢复宝箱状态
                if (curRoomData.chests) {
                    this.currentRoom.chests = curRoomData.chests.map(c => {
                        const chest = new Chest(c.x, c.y, c.quality);
                        chest.opened = c.opened;       // 是否已被打开
                        return chest;
                    });
                }
            }

            // 6. 重置临时状态
            this.floatTexts = [];
            this.meleeHits = [];
            this.particles = new ParticleSystem(this.particlePool);
            this.nearChest = null;
            this.nearPortal = null;
            return true;                               // 恢复成功
        } catch(e) {
            console.warn('Run load failed:', e);
            return false;
        }
    }

    async deleteRunState() {
        if (!api.isLoggedIn) return;
        try { await api.deleteRunSave(); } catch(e) {}
    }
    
    async checkBackend() {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 2000);
            await fetch('/api/auth/login', { method: 'GET', signal: ctrl.signal });
            clearTimeout(timer);
            return true;
        } catch (e) {
            return false;
        }
    }

    init() {
        try {
            assetLoader.loadAll().then(async () => {
                try {
                    UI.loadingText.textContent = '检测服务状态...';
                    const backendOk = await this.checkBackend();
                    if (!backendOk) {
                        UI.backendStatus.innerHTML = '<span style="color:#ff9800;">⚠ 后端服务未启动，存档功能不可用</span><br><span style="font-size:12px;color:#888;">请运行 start-game.bat 启动游戏</span>';
                        await new Promise(r => setTimeout(r, 1500));
                    } else {
                        UI.backendStatus.textContent = '';
                    }
                    UI.loading.classList.add('hidden');
                    this.showMenu();
                    
                    document.getElementById('btn-start').addEventListener('click', () => this.enterHall());
                    document.getElementById('btn-help').addEventListener('click', () => alert('WASD/方向键移动\n鼠标瞄准\n左键射击\n右键翻滚(无敌位移)\nF互动(开宝箱)\nQ切换武器\nESC暂停'));
                    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
                    document.getElementById('btn-restart').addEventListener('click', () => { this.setPause(false); this.startGame(); });
                    document.getElementById('btn-quit').addEventListener('click', () => { this.setPause(false); this.enterHall(); });
                    document.getElementById('btn-go-restart').addEventListener('click', () => this.startGame());
                    document.getElementById('btn-go-menu').addEventListener('click', () => this.showMenu());
                    document.getElementById('btn-enter-dungeon').addEventListener('click', () => this.startGame());
                    document.getElementById('btn-hall-menu').addEventListener('click', () => this.showMenu());
                    let resetConfirmTimer = null;
                    const resetBtn = document.getElementById('btn-reset-save');
                    resetBtn.addEventListener('click', () => {
                        if (resetBtn.dataset.confirming === 'true') {
                            clearTimeout(resetConfirmTimer);
                            resetBtn.dataset.confirming = 'false';
                            resetBtn.textContent = '重置存档';
                            resetBtn.style.borderColor = '#f44336';
                            resetBtn.style.color = '#f44336';
                            resetBtn.style.background = '';
                            localStorage.removeItem(SAVE_KEY);
                            globalSave = { gems: 0, upgrades: { maxHp: 0, maxShield: 0, maxEnergy: 0, cooldownReduct: 0, chestQuality: 0 }, stats: { totalRuns: 0, totalKills: 0, bestFloor: 0 } };
                            UI.hallGems.textContent = '💎 宝石: 0';
                            this.renderHallUpgrades();
                        } else {
                            resetBtn.dataset.confirming = 'true';
                            resetBtn.textContent = '⚠ 再次点击确认重置';
                            resetBtn.style.borderColor = '#ff5252';
                            resetBtn.style.color = '#fff';
                            resetBtn.style.background = '#d32f2f';
                            resetConfirmTimer = setTimeout(() => {
                                resetBtn.dataset.confirming = 'false';
                                resetBtn.textContent = '重置存档';
                                resetBtn.style.borderColor = '#f44336';
                                resetBtn.style.color = '#f44336';
                                resetBtn.style.background = '';
                            }, 3000);
                        }
                    });
                    document.getElementById('btn-settle-hall').addEventListener('click', () => this.enterHall());
                    document.getElementById('btn-settle-again').addEventListener('click', () => this.startGame());
                    document.getElementById('btn-weapon-cancel').addEventListener('click', () => {
                        UI.weaponSelect.style.display = 'none';
                        this.state = 'playing';
                    });
                    document.getElementById('btn-shop-leave').addEventListener('click', () => this.hideShop());

                    // Auth panel events
                    const authPanel = UI.authPanel;
                    const authTitle = UI.authTitle;
                    const authUsername = UI.authUsername;
                    const authPassword = UI.authPassword;
                    const authPassword2 = UI.authPassword2;
                    const authError = UI.authError;
                    let isRegisterMode = false;

                    const updateAuthUI = () => {
                        if (api.isLoggedIn) {
                            authPanel.style.display = 'none';
                            UI.userInfo.style.display = 'block';
                            UI.userName.textContent = `👤 ${api.username}`;
                        } else {
                            authPanel.style.display = 'flex';
                            UI.userInfo.style.display = 'none';
                        }
                    };

                    document.getElementById('btn-auth-submit').addEventListener('click', async () => {
                        authError.textContent = '';
                        const u = authUsername.value.trim();
                        const p = authPassword.value;
                        if (!u || !p) { authError.textContent = '请填写用户名和密码'; return; }
                        if (isRegisterMode) {
                            const p2 = authPassword2.value;
                            if (p !== p2) { authError.textContent = '两次密码不一致'; return; }
                            try {
                                await api.register(u, p);
                                await loadSave();
                                updateAuthUI();
                            } catch(e) { authError.textContent = e.message || '注册失败'; }
                        } else {
                            try {
                                await api.login(u, p);
                                await loadSave();
                                updateAuthUI();
                            } catch(e) { authError.textContent = e.message || '登录失败'; }
                        }
                    });

                    document.getElementById('btn-auth-switch').addEventListener('click', () => {
                        isRegisterMode = !isRegisterMode;
                        authTitle.textContent = isRegisterMode ? '注册' : '登录';
                        document.getElementById('btn-auth-submit').textContent = isRegisterMode ? '注册' : '登录';
                        document.getElementById('btn-auth-switch').textContent = isRegisterMode ? '已有账号？点击登录' : '还没有账号？点击注册';
                        authPassword2.style.display = isRegisterMode ? 'block' : 'none';
                        authError.textContent = '';
                    });

                    document.getElementById('btn-auth-guest').addEventListener('click', () => {
                        authPanel.style.display = 'none';
                    });

                    document.getElementById('btn-logout').addEventListener('click', () => {
                        api.logout();
                        updateAuthUI();
                    });

                    updateAuthUI();
                    
                    this.renderHallUpgrades();
                    requestAnimationFrame((t) => this.loop(t));
                } catch(err) {
                    console.error('Init error:', err);
                    alert('游戏初始化出错: ' + err.message);
                }
            });
        } catch(err) {
            console.error('Load error:', err);
            alert('游戏加载出错: ' + err.message);
        }
    }
    
    showMenu() {
        this.state = 'menu';
        UI.mainMenu.classList.remove('hidden');
        UI.hall.style.display = 'none';
        UI.pauseMenu.style.display = 'none';
        UI.settlement.style.display = 'none';
        UI.shopMenu.style.display = 'none';
        UI.gameOver.classList.add('hidden');
    }
    
    async enterHall() {
        this.state = 'hall';
        UI.mainMenu.classList.add('hidden');
        UI.hall.style.display = 'flex';
        UI.pauseMenu.style.display = 'none';
        UI.settlement.style.display = 'none';
        UI.shopMenu.style.display = 'none';
        UI.gameOver.classList.add('hidden');
        // Sync from cloud when entering hall
        if (api.isLoggedIn) {
            try {
                const cloud = await api.loadSave();
                globalSave.gems = cloud.gems ?? globalSave.gems;
                if (cloud.upgradesJson) {
                    const up = JSON.parse(cloud.upgradesJson);
                    globalSave.upgrades = { ...globalSave.upgrades, ...up };
                }
                if (cloud.statsJson) {
                    const st = JSON.parse(cloud.statsJson);
                    globalSave.stats = { ...globalSave.stats, ...st };
                }
                localStorage.setItem(SAVE_KEY, JSON.stringify(globalSave));
            } catch(e) {}
        }
        UI.hallGems.textContent = `💎 宝石: ${globalSave.gems}`;
        this.renderHallUpgrades();
    }
    
    renderHallUpgrades() {
        const container = UI.hallUpgrades;
        container.innerHTML = '';
        const defs = [
            { key: 'maxHp', name: '生命上限', desc: '所有角色初始HP+1', max: 5, cost: (lv) => 500 + lv * 300 },
            { key: 'maxShield', name: '护甲上限', desc: '所有角色初始护甲+1', max: 5, cost: (lv) => 500 + lv * 300 },
            { key: 'maxEnergy', name: '能量上限', desc: '所有角色初始能量+20', max: 5, cost: (lv) => 400 + lv * 250 },
            { key: 'cooldownReduct', name: '翻滚冷却', desc: '翻滚CD每级-12%，满级仅1秒', max: 5, cost: (lv) => 600 + lv * 350 },
            { key: 'chestQuality', name: '宝箱品质', desc: '宝箱出高品质概率+5%', max: 5, cost: (lv) => 800 + lv * 400 },
        ];
        for (const def of defs) {
            const lv = globalSave.upgrades[def.key];
            const cost = def.cost(lv);
            const card = document.createElement('div');
            card.className = 'upgrade-card' + (lv >= def.max ? ' maxed' : '');
            card.innerHTML = `
                <h4>${def.name}</h4>
                <p>${def.desc}</p>
                <div class="cost">${lv >= def.max ? '已满级' : `💎 ${cost}`}</div>
                <div class="level">等级: ${lv}/${def.max}</div>
            `;
            if (lv < def.max) {
                card.addEventListener('click', async () => {
                    if (globalSave.gems >= cost) {
                        globalSave.gems -= cost;
                        globalSave.upgrades[def.key]++;
                        await saveToDisk();
                        UI.hallGems.textContent = `💎 宝石: ${globalSave.gems}`;
                        this.renderHallUpgrades();
                    } else {
                        alert('宝石不足！');
                    }
                });
            }
            container.appendChild(card);
        }
    }
    
    async startGame() {
        UI.mainMenu.classList.add('hidden');
        UI.hall.style.display = 'none';
        UI.settlement.style.display = 'none';
        UI.shopMenu.style.display = 'none';
        UI.gameOver.classList.add('hidden');

        // Try to resume cloud run
        if (api.isLoggedIn) {
            const hasRun = await this.loadRunState();
            if (hasRun) {
                this.state = 'playing';
                this.addFloatText(this.player.x, this.player.y - 40, '已恢复云端存档', '#4caf50');
                globalSave.stats.totalRuns++;
                await saveToDisk();
                return;
            }
        }

        this.floor = 1;
        this.kills = 0;
        this.coins = 0;
        this.gemsThisRun = 0;
        this.loadFloor();
        this.state = 'playing';
        globalSave.stats.totalRuns++;
        await saveToDisk();
    }
    
    loadFloor() {
        const dungeon = generateDungeon(this.floor);
        this.rooms = dungeon.rooms;
        this.currentRoom = dungeon.startRoom;

        // Preserve player weapons, talents, and level across floors
        const oldPlayer = this.player;
        this.player = new Player(this.currentRoom.x + this.currentRoom.w / 2, this.currentRoom.y + this.currentRoom.h / 2);
        if (oldPlayer) {
            this.player.weapons = oldPlayer.weapons;
            this.player.weaponIndex = oldPlayer.weaponIndex;
            this.player.acquiredTalents = oldPlayer.acquiredTalents;
            this.player.level = oldPlayer.level;
            this.player.exp = oldPlayer.exp;
            this.player.expToNext = oldPlayer.expToNext;
            // Re-apply all talent effects
            for (const tid of oldPlayer.acquiredTalents) {
                const talent = TALENTS.find(t => t.id === tid);
                if (talent) talent.effect(this.player);
            }
        }

        this.currentRoom.visited = true;
        this.currentRoom.doorsOpen = true;
        for (const r of this.rooms) {
            if (r.type === 'chest') r.spawnChests();
        }
        this.floatTexts = [];
        this.meleeHits = [];
        this.particles = new ParticleSystem(this.particlePool);
        this.nearChest = null;
        this.nearPortal = null;
    }
    
    onEscape() {
        if (this.state === 'shop') { this.hideShop(); return; }
        if (this.state === 'playing') this.togglePause();
        else if (this.state === 'paused') this.togglePause();
    }
    
    onInteract() {
        if (this.state !== 'playing') return;
        if (this.currentRoom && this.currentRoom.type === 'shop') {
            this.showShop();
            return;
        }
        if (this.nearChest && this.nearChest.canInteract(this.player)) {
            this.nearChest.open(this.currentRoom);
            this.nearChest = null;
            UI.interactHint.style.display = 'none';
            return;
        }
        if (this.nearPortal && this.nearPortal.canInteract(this.player)) {
            this.nearPortal = null;
            UI.interactHint.style.display = 'none';
            this.floor++;
            if (this.floor > 3) {
                this.showSettlement(true);
            } else {
                this.addFloatText(this.player.x, this.player.y - 40, `进入第 ${this.floor} 层！`, '#4caf50');
                this.loadFloor();
            }
        }
    }
    
    showShop() {
        this.state = 'shop';
        UI.shopMenu.style.display = 'flex';
        UI.shopOptions.innerHTML = '';
        const p = this.player;
        const shopItems = [
            { name: '回复生命', desc: '恢复2点HP', price: 30, icon: '❤️', action: () => { p.hp = Math.min(p.maxHp, p.hp + 2); } },
            { name: '修复护甲', desc: '护甲完全恢复', price: 20, icon: '🛡️', action: () => { p.shield = p.maxShield; } },
            { name: '充能水晶', desc: '能量完全恢复', price: 25, icon: '⚡', action: () => { p.energy = p.maxEnergy; } },
            { name: '随机武器', desc: '获得一把随机武器', price: 50, icon: '🗡️', action: () => {
                const w = randomWeaponByFloor(game.floor);
                const old = p.weapons[p.weaponIndex];
                p.weapons[p.weaponIndex] = w;
                game.addFloatText(p.x, p.y - 30, `获得 ${w.fullName} (替换 ${old.fullName})`, '#4caf50');
            }},
        ];
        for (const item of shopItems) {
            const card = document.createElement('div');
            card.className = 'shop-card' + (item.sold ? ' sold' : '');
            card.innerHTML = `<h4>${item.icon} ${item.name}</h4><p>${item.desc}</p><div class="price">💰 ${item.price}</div>`;
            if (!item.sold) {
                card.addEventListener('click', () => {
                    if (game.coins >= item.price) {
                        game.coins -= item.price;
                        item.action();
                        game.addFloatText(p.x, p.y - 30, `购买 ${item.name}`, '#ffd700');
                        card.classList.add('sold');
                    } else {
                        game.addFloatText(p.x, p.y - 30, '金币不足!', '#f44336');
                    }
                });
            }
            UI.shopOptions.appendChild(card);
        }
    }

    hideShop() {
        UI.shopMenu.style.display = 'none';
        this.state = 'playing';
    }

    togglePause() {
        if (this.state === 'playing') { this.state = 'paused'; UI.pauseMenu.style.display = 'flex'; }
        else if (this.state === 'paused') { this.setPause(false); }
    }
    
    setPause(v) {
        this.state = v ? 'paused' : 'playing';
        UI.pauseMenu.style.display = v ? 'flex' : 'none';
    }
    
    onPlayerLevelUp() {
        this.state = 'talent';
        UI.talentSelect.style.display = 'flex';
        UI.talentLevelText.textContent = `等级 ${this.player.level} - 选择一项天赋`;
        const options = [];
        const pool = TALENTS.filter(t => !this.player.acquiredTalents.has(t.id));
        if (pool.length === 0) {
            UI.talentSelect.style.display = 'none';
            this.state = 'playing';
            return;
        }
        const count = Math.min(3, pool.length);
        for (let i = 0; i < count; i++) {
            const idx = randInt(0, pool.length - 1);
            options.push(pool.splice(idx, 1)[0]);
        }
        UI.talentOptions.innerHTML = '';
        for (const t of options) {
            const card = document.createElement('div');
            card.className = 'talent-card';
            card.innerHTML = `<h4>${t.name}</h4><p>${t.desc}</p><div class="tier">${t.tier}</div>`;
            card.addEventListener('click', () => {
                t.effect(this.player);
                this.player.acquiredTalents.add(t.id);
                UI.talentSelect.style.display = 'none';
                this.state = 'playing';
                game.addFloatText(this.player.x, this.player.y - 40, `获得天赋: ${t.name}`, '#e040fb');
            });
            UI.talentOptions.appendChild(card);
        }
    }
    
    showWeaponSelect(currentWeapons, newWeapon, dropPos) {
        this.state = 'weapon_select';
        UI.weaponSelect.style.display = 'flex';
        UI.weaponOptions.innerHTML = '';
        
        const createCard = (weapon, index, isNew) => {
            const card = document.createElement('div');
            card.className = 'weapon-card' + (isNew ? '' : ' drop');
            const typeLabel = weapon.category === 'gun' ? '枪械' : weapon.category === 'melee' ? '近战' : weapon.category === 'staff' ? '法杖' : '武器';
            card.innerHTML = `
                <h4>${isNew ? '🆕 ' : ''}${weapon.fullName}</h4>
                <p>伤害: ${weapon.damage}</p>
                <p>能耗: ${weapon.energyCost}</p>
                <p>攻速: ${(1 / weapon.fireRate).toFixed(1)}/秒</p>
                <div class="tag">${typeLabel}${isNew ? ' - 点击装备' : ' - 点击丢弃并装备新武器'}</div>
            `;
            card.addEventListener('click', () => {
                UI.weaponSelect.style.display = 'none';
                this.state = 'playing';
                if (isNew) {
                    // Replace current weapon with new one
                    const dropped = currentWeapons[this.player.weaponIndex];
                    currentWeapons[this.player.weaponIndex] = newWeapon;
                    if (dropped) {
                        this.currentRoom.drops.push(new Drop(dropPos.x, dropPos.y, 'weapon', dropped));
                        this.addFloatText(dropPos.x, dropPos.y, `丢弃 ${dropped.name}`, '#f44336');
                    }
                    this.addFloatText(this.player.x, this.player.y - 30, `装备 ${newWeapon.name}`, '#4caf50');
                } else {
                    // Replace the selected old weapon
                    const dropped = currentWeapons[index];
                    currentWeapons[index] = newWeapon;
                    this.player.weaponIndex = index;
                    if (dropped) {
                        this.currentRoom.drops.push(new Drop(dropPos.x, dropPos.y, 'weapon', dropped));
                        this.addFloatText(dropPos.x, dropPos.y, `丢弃 ${dropped.name}`, '#f44336');
                    }
                    this.addFloatText(this.player.x, this.player.y - 30, `装备 ${newWeapon.name}`, '#4caf50');
                }
            });
            return card;
        };
        
        // Show current weapons
        for (let i = 0; i < currentWeapons.length; i++) {
            UI.weaponOptions.appendChild(createCard(currentWeapons[i], i, false));
        }
        // Show new weapon
        UI.weaponOptions.appendChild(createCard(newWeapon, -1, true));
    }
    
    async showSettlement(win) {
        this.state = 'settlement';
        UI.settlement.style.display = 'flex';
        UI.settleTitle.textContent = win ? '通关成功！' : '游戏结束';
        UI.settleTitle.className = win ? 'win' : 'lose';
        UI.settleKills.textContent = `击杀: ${this.kills}`;
        UI.settleFloor.textContent = `到达层数: ${this.floor}`;
        
        const baseGems = this.kills * 2 + this.floor * 10 + (win ? 50 : 0);
        const bonus = Math.floor(this.gemsThisRun);
        const total = baseGems + bonus;
        globalSave.gems += total;
        globalSave.stats.totalKills += this.kills;
        if (this.floor > globalSave.stats.bestFloor) globalSave.stats.bestFloor = this.floor;
        await saveToDisk();
        await this.deleteRunState();
        UI.settleGems.textContent = `获得宝石: ${total} (本局${bonus} + 基础${baseGems})`;
    }
    
    addFloatText(x, y, text, color) {
        const ft = this.floatTextPool.acquire();
        ft.init(x, y, text, color);
        this.floatTexts.push(ft);
    }
    
    update(dt) {
        if (this.state === 'talent' || this.state === 'shop') return;
        if (this.state !== 'playing') return;
        if (!this.currentRoom || !this.player) return;

        if (this.transition > 0) {
            this.transition -= dt;
            if (this.transition <= 0 && this.transitionTarget) {
                this.currentRoom = this.transitionTarget;
                this.transitionTarget = null;
                const r = this.currentRoom;
                this.player.x = clamp(this.player.x, r.x + 30, r.x + r.w - 30);
                this.player.y = clamp(this.player.y, r.y + 30, r.y + r.h - 30);
                this.camera.x = this.player.x;
                this.camera.y = this.player.y;
            }
            return;
        }
        
        const room = this.currentRoom;
        this.nearChest = null;
        this.nearPortal = null;
        UI.interactHint.style.display = 'none';
        
        const p = this.player;
        const nextRoom = this.checkDoorTransition(p, room);
        if (nextRoom) {
            this.transition = 0.3;
            this.transitionTarget = nextRoom;
            return;
        }
        
        room.checkCombat(p);
        p.update(dt, room);
        room.update(dt, p);
        this.particles.update(dt);
        
        for (let i = this.floatTexts.length - 1; i >= 0; i--) {
            this.floatTexts[i].update(dt);
            if (this.floatTexts[i].life <= 0) {
                this.floatTextPool.release(this.floatTexts[i]);
                this.floatTexts[i] = this.floatTexts[this.floatTexts.length - 1];
                this.floatTexts.pop();
            }
        }
        
        const targetCamX = p.x;
        const targetCamY = p.y;
        this.zoom = Math.min(screenW / 720, screenH / 480) * 0.9;
        this.camera.x = lerp(this.camera.x, targetCamX, 8 * dt);
        this.camera.y = lerp(this.camera.y, targetCamY, 8 * dt);
        const halfVW = screenW / (2 * this.zoom);
        const halfVH = screenH / (2 * this.zoom);
        const minCX = room.x - 40 + halfVW;
        const maxCX = room.x + room.w + 40 - halfVW;
        const minCY = room.y - 40 + halfVH;
        const maxCY = room.y + room.h + 40 - halfVH;
        if (minCX < maxCX) {
            this.camera.x = clamp(this.camera.x, minCX, maxCX);
        } else {
            this.camera.x = room.x + room.w / 2;
        }
        if (minCY < maxCY) {
            this.camera.y = clamp(this.camera.y, minCY, maxCY);
        } else {
            this.camera.y = room.y + room.h / 2;
        }
        
        if (this.shake > 0) { this.shake -= dt; this.shakeIntensity = this.shake * 10; }
        
        if (p.dead && p.anims.death.done) {
            this.showSettlement(false);
        }
        
        // Boss room portal is handled by onInteract now

        // Auto cloud save every 15 seconds
        this._cloudSaveTimer += dt;
        if (this._cloudSaveTimer >= 15) {
            this._cloudSaveTimer = 0;
            this.saveRunState();
        }
    }
    
    checkDoorTransition(p, room) {
        const threshold = 20;
        const halfW = room.x + room.w / 2;
        const halfH = room.y + room.h / 2;
        if (room.doors.top && room.neighbors.top) {
            if (p.y < room.y + threshold && Math.abs(p.x - halfW) < 50) { p.y = room.neighbors.top.y + room.neighbors.top.h - 40; return room.neighbors.top; }
        }
        if (room.doors.bottom && room.neighbors.bottom) {
            if (p.y > room.y + room.h - threshold && Math.abs(p.x - halfW) < 50) { p.y = room.neighbors.bottom.y + 40; return room.neighbors.bottom; }
        }
        if (room.doors.left && room.neighbors.left) {
            if (p.x < room.x + threshold && Math.abs(p.y - halfH) < 50) { p.x = room.neighbors.left.x + room.neighbors.left.w - 40; return room.neighbors.left; }
        }
        if (room.doors.right && room.neighbors.right) {
            if (p.x > room.x + room.w - threshold && Math.abs(p.y - halfH) < 50) { p.x = room.neighbors.right.x + 40; return room.neighbors.right; }
        }
        return null;
    }
    
    draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, screenW, screenH);
        if (this.state === 'menu' || this.state === 'hall') return;

        ctx.save();
        let sx = 0, sy = 0;
        if (this.shake > 0) {
            sx = (Math.random() - 0.5) * this.shakeIntensity;
            sy = (Math.random() - 0.5) * this.shakeIntensity;
        }
        ctx.translate(screenW / 2, screenH / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.camera.x + sx, -this.camera.y + sy);
        
        if (this.currentRoom) {
            this.currentRoom.draw(ctx);
            // Boss room pulsing red border
            if (this.currentRoom.type === 'boss') {
                const now = Date.now() / 1000;
                const pulse = 0.4 + Math.sin(now * 2.5) * 0.3;
                ctx.strokeStyle = `rgba(244,67,54,${pulse})`;
                ctx.lineWidth = 4 + Math.sin(now * 2.5) * 2;
                ctx.strokeRect(this.currentRoom.x + 2, this.currentRoom.y + 2, this.currentRoom.w - 4, this.currentRoom.h - 4);
            }
            this.currentRoom.drawEntities(ctx);
        }
        if (this.player) this.player.draw(ctx);
        this.particles.draw(ctx);
        for (const ft of this.floatTexts) ft.draw(ctx);
        ctx.restore();
        
        if (this.state === 'playing' || this.state === 'paused' || this.state === 'talent') {
            this.drawHUD();
        }
        
        if (this.transition > 0) {
            ctx.fillStyle = `rgba(0,0,0,${this.transition / 0.3})`;
            ctx.fillRect(0, 0, screenW, screenH);
        }
    }
    
    drawHUD() {
        if (!this.player) return;
        const p = this.player;
        const isMobile = touchInput && touchInput.isTouchDevice;
        const hudScale = isMobile ? Math.min(screenW / 960, screenH / 640) : 1;
        const pad = 15 * hudScale;
        
        // HP
        const barW = 150 * hudScale;
        const barH = 14 * hudScale;
        ctx.fillStyle = '#333'; ctx.fillRect(pad, pad, barW, barH);
        ctx.fillStyle = '#f44336'; ctx.fillRect(pad, pad, barW * (p.hp / p.maxHp), barH);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(pad, pad, barW, barH);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(`HP ${p.hp}/${p.maxHp}`, pad + 4, pad + 11);
        
        // Shield
        const shieldY = pad + barH + 4;
        ctx.fillStyle = '#333'; ctx.fillRect(pad, shieldY, barW, barH - 2);
        ctx.fillStyle = '#00bcd4'; ctx.fillRect(pad, shieldY, barW * (p.shield / p.maxShield), barH - 2);
        ctx.strokeStyle = '#fff'; ctx.strokeRect(pad, shieldY, barW, barH - 2);
        ctx.fillStyle = '#fff'; ctx.fillText(`护甲 ${Math.floor(p.shield)}/${p.maxShield}`, pad + 4, shieldY + 10);
        
        // Energy
        const energyY = shieldY + barH + 2;
        ctx.fillStyle = '#333'; ctx.fillRect(pad, energyY, barW, barH - 2);
        ctx.fillStyle = '#2196f3'; ctx.fillRect(pad, energyY, barW * (p.energy / p.maxEnergy), barH - 2);
        ctx.strokeStyle = '#fff'; ctx.strokeRect(pad, energyY, barW, barH - 2);
        ctx.fillStyle = '#fff'; ctx.fillText(`能量 ${Math.floor(p.energy)}/${p.maxEnergy}`, pad + 4, energyY + 10);
        
        // Exp bar (below energy)
        const expY = energyY + barH + 2;
        ctx.fillStyle = '#333'; ctx.fillRect(pad, expY, barW, 6);
        ctx.fillStyle = '#9c27b0'; ctx.fillRect(pad, expY, barW * (p.exp / p.expToNext), 6);
        ctx.fillStyle = '#aaa'; ctx.font = '10px sans-serif';
        ctx.fillText(`Lv.${p.level}  ${p.exp}/${p.expToNext}`, pad, expY + 14);
        
        // Coins & Floor
        ctx.fillStyle = '#ffd700'; ctx.font = '16px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(`💰 ${this.coins}`, screenW - pad, pad + 14);
        ctx.fillStyle = '#e040fb'; ctx.fillText(`💎 ${this.gemsThisRun}`, screenW - pad, pad + 34);
        ctx.fillStyle = '#aaa'; ctx.fillText(`层数: ${this.floor}`, screenW - pad, pad + 54);
        ctx.fillText(`击杀: ${this.kills}`, screenW - pad, pad + 74);
        
        // Weapon
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '13px sans-serif';
        const w = p.currentWeapon;
        ctx.fillText(`[${p.weaponIndex + 1}/${p.weapons.length}] ${w.fullName}`, pad, screenH - pad - 20 * hudScale);
        ctx.fillStyle = w.category === 'melee' ? '#aaa' : p.energy >= w.energyCost ? '#8bc34a' : '#f44336';
        ctx.fillText(w.category === 'melee' ? '近战' : `能耗 ${w.energyCost}`, pad, screenH - pad - 4 * hudScale);
        
        // Skill cooldown
        const cdRatio = Math.max(0, p.rollCooldown / (2.5 * p.rollCdMult));
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        const rollRX = screenW - 70 * hudScale; const rollRY = screenH - 70 * hudScale; ctx.fillRect(rollRX, rollRY, 55 * hudScale, 55 * hudScale);
        ctx.fillStyle = cdRatio > 0 ? '#555' : '#e94560';
        ctx.fillRect(rollRX + 2 * hudScale, rollRY + 2 * hudScale, 51 * hudScale, 51 * hudScale);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('翻滚', rollRX + 26 * hudScale, rollRY + 28 * hudScale);
        if (cdRatio > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(rollRX + 2 * hudScale, rollRY + 2 * hudScale, 51 * hudScale, 51 * hudScale * cdRatio);
            ctx.fillStyle = '#fff';
            ctx.fillText(Math.ceil(p.rollCooldown) + 's', rollRX + 26 * hudScale, rollRY + 20 * hudScale);
        }
        
        // Boss proximity warning
        const bossRoom = this.rooms.find(r => r.type === 'boss');
        if (bossRoom && this.currentRoom && bossRoom !== this.currentRoom) {
            const gDist = Math.abs(bossRoom.gx - this.currentRoom.gx) + Math.abs(bossRoom.gy - this.currentRoom.gy);
            if (gDist <= 2) {
                const now = Date.now() / 1000;
                const alpha = 0.5 + Math.sin(now * 3) * 0.3;
                ctx.fillStyle = `rgba(244,67,54,${alpha})`;
                ctx.font = 'bold 13px sans-serif';
                ctx.textAlign = 'center';
                const warnText = gDist <= 1 ? '⚠ BOSS 房间临近！⚠' : 'BOSS 在前方...';
                ctx.fillText(warnText, screenW / 2, screenH - 15 * hudScale);
            }
        }

        this.drawMinimap();
    }
    
    drawMinimap() {
        const ms = 18;
        const mx = screenW - 150;
        const my = 90;
        const now = Date.now() / 1000;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(mx - 6, my - 6, 5 * ms + 12, 5 * ms + 12);

        // Find boss room
        let bossRoom = null;
        for (const r of this.rooms) {
            if (r.type === 'boss') { bossRoom = r; break; }
        }

        for (const r of this.rooms) {
            const rx = mx + r.gx * ms;
            const ry = my + r.gy * ms;

            if (r === this.currentRoom) {
                ctx.fillStyle = '#e94560';
                ctx.fillRect(rx - 1, ry - 1, ms, ms);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(rx - 1, ry - 1, ms, ms);
            } else if (r.visited) {
                ctx.fillStyle = r.cleared ? '#4caf50' : '#ff9800';
                ctx.fillRect(rx, ry, ms - 2, ms - 2);
            } else {
                ctx.fillStyle = '#333';
                ctx.fillRect(rx, ry, ms - 2, ms - 2);
            }

            // Boss room: always highlighted with pulsing glow
            if (r === bossRoom && r !== this.currentRoom) {
                const pulse = 0.4 + Math.sin(now * 3) * 0.3;
                ctx.strokeStyle = `rgba(244,67,54,${pulse})`;
                ctx.lineWidth = 3;
                ctx.strokeRect(rx - 2, ry - 2, ms + 2, ms + 2);
                ctx.fillStyle = r.visited ? (r.cleared ? '#4caf50' : '#ff9800') : `rgba(244,67,54,${0.5 + Math.sin(now * 3) * 0.3})`;
                ctx.fillRect(rx, ry, ms - 2, ms - 2);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('☠', rx + ms / 2 - 1, ry + ms / 2 + 3);
            }

            // Shop room: always show with gold marker
            if (r.type === 'shop' && r !== this.currentRoom) {
                const pulse = 0.35 + Math.sin(now * 2.5) * 0.2;
                ctx.strokeStyle = `rgba(255,215,0,${pulse})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(rx - 1, ry - 1, ms, ms);
                if (!r.visited) {
                    ctx.fillStyle = `rgba(255,215,0,${0.3 + Math.sin(now * 2.5) * 0.15})`;
                    ctx.fillRect(rx, ry, ms - 2, ms - 2);
                }
                ctx.fillStyle = '#000';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('$', rx + ms / 2 - 1, ry + ms / 2 + 3);
            }

            // Chest room: always show with purple marker
            if (r.type === 'chest' && r !== this.currentRoom) {
                const pulse = 0.35 + Math.sin(now * 2.2) * 0.2;
                ctx.strokeStyle = `rgba(224,64,251,${pulse})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(rx - 1, ry - 1, ms, ms);
                if (!r.visited) {
                    ctx.fillStyle = `rgba(224,64,251,${0.25 + Math.sin(now * 2.2) * 0.15})`;
                    ctx.fillRect(rx, ry, ms - 2, ms - 2);
                }
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('📦', rx + ms / 2 - 1, ry + ms / 2 + 3);
            }

            // Doors
            ctx.fillStyle = '#777';
            if (r.doors.top) ctx.fillRect(rx + ms / 2 - 2, ry - 2, 4, 4);
            if (r.doors.bottom) ctx.fillRect(rx + ms / 2 - 2, ry + ms - 4, 4, 4);
            if (r.doors.left) ctx.fillRect(rx - 2, ry + ms / 2 - 2, 4, 4);
            if (r.doors.right) ctx.fillRect(rx + ms - 4, ry + ms / 2 - 2, 4, 4);
        }

        // Boss room label below minimap
        if (bossRoom) {
            ctx.fillStyle = '#f44336';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            const labelText = bossRoom.visited ? (bossRoom.cleared ? 'BOSS 已击败' : 'BOSS 战斗中') : 'BOSS';
            ctx.fillText(labelText, mx + 5 * ms / 2 + 6, my + 5 * ms + 22);
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx - 6, my - 6, 5 * ms + 12, 5 * ms + 12);
    }
    
    loop(timestamp) {
        if (!this._lastTime) this._lastTime = timestamp;
        const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
        this._lastTime = timestamp;
        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

const game = new Game();
window.addEventListener('load', () => game.init());
