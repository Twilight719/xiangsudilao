# 像素地牢 - 账号系统 & H2 后端

## 项目结构

```
像素地牢（测试）/
├── frontend/              # 前端游戏
│   ├── index.html         # 游戏入口（请用浏览器打开此文件）
│   ├── game.js            # 游戏逻辑（含序列化/云同步）
│   ├── api.js             # 后端 API 通信层
│   └── assets/            # 图片资源
├── backend/               # Spring Boot 后端
│   ├── pom.xml
│   └── src/main/java/...  # Java 源码
├── start-backend.bat      # 后端启动脚本
└── README.md              # 本文件
```

## 技术栈

- **前端**: HTML5 Canvas + 原生 JavaScript
- **后端**: Spring Boot 3.x + Java 17 + H2 Database
- **认证**: JWT (JSON Web Token)
- **通信**: RESTful API + Fetch

## 启动方式

### 1. 启动后端

双击运行 `start-backend.bat`，或在命令行执行：

```bash
cd backend
mvn spring-boot:run
# 或直接运行已打包的 jar
java -jar backend/target/dungeon-backend-1.0.0.jar
```

后端服务将启动在 **http://localhost:8080**

- H2 控制台: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:~/dungeon_data/dungeon_db`
  - 用户名: `sa`
  - 密码: (空)

### 2. 启动前端

直接用浏览器打开 `frontend/index.html`

> 注意：由于使用了 CORS，建议通过本地服务器访问前端，例如 VS Code Live Server，或：
> ```bash
> cd frontend
> python -m http.server 3000
> # 然后访问 http://localhost:3000
> ```
> 也可以直接双击打开 HTML 文件（现代浏览器通常允许本地文件的 CORS 请求到 localhost）。

## 功能说明

### 账号系统
- 登录 / 注册面板（进入游戏时显示）
- 游客模式（不登录也可玩，数据仅存本地）
- JWT Token 持久化到 localStorage

### 存档同步
1. **大厅数据同步**（宝石、升级、统计）
   - 进入大厅时自动拉取云端最新数据
   - 购买升级、结算时自动同步到云端

2. **实时对局存档**（完整云存档）
   - 游戏中每 **15 秒**自动保存对局状态到云端
   - 支持跨设备续玩：登录后点击"进入地牢"会自动恢复上次对局
   - 对局结束后（通关/死亡）自动删除云端对局存档

### API 接口

| 接口 | 说明 |
|------|------|
| `POST /api/auth/register` | 注册账号 |
| `POST /api/auth/login` | 登录账号 |
| `GET /api/save/load` | 读取大厅存档 |
| `POST /api/save/save` | 保存大厅存档 |
| `GET /api/save/run/load` | 读取实时对局存档 |
| `POST /api/save/run/save` | 保存实时对局存档 |
| `POST /api/save/run/delete` | 删除实时对局存档 |

## 数据库表

### users
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 用户ID |
| username | VARCHAR(32) | 账号名（唯一） |
| password_hash | VARCHAR(255) | BCrypt 密码哈希 |
| created_at | TIMESTAMP | 注册时间 |

### save_data
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 存档ID |
| user_id | BIGINT FK | 关联用户 |
| gems | INT | 宝石数量 |
| upgrades_json | TEXT | 升级数据（JSON） |
| stats_json | TEXT | 统计数据（JSON） |
| updated_at | TIMESTAMP | 更新时间 |

### run_save_data
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 存档ID |
| user_id | BIGINT FK | 关联用户 |
| has_run | BOOLEAN | 是否有进行中的对局 |
| floor_num | INT | 当前层数 |
| kills | INT | 击杀数 |
| coins | INT | 金币数 |
| gems_this_run | INT | 本局宝石 |
| player_json | TEXT | 玩家状态（JSON） |
| rooms_json | TEXT | 地牢地图（JSON） |
| current_room_index | INT | 当前房间索引 |
| updated_at | TIMESTAMP | 更新时间 |
