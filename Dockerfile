# ============================================
# 元气地牢 - Render 部署 Dockerfile
# ============================================

# --- 阶段 1：Maven 编译 ---
FROM maven:3.9-eclipse-temurin-17-alpine AS build
WORKDIR /app
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B
COPY backend/src ./src
RUN mvn clean package -DskipTests -B

# --- 阶段 2：运行镜像 ---
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S dungeon && adduser -S dungeon -G dungeon
RUN mkdir -p /app/data && chown -R dungeon:dungeon /app
COPY --from=build /app/target/*.jar app.jar
USER dungeon
EXPOSE 8080

# Render 会注入 PORT 环境变量，Spring Boot 通过 server.port=${PORT:8080} 读取
ENTRYPOINT ["sh", "-c", "java -jar app.jar"]
