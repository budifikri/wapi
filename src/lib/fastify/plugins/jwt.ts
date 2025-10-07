import fp from "fastify-plugin";
import jwt from "@fastify/jwt";

export default fp(
  async (fastify) => {
    fastify.register(jwt, {
      secret:
        process.env.JWT_SECRET ||
        "your-super-secret-jwt-key-change-in-production",
      cookie: {
        cookieName: "token",
        signed: false,
      },
    });

    // Tambahkan method authenticate yang bisa skip endpoint tertentu
    fastify.decorate("authenticate", async function (request, reply) {
      try {
        // ✅ Skip JWT check untuk webhook atau route publik
        if (request.url.startsWith("/whatsapp/webhook")) {
          return;
        }

        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({
          error: "Unauthorized",
          message: err.message,
        });
      }
    });
  },
  {
    name: "jwt",
  }
);
