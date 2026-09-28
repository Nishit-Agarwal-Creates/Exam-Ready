import next from "eslint-config-next";

const config = [...next, { ignores: [".next/**", ".next-*/**", ".open-next/**", ".open-next-*/**", ".wrangler/**", ".sources-cache/**", "node_modules/**", "drizzle/**", "public/**"] }];

export default config;
