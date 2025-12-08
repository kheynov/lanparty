const fs = require('fs');
const path = require('path');

// Create dist/client directory if it doesn't exist
const clientDir = path.join(__dirname, 'dist', 'client');
if (!fs.existsSync(clientDir)) {
  fs.mkdirSync(clientDir, { recursive: true });
}

// Copy HTML files
const htmlFiles = ['display.html', 'control.html'];
htmlFiles.forEach(file => {
  const src = path.join(__dirname, 'src', 'client', file);
  const dest = path.join(clientDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to dist/client/`);
  }
});

// Copy root HTML files to dist for backward compatibility
const rootHtmlFiles = ['index.html', 'control.html'];
rootHtmlFiles.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(__dirname, 'dist', file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to dist/`);
  }
});

console.log('HTML files copied successfully!');