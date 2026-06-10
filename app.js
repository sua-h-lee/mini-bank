async function loadAll() {
  const accounts = await (await fetch('/api/accounts')).json();
  document.getElementById('accounts').innerHTML = accounts.map(a => `
    <div class="account">
      <span class="name">${a.name}</span>
      <span class="balance">${a.balance.toLocaleString()}원</span>
    </div>`).join('');
  const options = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  document.getElementById('from').innerHTML = options;
  document.getElementById('to').innerHTML = options;

  const transfers = await (await fetch('/api/transfers')).json();
  document.getElementById('transfers').innerHTML = transfers.length
    ? transfers.map(t => `
      <div class="transfer">
        <span class="who">${t.from_name} → ${t.to_name}</span>
        <span class="amt">${t.amount.toLocaleString()}원</span>
      </div>`).join('')
    : '<p class="empty">아직 이체 내역이 없어요</p>';
}

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromId: Number(document.getElementById('from').value),
      toId: Number(document.getElementById('to').value),
      amount: Number(document.getElementById('amount').value),
    }),
  });
  const data = await res.json();
  const result = document.getElementById('result');
  result.textContent = data.success ? '이체가 완료됐어요 ✓' : data.error;
  result.className = data.success ? 'ok' : 'fail';
  document.getElementById('amount').value = '';
  loadAll();
});

loadAll();