import type { Handler } from '@netlify/functions';
import serverless from 'serverless-http';
import app from '../../dist/index.js';

const serverlessHandler = serverless(app);

export const handler: Handler = async (event, context) => {
  return serverlessHandler(event, context);
};
