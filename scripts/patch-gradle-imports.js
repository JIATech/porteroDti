const fs = require('fs');
const path = require('path');

function patchFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    // Remove any import line referencing KotlinCompile
    content = content.replace(/^\s*import\s+org\.jetbrains\.kotlin\.gradle\.tasks\.KotlinCompile.*\n?/gm, '');
    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`Patched: ${filePath}`);
    }
}

function walkDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.gradle')) {
            patchFile(fullPath);
        }
    });
}

const nodeModulesDir = path.join(process.cwd(), 'node_modules');
console.log('Patching all .gradle files in node_modules for problematic KotlinCompile imports...');
walkDir(nodeModulesDir);
console.log('Patch complete.');
