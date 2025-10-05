import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';

export default fp(async (fastify) => {
  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'your-super-secret-cookie-key',
    hook: 'onRequest',
    parseOptions: {},
  });
}, {
  name: 'cookie',
});