package com.dungeon.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 登录请求 DTO
 * 前端登录时发送的 JSON 数据对应此类
 *
 * 示例请求体：
 * { "username": "zhangsan", "password": "123456" }
 */
public class LoginRequest {

    @NotBlank(message = "用户名不能为空")
    @Size(min = 3, max = 32, message = "用户名长度需在3-32个字符之间")
    private String username;   // 登录用户名

    @NotBlank(message = "密码不能为空")
    @Size(min = 4, max = 64, message = "密码长度需在4-64个字符之间")
    private String password;   // 登录密码

    // ==================== Getter / Setter ====================
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
