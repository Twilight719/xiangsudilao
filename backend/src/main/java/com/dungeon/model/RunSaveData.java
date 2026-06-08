package com.dungeon.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * 单局游戏中途存档实体类
 * 对应数据库表: run_save_data
 * 用于保存玩家在一局地牢探险中的实时进度（暂停/退出后可续玩）
 */
@Entity
@Table(name = "run_save_data")
public class RunSaveData {

    // ==================== 主键 ====================
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // 数据库自增ID
    private Long id;

    // ==================== 关联用户 ====================
    @OneToOne                                      // 一对一关联: 一个用户对应一条单局存档
    @JoinColumn(name = "user_id", unique = true, nullable = false)  // 外键列，唯一且非空
    private User user;

    // ==================== 单局状态字段 ====================
    @Column(name = "has_run", nullable = false)
    private boolean hasRun = false;                // 当前是否有进行中的单局（true=有，false=无）

    @Column(name = "floor_num")
    private int floorNum = 1;                      // 当前所在层数（默认第1层）

    @Column(name = "kills")
    private int kills = 0;                         // 本局累计击杀数

    @Column(name = "coins")
    private int coins = 0;                         // 本局当前持有的金币数

    @Column(name = "gems_this_run")
    private int gemsThisRun = 0;                   // 本局已获得的宝石数

    @Column(name = "player_json", columnDefinition = "TEXT")
    private String playerJson = "{}";              // 玩家状态JSON（血量、武器、天赋等）

    @Column(name = "rooms_json", columnDefinition = "TEXT")
    private String roomsJson = "[]";               // 房间地图JSON（房间布局、敌人、宝箱状态等）

    @Column(name = "current_room_index")
    private int currentRoomIndex = 0;              // 当前所在的房间索引

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();  // 最后更新时间

    // ==================== 构造方法 ====================
    public RunSaveData() {}

    // ==================== Getter / Setter ====================
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public boolean isHasRun() { return hasRun; }
    public void setHasRun(boolean hasRun) { this.hasRun = hasRun; }

    public int getFloorNum() { return floorNum; }
    public void setFloorNum(int floorNum) { this.floorNum = floorNum; }

    public int getKills() { return kills; }
    public void setKills(int kills) { this.kills = kills; }

    public int getCoins() { return coins; }
    public void setCoins(int coins) { this.coins = coins; }

    public int getGemsThisRun() { return gemsThisRun; }
    public void setGemsThisRun(int gemsThisRun) { this.gemsThisRun = gemsThisRun; }

    public String getPlayerJson() { return playerJson; }
    public void setPlayerJson(String playerJson) { this.playerJson = playerJson; }

    public String getRoomsJson() { return roomsJson; }
    public void setRoomsJson(String roomsJson) { this.roomsJson = roomsJson; }

    public int getCurrentRoomIndex() { return currentRoomIndex; }
    public void setCurrentRoomIndex(int currentRoomIndex) { this.currentRoomIndex = currentRoomIndex; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
