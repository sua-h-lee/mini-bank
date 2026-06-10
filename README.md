# 🏦 미니 은행 (Mini Bank)

PostgreSQL의 **릴레이션, 쿼리, 트랜잭션**을 이해하기 위해 만든 계좌 이체 웹 서비스입니다.
계좌 목록 조회, 계좌 간 이체, 이체 내역 조회 기능을 제공합니다.

## 기술 스택

| 구분 | 기술 |
|------|------|
| 데이터베이스 | PostgreSQL 18 (Docker) |
| 백엔드 | Node.js + Express + pg |
| 프론트엔드 | HTML / CSS / Vanilla JS (fetch API) |

```
브라우저 (index.html)
   ↓ fetch
Express 서버 (server.js, :3000)
   ↓ SQL (pg)
PostgreSQL (Docker, :5433)
```

## 릴레이션 설계

```sql
CREATE TABLE accounts (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE transfers (
  id         SERIAL PRIMARY KEY,
  from_id    INTEGER NOT NULL REFERENCES accounts(id),
  to_id      INTEGER NOT NULL REFERENCES accounts(id),
  amount     INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

- `transfers.from_id`, `transfers.to_id`는 `accounts.id`를 참조하는 **외래키(FK)** → 존재하지 않는 계좌로의 이체 기록을 DB 차원에서 차단
- 제약조건 3종 활용: **PRIMARY KEY** (행 식별), **FOREIGN KEY** (릴레이션 간 참조 무결성), **UNIQUE** (계좌명 중복 방지)

## 쿼리 — 셀프 조인 활용

이체 내역 조회 시 `transfers`를 `accounts`와 **두 번 JOIN**하여
숫자 id를 사람이 읽을 수 있는 이름으로 변환합니다.

```sql
SELECT t.id, a1.name AS from_name, a2.name AS to_name, t.amount, t.created_at
FROM transfers t
JOIN accounts a1 ON t.from_id = a1.id
JOIN accounts a2 ON t.to_id   = a2.id
ORDER BY t.id DESC;
```

## 트랜잭션 — 이체 처리

이체는 4개의 쿼리(잔액 확인 → 차감 → 증가 → 기록)로 이루어지며,
중간에 실패하면 돈이 증발하거나 복제될 수 있으므로 하나의 트랜잭션으로 묶었습니다.

```
BEGIN
  1. SELECT balance ... FOR UPDATE   -- 잔액 확인 + 행 잠금
  2. UPDATE (보내는 쪽 차감)
  3. UPDATE (받는 쪽 증가)
  4. INSERT (이체 기록)
COMMIT  -- 전부 성공 시 확정
ROLLBACK  -- 하나라도 실패 시 전부 취소 (All or Nothing)
```

- **원자성**: 잔액 부족 시 `ROLLBACK`되어 어떤 변경도 남지 않음
- **동시성 제어**: `SELECT ... FOR UPDATE`로 행을 잠가, 동시 이체 요청에 의한
  잔액 음수(race condition)를 방지

## API

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/accounts` | 계좌 목록 조회 |
| GET | `/api/transfers` | 이체 내역 조회 (JOIN) |
| POST | `/api/transfers` | 이체 실행 (트랜잭션) |

## 보안 및 입력 검증

- **SQL Injection 방어**: 모든 쿼리에 파라미터화 쿼리(`$1, $2`) 사용
- **비즈니스 로직 검증**: 음수/0원 이체, 자기 자신에게 이체, 존재하지 않는 계좌 차단

## 실행 방법

```bash
# 1. PostgreSQL 컨테이너 실행 (포트 5433)
docker run --name my-postgres -e POSTGRES_PASSWORD=mypassword -p 5433:5432 -d postgres

# 2. 테이블 생성 및 초기 데이터
docker exec -it my-postgres psql -U postgres
# → 위의 CREATE TABLE 문 실행 후
# INSERT INTO accounts (name, balance) VALUES ('수아', 10000), ('도영', 10000), ('준성', 10000);

# 3. 서버 실행
npm install
node server.js
# → http://localhost:3000 접속
```

## 프로젝트 구조

```
├── server.js     # Express 서버 (API, 트랜잭션 처리)
├── index.html    # 화면 구조
├── style.css     # 스타일
├── app.js        # 프론트 로직 (fetch)
└── package.json
```
