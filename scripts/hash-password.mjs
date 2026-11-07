import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const password =
  process.env.PASSWORD_TO_HASH ||
  (await rl.question("Staff password (input is visible in this terminal): "));
rl.close();
if (password.length < 16) throw new Error("Use at least 16 characters");
console.log(await bcrypt.hash(password, 12));
