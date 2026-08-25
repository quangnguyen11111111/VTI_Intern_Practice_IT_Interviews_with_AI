async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
  const baseUrl = `${API_URL}/interviews`;
  
  console.log('1. Khởi tạo Interview Session...');
  let res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobPosition: 'role_123',
      level: 'level_456',
      techStacks: ['tech_1', 'tech_2']
    })
  });
  let json = await res.json();
  const interviewId = json.data.id;
  console.log('=> Trạng thái:', json.data.status, `(ID: ${interviewId})`);

  console.log('\n2. Gọi generate lần 1 (PENDING -> GENERATING)');
  res = await fetch(`${baseUrl}/${interviewId}/generate`, { method: 'POST' });
  json = await res.json();
  console.log('=> Trạng thái sau lệnh generate:', json.data.status); // Should be IN_PROGRESS because Mock AI awaits and completes

  console.log('\n3. Thử gọi generate lần 2 (Chống F5/Idempotency)');
  res = await fetch(`${baseUrl}/${interviewId}/generate`, { method: 'POST' });
  json = await res.json();
  console.log('=> Phản hồi lỗi:', json); // Should throw InvalidStateTransitionException

  console.log('\n4. Nộp bài (IN_PROGRESS -> EVALUATING -> COMPLETED)');
  res = await fetch(`${baseUrl}/${interviewId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: [{ questionId: 'q1', text: 'answer' }] })
  });
  json = await res.json();
  console.log('=> Trạng thái:', json.data.status); // Should be COMPLETED

  console.log('\n5. Thử nộp bài lần 2');
  res = await fetch(`${baseUrl}/${interviewId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: [] })
  });
  json = await res.json();
  console.log('=> Phản hồi lỗi:', json); // Should throw InvalidStateTransitionException

  console.log('\n6. Lấy trạng thái hiện hành');
  res = await fetch(`${baseUrl}/${interviewId}`);
  json = await res.json();
  console.log('=> Dữ liệu phiên:', JSON.stringify(json.data, null, 2));
}

runTest().catch(console.error);
