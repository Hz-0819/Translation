import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { MemoryAuthRepository } from "../src/auth/memory-repository.js";
import type { AppConfig } from "../src/config.js";

const testConfig: AppConfig = {
  NODE_ENV: "test",
  API_PORT: 8787,
  WEB_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://unused",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "test",
  S3_ACCESS_KEY: "test",
  S3_SECRET_KEY: "test",
  JWT_SECRET: "test-secret-that-is-at-least-32-characters",
  ACCESS_TOKEN_TTL_MINUTES: 15,
  REFRESH_TOKEN_TTL_DAYS: 30,
};

function refreshCookie(response: { headers: Record<string, unknown> }) {
  const header = response.headers["set-cookie"];
  const value = Array.isArray(header) ? header[0] : String(header);
  return value.split(";", 1)[0];
}

test("register, login, refresh rotation, and logout form a private session flow", async () => {
  const repository = new MemoryAuthRepository();
  const app = buildApp({ config: testConfig, authRepository: repository });

  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: " Student@Example.com ",
      password: "correct horse battery staple",
      deviceName: "Study tablet",
      platform: "Android",
    },
  });
  assert.equal(registration.statusCode, 201);
  assert.equal(registration.headers["x-content-type-options"], "nosniff");
  assert.match(registration.json().accessToken, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.equal(registration.json().user.email, "student@example.com");
  const firstCookie = refreshCookie(registration);
  assert.match(String(registration.headers["set-cookie"]), /HttpOnly/i);

  const duplicate = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "student@example.com", password: "another secure password" },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().message, "无法创建账号");

  const badLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "student@example.com", password: "definitely wrong" },
  });
  assert.equal(badLogin.statusCode, 401);
  assert.equal(badLogin.json().message, "邮箱或密码不正确");

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: "student@example.com",
      password: "correct horse battery staple",
      deviceName: "Desktop browser",
    },
  });
  assert.equal(login.statusCode, 200);
  const loginCookie = refreshCookie(login);

  const refreshed = await app.inject({
    method: "POST",
    url: "/api/auth/refresh",
    headers: { cookie: loginCookie },
  });
  assert.equal(refreshed.statusCode, 200);
  const rotatedCookie = refreshCookie(refreshed);
  assert.notEqual(rotatedCookie, loginCookie);

  const replay = await app.inject({
    method: "POST",
    url: "/api/auth/refresh",
    headers: { cookie: loginCookie },
  });
  assert.equal(replay.statusCode, 401);

  const logout = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { cookie: rotatedCookie },
  });
  assert.equal(logout.statusCode, 204);

  const afterLogout = await app.inject({
    method: "POST",
    url: "/api/auth/refresh",
    headers: { cookie: rotatedCookie },
  });
  assert.equal(afterLogout.statusCode, 401);

  assert.ok(firstCookie.startsWith("paperlingo_refresh="));
  await app.close();
});

test("authentication endpoints reject bursts after the per-IP limit", async () => {
  const app = buildApp({
    config: testConfig,
    authRepository: new MemoryAuthRepository(),
  });

  let statusCode = 0;
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "missing@example.com",
        password: "a valid but incorrect password",
      },
    });
    statusCode = response.statusCode;
  }

  assert.equal(statusCode, 429);
  await app.close();
});

test("registration rejects weak passwords before creating an account", async () => {
  const repository = new MemoryAuthRepository();
  const app = buildApp({ config: testConfig, authRepository: repository });

  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "student@example.com", password: "short" },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(repository.userCount, 0);
  await app.close();
});
