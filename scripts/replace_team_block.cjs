const fs = require('fs');

const [, , filePath, teamKey, nextKey] = process.argv;

if (!filePath || !teamKey || !nextKey) {
  console.error('Usage: node scripts/replace_team_block.cjs <file> <teamKey> <nextKey>');
  process.exit(1);
}

const replacement = fs.readFileSync(0, 'utf8');
let text = fs.readFileSync(filePath, 'utf8');
const pattern = new RegExp(`  "${teamKey}": \\{[\\s\\S]*?\\n  \\},\\n(?=\\n  "${nextKey}":)`, 'm');

if (!pattern.test(text)) {
  console.error(`Block not found for ${teamKey} -> ${nextKey}`);
  process.exit(2);
}

text = text.replace(pattern, replacement.trimEnd() + '\n');
fs.writeFileSync(filePath, text, 'utf8');
