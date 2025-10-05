import fp from 'fastify-plugin';
import oauth2 from '@fastify/oauth2';

export default fp(async (fastify) => {
  await fastify.register(oauth2, {
    name: 'googleOAuth2',
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
        secret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
      },
      auth: oauth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/auth/google',
    callbackUri: `${process.env.URL_API || process.env.BASE_URL || 'http://localhost:3001'}/auth/google/callback`,
    scope: ['profile', 'email'],
  });
}, {
  name: 'oauth2',
});