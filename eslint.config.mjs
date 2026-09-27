import next from "eslint-config-next";

const config = [...next, { ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "drizzle/**"] }];

export default config;
