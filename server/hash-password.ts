import { hashPassword } from './auth.js';

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          return resolve(value);
        }
        if (ch === '\u0003') process.exit(1);
        if (ch === '\u007f') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const pw = await ask('New password: ');
if (pw.length < 12) {
  console.error('Use at least 12 characters.');
  process.exit(1);
}
if (pw !== (await ask('Repeat password: '))) {
  console.error('Passwords do not match.');
  process.exit(1);
}
console.log('\nPut this in your .env file:\n');
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(pw)}`);
