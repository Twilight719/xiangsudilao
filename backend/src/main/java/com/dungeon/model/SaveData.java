package com.dungeon.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * 玩家大厅永久存档实体类
 * 对应数据库表: save_data
 * 每个用户只有一条记录，存储宝石、升级、统计等持久化数据
 */
@Entity
@Table(name = "save_data")
public class SaveData {

    // ==================== 主键 ====================
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // 数据库自增ID
    private Long id;

    // ==================== 关联用户 ====================
    @OneToOne                                      // 一对一关联: 一个用户对应一条存档
    @JoinColumn(name = "user_id", unique = true, nullable = false)  // 外键列，唯一且非空
    private User user;

    // ==================== 存档字段 ====================
    @Column(nullable = false)
    private int gems = 0;                          // 宝石数量（大厅货币）

    @Column(name = "upgrades_json", nullable = false, columnDefinition = "TEXT")
    private String upgradesJson = "{}";            // 大厅升级数据，以JSON字符串存储

    @Column(name = "stats_json", nullable = false, columnDefinition = "TEXT")
    private String statsJson = "{}";               // 累计统计数据，以JSON字符串存储

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();  // 最后更新时间

    // ==================== 构造方法 ====================
    public SaveData() {}

    // ==================== Getter / Setter ====================
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public int getGems() { return gems; }
    public void setGems(int gems) { this.gems = gems; }

    public String getUpgradesJson() { return upgradesJson; }
    public void setUpgradesJson(String upgradesJson) { this.upgradesJson = upgradesJson; }

    public String getStatsJson() { return statsJson; }
    public void setStatsJson(String statsJson) { this.statsJson = statsJson; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
