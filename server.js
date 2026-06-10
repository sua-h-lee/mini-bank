const express = require('express');
const { Pool } = require('pg');

const app = express();

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  user: 'postgres',
  password: 'mypassword',
  database: 'postgres',
});

app.use(express.json());
app.use(express.static('.'));

// API 1: 계좌 목록
app.get('/api/accounts', async (req, res) => {
  const result = await pool.query('SELECT * FROM accounts ORDER BY id');
  res.json(result.rows);
});

// API 2: 이체 내역 (JOIN 쿼리)
app.get('/api/transfers', async (req, res) => {
  const result = await pool.query(`
    SELECT t.id, a1.name AS from_name, a2.name AS to_name, t.amount, t.created_at
    FROM transfers t
    JOIN accounts a1 ON t.from_id = a1.id
    JOIN accounts a2 ON t.to_id = a2.id
    ORDER BY t.id DESC
  `);
  res.json(result.rows);
});

// API 3: 이체하기 (트랜잭션)
app.post('/api/transfers', async (req, res) => {
  const { fromId, toId, amount } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 0. 입력값 검증 (비즈니스 로직)
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('금액이 올바르지 않아요');
    }
    if (fromId === toId) {
      throw new Error('같은 계좌로는 이체할 수 없어요');
    }

    // 1. 잔액 확인 + 행 잠금 (FOR UPDATE: 동시 이체 방지)
    const check = await client.query(
      'SELECT balance FROM accounts WHERE id = $1 FOR UPDATE',
      [fromId]
    );
    if (check.rows.length === 0) {
      throw new Error('계좌를 찾을 수 없어요');
    }
    if (check.rows[0].balance < amount) {
      throw new Error('잔액 부족!');
    }

    // 2. 보내는 쪽 차감
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, fromId]
    );

    // 3. 받는 쪽 증가
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toId]
    );

    // 4. 이체 기록
    await client.query(
      'INSERT INTO transfers (from_id, to_id, amount) VALUES ($1, $2, $3)',
      [fromId, toId, amount]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

app.listen(3000, () => {
  console.log('서버 실행 중: http://localhost:3000');
});