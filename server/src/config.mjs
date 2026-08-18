import { z } from "zod";

const Env = z.object({
  DB_HOST: z.string().min(1).default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().positive().default(15432),
  DB_NAME: z.literal("gpters_challenge_board"),
  DB_USER: z.literal("gpters_challenge_board_app"),
  DB_PASSWORD: z.string().min(20),
  SERVICE_TOKEN: z.string().min(32),
  API_HOST: z.literal("127.0.0.1").default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(18887),
});

export function loadConfig(env = process.env) {
  return Env.parse(env);
}
