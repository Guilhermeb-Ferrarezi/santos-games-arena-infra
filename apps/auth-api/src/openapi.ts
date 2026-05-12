import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

export async function registerOpenApi(server: FastifyInstance) {
  await server.register(swagger, {
    openapi: {
      info: {
        title: "Santos Games Auth API",
        version: "0.1.0"
      }
    }
  });

  await server.register(swaggerUi, {
    routePrefix: "/docs"
  });

  server.get("/openapi.json", async () => server.swagger());
}
