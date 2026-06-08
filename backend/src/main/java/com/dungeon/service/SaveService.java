package com.dungeon.service;

import com.dungeon.dto.RunSaveDataDTO;
import com.dungeon.dto.SaveDataDTO;
import com.dungeon.model.RunSaveData;
import com.dungeon.model.SaveData;
import com.dungeon.model.User;
import com.dungeon.repository.RunSaveDataRepository;
import com.dungeon.repository.SaveDataRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 存档业务逻辑层（Service）
 * 负责处理大厅永久存档和单局中途存档的读取与保存
 * 所有写操作都加了 @Transactional 保证事务一致性
 */
@Service
public class SaveService {

    private final SaveDataRepository saveDataRepository;         // 大厅存档表操作
    private final RunSaveDataRepository runSaveDataRepository;   // 单局存档表操作

    public SaveService(SaveDataRepository saveDataRepository, RunSaveDataRepository runSaveDataRepository) {
        this.saveDataRepository = saveDataRepository;
        this.runSaveDataRepository = runSaveDataRepository;
    }

    // ==================== 大厅永久存档 ====================

    /**
     * 读取用户的大厅永久存档
     * 如果该用户没有存档，自动创建一条默认存档并返回
     * @param user 当前登录用户
     * @return 存档数据DTO
     */
    @Transactional
    public SaveDataDTO loadSave(User user) {
        // 查询该用户的存档，如果不存在则创建默认存档
        SaveData save = saveDataRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    SaveData s = new SaveData();
                    s.setUser(user);
                    s.setGems(0);
                    // 默认升级数据：所有升级等级为0
                    s.setUpgradesJson("{\"maxHp\":0,\"maxShield\":0,\"maxEnergy\":0,\"cooldownReduct\":0,\"chestQuality\":0}");
                    // 默认统计数据：全为0
                    s.setStatsJson("{\"totalRuns\":0,\"totalKills\":0,\"bestFloor\":0}");
                    return saveDataRepository.save(s);  // 保存到数据库
                });
        // 将实体对象转换为DTO返回给前端
        SaveDataDTO dto = new SaveDataDTO();
        dto.setGems(save.getGems());
        dto.setUpgradesJson(save.getUpgradesJson());
        dto.setStatsJson(save.getStatsJson());
        return dto;
    }

    /**
     * 保存用户的大厅永久存档
     * @param user 当前登录用户
     * @param dto  前端传来的存档数据
     */
    @Transactional
    public void saveSave(User user, SaveDataDTO dto) {
        // 查询该用户的存档，如果不存在则新建
        SaveData save = saveDataRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    SaveData s = new SaveData();
                    s.setUser(user);
                    return s;
                });
        // 更新字段
        save.setGems(dto.getGems());
        save.setUpgradesJson(dto.getUpgradesJson());
        save.setStatsJson(dto.getStatsJson());
        save.setUpdatedAt(LocalDateTime.now());  // 更新修改时间
        saveDataRepository.save(save);            // 执行保存（JPA自动判断INSERT或UPDATE）
    }

    // ==================== 单局中途存档 ====================

    /**
     * 读取用户的单局中途存档
     * 如果该用户没有单局存档，自动创建一条默认记录并返回
     * @param user 当前登录用户
     * @return 单局存档数据DTO
     */
    @Transactional
    public RunSaveDataDTO loadRunSave(User user) {
        RunSaveData run = runSaveDataRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    RunSaveData r = new RunSaveData();
                    r.setUser(user);
                    r.setHasRun(false);  // 默认没有进行中的单局
                    return runSaveDataRepository.save(r);
                });
        // 将实体对象转换为DTO返回给前端
        RunSaveDataDTO dto = new RunSaveDataDTO();
        dto.setHasRun(run.isHasRun());
        dto.setFloorNum(run.getFloorNum());
        dto.setKills(run.getKills());
        dto.setCoins(run.getCoins());
        dto.setGemsThisRun(run.getGemsThisRun());
        dto.setPlayerJson(run.getPlayerJson());
        dto.setRoomsJson(run.getRoomsJson());
        dto.setCurrentRoomIndex(run.getCurrentRoomIndex());
        return dto;
    }

    /**
     * 保存用户的单局中途存档
     * @param user 当前登录用户
     * @param dto  前端传来的单局存档数据
     */
    @Transactional
    public void saveRunSave(User user, RunSaveDataDTO dto) {
        RunSaveData run = runSaveDataRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    RunSaveData r = new RunSaveData();
                    r.setUser(user);
                    return r;
                });
        // 更新单局状态字段
        run.setHasRun(dto.isHasRun());
        run.setFloorNum(dto.getFloorNum());
        run.setKills(dto.getKills());
        run.setCoins(dto.getCoins());
        run.setGemsThisRun(dto.getGemsThisRun());
        run.setPlayerJson(dto.getPlayerJson());
        run.setRoomsJson(dto.getRoomsJson());
        run.setCurrentRoomIndex(dto.getCurrentRoomIndex());
        run.setUpdatedAt(LocalDateTime.now());
        runSaveDataRepository.save(run);
    }

    /**
     * 删除用户的单局中途存档
     * 通常在玩家死亡或通关后调用
     * @param user 当前登录用户
     */
    @Transactional
    public void deleteRunSave(User user) {
        runSaveDataRepository.findByUserId(user.getId())
                .ifPresent(runSaveDataRepository::delete);
    }
}
