const fs = require('fs');
const path = require('path');

const todoPath = path.join(__dirname, '..', 'src', 'TodoPage.js');
let todo = fs.readFileSync(todoPath, 'utf8');

if (todo.includes('const TODO_INPUT_TEXT_COLOR_FIX = true;')) {
  console.log('Todo input text color fix already applied.');
  process.exit(0);
}

const replaceExact = (source, from, to) => {
  if (!source.includes(from)) {
    throw new Error('Could not find expected text to replace: ' + from.slice(0, 120));
  }
  return source.replace(from, to);
};

todo = replaceExact(
  todo,
  'const styles = `',
  'const TODO_INPUT_TEXT_COLOR_FIX = true;\n\nconst styles = `'
);

todo = replaceExact(
  todo,
  '.input-style { width: 100%; padding: 0.65rem 0.75rem; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 0.5rem; outline: none; }',
  '.input-style { width: 100%; padding: 0.65rem 0.75rem; background-color: #f8fafc; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 0.5rem; outline: none; }'
);

todo = replaceExact(
  todo,
  '.dark .input-style { background-color: #334155; border-color: #475569; color: white; }',
  '.dark .input-style { background-color: #f8fafc; border-color: #cbd5e1; color: #0f172a; }\n.input-style::placeholder { color: #64748b; }\n.dark .input-style::placeholder { color: #64748b; }\nselect.input-style option { background-color: #ffffff; color: #0f172a; }'
);

fs.writeFileSync(todoPath, todo, 'utf8');
console.log('Applied todo input text color fix.');
