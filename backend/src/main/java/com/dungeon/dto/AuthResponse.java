package com.dungeon.dto;

/**
 * 认证响应 DTO
 * 注册或登录成功后，后端返回给前端的 JSON 数据对应此类
 *
 * 示例响应体：
 * { "token": "eyJhbGciOiJIUzI1NiJ9...", "username": "zhangsan" }
 *
 * 前端收到后会将 token 存入 localStorage，后续请求带上此 token 进行身份验证
 */
public class AuthResponse {

    private String token;     // JWT 令牌（有效期 24 小时，后续请求需放在 Authorization: Bearer <token> 头中）
    private String username;  // 用户名（前端用于显示当前登录用户）

    /**
     * 构造函数
     * @param token    JWT 令牌
     * @param username 用户名
     */
    public AuthResponse(String token, String username) {
        this.token = token;
        this.username = username;
    }

    // ==================== Getter / Setter ====================
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
}
