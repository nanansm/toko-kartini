// Jembatan tipe: `Env` datang dari worker-configuration.d.ts (hasil `wrangler types`),
// sedangkan getCloudflareContext() dari @opennextjs/cloudflare memakai nama `CloudflareEnv`.
interface CloudflareEnv extends Env {}
