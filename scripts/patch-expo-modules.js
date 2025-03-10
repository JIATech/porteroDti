/**
 * Script to patch Expo modules with JVM target configuration
 * This specifically targets the problematic expo-application module
 */
const fs = require('fs');
const path = require('path');

// Log start
console.log('Patching Expo modules for JVM compatibility...');

try {
  const nodeModulesDir = path.join(process.cwd(), 'node_modules');
  
  // List of problematic Expo modules to patch
  const modulesToPatch = [
    'expo-application',
    'expo-asset',
    'expo-constants',
    'expo-file-system',
    'expo-font',
    'expo-keep-awake',
    'expo-modules-core'
  ];
  
  for (const moduleName of modulesToPatch) {
    const modulePath = path.join(nodeModulesDir, moduleName);
    if (!fs.existsSync(modulePath)) {
      console.log(`Module ${moduleName} not found, skipping...`);
      continue;
    }
    
    // Look for the Android build.gradle
    const androidDir = path.join(modulePath, 'android');
    const buildGradlePath = path.join(androidDir, 'build.gradle');
    
    if (fs.existsSync(buildGradlePath)) {
      console.log(`Patching ${moduleName} build.gradle...`);
      let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
      
      // Check if it already has kotlinOptions
      if (buildGradle.includes('kotlinOptions {')) {
        // Replace the existing kotlinOptions
        buildGradle = buildGradle.replace(
          /kotlinOptions\s*\{[\s\S]*?\}/g,
          'kotlinOptions {\n    jvmTarget = JavaVersion.VERSION_17.toString()\n  }'
        );
      } else {
        // Add kotlinOptions after the android block opens
        buildGradle = buildGradle.replace(
          /android\s*\{/,
          'android {\n  kotlinOptions {\n    jvmTarget = JavaVersion.VERSION_17.toString()\n  }'
        );
      }
      
      // Check if it already has compileOptions
      if (buildGradle.includes('compileOptions {')) {
        // Replace the existing compileOptions
        buildGradle = buildGradle.replace(
          /compileOptions\s*\{[\s\S]*?\}/g,
          'compileOptions {\n    sourceCompatibility JavaVersion.VERSION_17\n    targetCompatibility JavaVersion.VERSION_17\n  }'
        );
      } else {
        // Add compileOptions after the android block opens or after kotlinOptions if we just added it
        if (buildGradle.includes('kotlinOptions {')) {
          buildGradle = buildGradle.replace(
            /kotlinOptions\s*\{[\s\S]*?\}/,
            match => match + '\n\n  compileOptions {\n    sourceCompatibility JavaVersion.VERSION_17\n    targetCompatibility JavaVersion.VERSION_17\n  }'
          );
        } else {
          buildGradle = buildGradle.replace(
            /android\s*\{/,
            'android {\n  compileOptions {\n    sourceCompatibility JavaVersion.VERSION_17\n    targetCompatibility JavaVersion.VERSION_17\n  }'
          );
        }
      }
      
      // Write the patched build.gradle file
      fs.writeFileSync(buildGradlePath, buildGradle);
      console.log(`Successfully patched ${moduleName}`);
    } else {
      console.log(`No build.gradle found for ${moduleName}, skipping...`);
    }
    
    // --- Begin new changes ---
    // Remove problematic import lines from the module's gradle fix file (if it exists)
    const fixFilePath = path.join(modulePath, 'android', 'gradle', 'jvm-fix.gradle');
    if (fs.existsSync(fixFilePath)) {
      let fixContent = fs.readFileSync(fixFilePath, 'utf8');
      const newFixContent = fixContent.replace(/^\s*import\s+org\.jetbrains\.kotlin\.gradle\.tasks\.KotlinCompile.*\n?/gm, '');
      if (newFixContent !== fixContent) {
        fs.writeFileSync(fixFilePath, newFixContent);
        console.log(`Removed problematic import from ${fixFilePath}`);
      }
    }
    // --- End new changes ---
  }
  
  console.log('Expo modules patching completed successfully');
  console.log('Modified build.gradle files in patched modules.');
  console.log('Patch process completed.');
  process.exit(0);
} catch (error) {
  console.error('Error patching Expo modules:', error);
  process.exit(1);
}
