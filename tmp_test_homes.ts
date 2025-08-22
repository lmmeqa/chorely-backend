import request from 'supertest';
import handler from './src/app';

(async () => {
  const agent = request(handler as any);
  const res = await agent.post('/homes').send({ name: 'X Home' });
  console.log('status', res.status);
  console.log('body', res.text);
})();
