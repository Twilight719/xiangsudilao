package com.dungeon.dto;

/**
 * 大厅永久存档的数据传输对象（DTO）
 * 用于前后端之间传递存档数据，不包含数据库实体中的关联对象
 */
public class SaveDataDTO {

    private int gems;              // 宝石数量
    private String upgradesJson;   // 升级数据JSON字符串
    private String statsJson;      // 统计数据JSON字符串

    // ==================== Getter / Setter ====================
    public int getGems() { return gems; }
    public void setGems(int gems) { this.gems = gems; }

    public String getUpgradesJson() { return upgradesJson; }
    public void setUpgradesJson(String upgradesJson) { this.upgradesJson = upgradesJson; }

    public String getStatsJson() { return statsJson; }
    public void setStatsJson(String statsJson) { this.statsJson = statsJson; }
}
