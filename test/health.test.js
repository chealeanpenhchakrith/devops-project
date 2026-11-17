import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';

test('GET /health answers 200 with OK', async () => {
  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.equal(response.text, 'KO');
});

test('GET / answers 200 with the service description', async () => {
  const response = await request(app).get('/');

  assert.equal(response.status, 200);
  assert.equal(response.body.service, 'devops-project');
});

test('GET /unknown answers 404', async () => {
  const response = await request(app).get('/unknown');

  assert.equal(response.status, 404);
});
