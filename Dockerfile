# ============================================
# 元气地牢 - Render 部署 Dockerfile
# 使用 Ubuntu 镜像，兼容性更好
# ============================================

# --- 阶段 1：Maven 编译 ---
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B -q
COPY backend/src ./src
RUN mvn clean package -DskipTests -B -q

# --- 阶段 2：运行镜像 ---
FROM eclipse-temurin:17-jre
WORKDIR /app

# 非 root 用户
RUN useradd -m dungeon && mkdir -p /app/data && chown -R dungeon:dungeon /app

COPY --from=build /app/target/*.jar app.jar
USER dungeon

# 启动（server.port 从 application.properties 中的 ${PORT:8080} 读取）
ENTRYPOINT ["java", "-jar", "app.jar"]
