const fs = require('fs');

const [behavior, value] = process.argv.slice(2);

if (behavior === 'normal') process.exit(0);
if (behavior === 'echo') {
  process.stdout.write(value || '');
  process.exit(0);
}
if (behavior === 'write') {
  fs.writeFileSync(value, process.env.FAKE_TEXT || '', 'utf8');
  process.exit(0);
}
if (behavior === 'exit') process.exit(Number(value) || 2);
if (behavior === 'delay') setTimeout(() => process.exit(0), Number(value) || 1_000);
if (behavior === 'stdout') {
  process.stdout.write('x'.repeat(Number(value) || 1024));
  process.exit(0);
}
if (behavior === 'stderr') {
  process.stderr.write('x'.repeat(Number(value) || 1024));
  process.exit(0);
}
process.exit(3);
