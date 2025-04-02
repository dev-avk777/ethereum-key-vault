/* eslint-env node */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Регулярное выражение для поиска импортов с "type"
const typeImportRegex = /import\s+{\s*type\s+([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;
const typeImportSingleRegex = /import\s+type\s+{\s*([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;

// Функция для рекурсивного обхода директорий
function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

// Функция для проверки и исправления файла
function fixImports(filePath) {
  // Обрабатываем только TypeScript файлы
  if (!filePath.endsWith('.ts')) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Заменяем импорты с "type"
  content = content.replace(typeImportRegex, (match, imports, source) => {
    console.log(`Fixing import in ${filePath}: ${match}`);
    return `import { ${imports} } from '${source}'`;
  });

  // Заменяем импорты начинающиеся с "type"
  content = content.replace(typeImportSingleRegex, (match, imports, source) => {
    console.log(`Fixing type import in ${filePath}: ${match}`);
    return `import { ${imports} } from '${source}'`;
  });

  // Если контент изменился, записываем обратно
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed imports in ${filePath}`);
    return true;
  }
  
  return false;
}

// Основная директория с исходным кодом
const srcDir = path.join(__dirname, 'src');

// Счетчик исправленных файлов
let fixedCount = 0;

// Обходим все файлы и исправляем импорты
console.log('Scanning source files for type imports...');
walkDir(srcDir, (filePath) => {
  if (fixImports(filePath)) {
    fixedCount++;
  }
});

console.log(`\nFixed imports in ${fixedCount} files.`);
console.log('Formatting code with Prettier...');

try {
  // Форматируем код после изменений
  execSync('npx prettier --write "src/**/*.ts"', { stdio: 'inherit' });
  console.log('Code formatting complete.');
} catch (error) {
  console.error('Error during code formatting:', error.message);
}