name = "__WORKER_NAME__"
main = "src/index.ts"
compatibility_date = "2024-10-01"
account_id = "__CLOUDFLARE_ACCOUNT_ID__"

[[d1_databases]]
binding = "DB"
database_name = "__CLOUDFLARE_D1_DATABASE_NAME__"
database_id = "__CLOUDFLARE_D1_DATABASE_ID__"

[env.production]
d1_databases = [
  { binding = "DB", database_id = "__CLOUDFLARE_D1_DATABASE_ID__" }
]
