import express from 'express';

const app = express();

app.disable('x-powered-by');

app.get('/', (req, res) => {
  res.status(200).json({
    service: 'devops-project',
    version: '1.1.0',
    env: process.env.APP_ENV || 'local',
  });
});

app.get('/health', (req, res) => {
  res.status(200).type('text/plain').send('OK');
});

export default app;
