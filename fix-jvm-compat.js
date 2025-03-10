const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Running fix-jvm-compat.js script to fix JVM compatibility...');

// Path to gradle.properties in the EAS build environment
const gradlePropertiesPath = path.join(process.cwd(), 'android', 'gradle.properties');

try {
  // Read the current content and append our settings
  let content = fs.readFileSync(gradlePropertiesPath, 'utf8');
  
  // Add our JVM compatibility settings if they're not already there
  const settings = [
    '# Added by fix-jvm-compat script',
    'kotlin.jvm.target.validation.mode=warning',
    'android.kotlinOptions.jvmTarget=17',
    'org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m'
  ];
  
  // Only add settings if they don't already exist
  let modified = false;
  for (const setting of settings) {
    if (!content.includes(setting.split('=')[0])) {
      content += '\n' + setting;
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(gradlePropertiesPath, content);
    console.log('Added JVM compatibility settings to gradle.properties');
  } else {
    console.log('JVM compatibility settings already exist in gradle.properties');
  }
  
  // Now find all build.gradle files that use kotlin and modify them
  console.log('Setting up project.ext in build.gradle files...');
  
  const nodeModulesDir = path.join(process.cwd(), 'node_modules');
  
  // Find all build.gradle files in node_modules
  const findGradleFiles = (dir) => {
    let results = [];
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && file !== 'node_modules') {
        results = results.concat(findGradleFiles(filePath));
      } else if (file === 'build.gradle') {
        results.push(filePath);
      }
    }
    
    return results;
  };
  
  const gradleFiles = findGradleFiles(nodeModulesDir);
  
  // Check each build.gradle file for kotlin plugin and modify if needed
  let modifiedCount = 0;
  for (const file of gradleFiles) {
    const content = fs.readFileSync(file, 'utf8');
    
    if (content.includes('kotlin') && !content.includes('project.ext.javaVersion')) {
      const newContent = 'project.ext.javaVersion = JavaVersion.VERSION_17\n' + content;
      fs.writeFileSync(file, newContent);
      console.log(`Modified ${file} to include Java version`);
      modifiedCount++;
    }
  }
  
  console.log(`Modified ${modifiedCount} build.gradle files`);
  console.log('Script completed successfully');
  
} catch (error) {
  console.error('Error in fix-jvm-compat script:', error);
  process.exit(1);
}
