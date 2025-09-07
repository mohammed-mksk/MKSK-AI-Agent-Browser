const fs = require('fs');
const path = require('path');

// Create the correct directory structure
const targetDir = path.join(__dirname, 'dist/renderer');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`Created directory: ${targetDir}`);
}

// Copy the renderer build files to the correct location
const sourceDir = path.join(__dirname, 'src/renderer/dist');
if (fs.existsSync(sourceDir)) {
  console.log(`Copying files from ${sourceDir} to ${targetDir}`);
  
  // Copy all files from source to target
  fs.readdirSync(sourceDir).forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    if (fs.lstatSync(sourcePath).isDirectory()) {
      // If it's a directory, copy recursively
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
      // Copy directory contents
      fs.readdirSync(sourcePath).forEach(subFile => {
        const subSourcePath = path.join(sourcePath, subFile);
        const subTargetPath = path.join(targetPath, subFile);
        fs.copyFileSync(subSourcePath, subTargetPath);
        console.log(`Copied: ${file}/${subFile}`);
      });
    } else {
      // If it's a file, copy directly
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Copied: ${file}`);
    }
  });
  
  console.log('Files copied successfully!');
  console.log(`Target directory contents:`);
  fs.readdirSync(targetDir).forEach(file => {
    console.log(`  - ${file}`);
  });
} else {
  console.error(`Source directory ${sourceDir} does not exist!`);
  console.log('Available directories:');
  console.log('  - src/renderer:', fs.existsSync(path.join(__dirname, 'src/renderer')));
  console.log('  - dist:', fs.existsSync(path.join(__dirname, 'dist')));
}