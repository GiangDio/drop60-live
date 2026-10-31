const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");

function prepareDatabase() {
  if (!fs.existsSync(schemaPath)) {
    console.error("[prepare-db] Error: schema.prisma not found at:", schemaPath);
    return;
  }

  const dbUrl = process.env.DATABASE_URL || "";
  const isPostgres = dbUrl.startsWith("postgresql:") || dbUrl.startsWith("postgres:");
  const targetProvider = isPostgres ? "postgresql" : "sqlite";

  let schema = fs.readFileSync(schemaPath, "utf8");

  if (schema.includes(`provider = "${targetProvider}"`)) {
    console.log(`[prepare-db] Database provider is correctly configured: ${targetProvider}`);
  } else {
    schema = schema.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${targetProvider}"`);
    fs.writeFileSync(schemaPath, schema, "utf8");
    console.log(`[prepare-db] Auto-switched Prisma provider to: ${targetProvider}`);
  }
}

prepareDatabase();
