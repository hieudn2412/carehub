# syntax=docker/dockerfile:1.7
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw mvnw
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -DskipTests dependency:go-offline
COPY src src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-jammy

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --shell /usr/sbin/nologin --create-home app \
    && mkdir -p /data/documents \
    && chown -R app:app /data

WORKDIR /app
COPY --from=build --chown=app:app /workspace/target/carehub-backend-*.jar /app/app.jar

USER app
EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://localhost:8081/actuator/health | grep -q UP || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
