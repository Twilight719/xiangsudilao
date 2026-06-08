package com.dungeon.controller;

import com.dungeon.dto.RunSaveDataDTO;
import com.dungeon.dto.SaveDataDTO;
import com.dungeon.model.User;
import com.dungeon.service.AuthService;
import com.dungeon.service.JwtService;
import com.dungeon.service.SaveService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 存档相关的 REST 接口控制器
 * 所有路径以 /api/save 开头
 * 需要前端在请求头中携带 JWT Token 进行身份验证
 */
@RestController
@RequestMapping("/api/save")
@CrossOrigin(origins = "*")  // 允许跨域访问（开发环境）
public class SaveController {

    private final SaveService saveService;    // 存档业务逻辑服务
    private final JwtService jwtService;      // JWT Token 工具类
    private final AuthService authService;    // 用户认证服务

    public SaveController(SaveService saveService, JwtService jwtService, AuthService authService) {
        this.saveService = saveService;
        this.jwtService = jwtService;
        this.authService = authService;
    }

    /**
     * 从请求头中解析 JWT Token，获取当前登录用户
     * @param authHeader 请求头中的 Authorization 字段，格式: "Bearer xxx"
     * @return 当前登录用户对象
     */
    private User getUserFromToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("缺少Token");
        }
        String token = authHeader.substring(7);           // 去掉 "Bearer " 前缀
        if (!jwtService.validateToken(token)) {           // 校验 Token 是否有效
            throw new RuntimeException("Token无效");
        }
        String username = jwtService.extractUsername(token);  // 从 Token 中提取用户名
        return authService.getUserByUsername(username);       // 根据用户名查询用户
    }

    // ==================== 大厅永久存档接口 ====================

    /**
     * 读取大厅存档
     * GET /api/save/load
     * @param authHeader 请求头中的 Authorization
     * @return 该用户的大厅存档数据
     */
    @GetMapping("/load")
    public ResponseEntity<SaveDataDTO> load(@RequestHeader("Authorization") String authHeader) {
        User user = getUserFromToken(authHeader);
        return ResponseEntity.ok(saveService.loadSave(user));
    }

    /**
     * 保存大厅存档
     * POST /api/save/save
     * @param authHeader 请求头中的 Authorization
     * @param dto        前端传来的存档数据
     * @return 保存成功提示
     */
    @PostMapping("/save")
    public ResponseEntity<Map<String, Object>> save(@RequestHeader("Authorization") String authHeader,
                                                     @RequestBody SaveDataDTO dto) {
        User user = getUserFromToken(authHeader);
        saveService.saveSave(user, dto);
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ==================== 单局中途存档接口 ====================

    /**
     * 读取单局存档
     * GET /api/save/run/load
     * @param authHeader 请求头中的 Authorization
     * @return 该用户的单局存档数据
     */
    @GetMapping("/run/load")
    public ResponseEntity<RunSaveDataDTO> loadRun(@RequestHeader("Authorization") String authHeader) {
        User user = getUserFromToken(authHeader);
        return ResponseEntity.ok(saveService.loadRunSave(user));
    }

    /**
     * 保存单局存档
     * POST /api/save/run/save
     * @param authHeader 请求头中的 Authorization
     * @param dto        前端传来的单局存档数据
     * @return 保存成功提示
     */
    @PostMapping("/run/save")
    public ResponseEntity<Map<String, Object>> saveRun(@RequestHeader("Authorization") String authHeader,
                                                        @RequestBody RunSaveDataDTO dto) {
        User user = getUserFromToken(authHeader);
        saveService.saveRunSave(user, dto);
        return ResponseEntity.ok(Map.of("success", true));
    }

    /**
     * 删除单局存档
     * POST /api/save/run/delete
     * @param authHeader 请求头中的 Authorization
     * @return 删除成功提示
     */
    @PostMapping("/run/delete")
    public ResponseEntity<Map<String, Object>> deleteRun(@RequestHeader("Authorization") String authHeader) {
        User user = getUserFromToken(authHeader);
        saveService.deleteRunSave(user);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
