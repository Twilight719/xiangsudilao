package com.dungeon.dto;

/**
 * 单局中途存档的数据传输对象（DTO）
 * 用于前后端之间传递单局实时进度数据
 */
public class RunSaveDataDTO {

    private boolean hasRun;           // 是否有进行中的单局
    private int floorNum;             // 当前层数
    private int kills;                // 本局击杀数
    private int coins;                // 本局金币
    private int gemsThisRun;          // 本局获得的宝石
    private String playerJson;        // 玩家状态JSON
    private String roomsJson;         // 房间地图JSON
    private int currentRoomIndex;     // 当前房间索引

    // ==================== Getter / Setter ====================
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
}
