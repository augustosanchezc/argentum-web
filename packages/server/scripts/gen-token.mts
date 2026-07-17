import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";
import crypto from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
// leer secret del .env.local
const env = readFileSync("../../.env.local","utf8");
const secret = (env.match(/^JWT_SECRET=(.*)$/m)?.[1]||"").trim();
if(!secret){ console.error("no JWT_SECRET"); process.exit(1); }
// cuenta de VisTest531 (char 103)
const r = await db.execute(sql`SELECT a.id, a.email, a.role FROM accounts a JOIN characters c ON c.account_id=a.id WHERE c.name='VisTest531' LIMIT 1`);
const acc = r.rows[0] as {id:number;email:string;role:number};
if(!acc){ console.error("no account"); process.exit(1); }
const b64=(o:object)=>Buffer.from(JSON.stringify(o)).toString("base64url");
const now=Math.floor(Date.now()/1000);
const header=b64({alg:"HS256",typ:"JWT"});
const payload=b64({accountId:acc.id,email:acc.email,role:acc.role,iat:now,exp:now+86400});
const sig=crypto.createHmac("sha256",secret).update(header+"."+payload).digest("base64url");
const token=header+"."+payload+"."+sig;
writeFileSync("../../../../AppData/Local/Temp/claude/C--Users-clokm/e03090ba-f36a-4727-b5e7-d30654e32e3c/scratchpad/token.txt", token);
console.log("token generado para acc", acc.id, acc.email, "role", acc.role);
process.exit(0);
