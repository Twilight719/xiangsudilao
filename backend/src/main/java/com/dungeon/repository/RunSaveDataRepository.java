package com.dungeon.repository;

import com.dungeon.model.RunSaveData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 单局中途存档的数据访问层（Repository）
 * 继承 JpaRepository，Spring Data JPA 会自动实现基本的增删改查方法
 * 主键类型为 Long
 */
@Repository
public interface RunSaveDataRepository extends JpaRepository<RunSaveData, Long> {

    /**
     * 根据用户ID查找单局存档记录
     * @param userId 用户ID
     * @return 该用户的单局存档（可能不存在，所以返回 Optional）
     */
    Optional<RunSaveData> findByUserId(Long userId);
}
