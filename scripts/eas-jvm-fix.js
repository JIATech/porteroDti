#!/usr/bin/env node
// Reset process.argv to ignore any extra arguments passed by EAS (e.g. --platform)
process.argv = process.argv.slice(0, 2);

/**
 * Simple script to directly patch Expo modules for JVM compatibility
 * Specifically designed for use with EAS builds
 */
console.log('Starting direct JVM compatibility fix for Expo modules...');

const fs = require('fs');
const path = require('path');

// Skip platform checking - just run the patching regardless
try {
  // Problem modules
  const problemModules = [
    'expo-application',
    'expo-asset',
    'expo-av',
    'expo-constants',
    'expo-modules-core'
  ];
  
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  
  for (const moduleName of problemModules) {
    const modulePath = path.join(nodeModulesPath, moduleName);
    if (!fs.existsSync(modulePath)) {
      console.log(`Module ${moduleName} not found, skipping...`);
      continue;
    }
    
    const buildGradlePath = path.join(modulePath, 'android', 'build.gradle');
    if (!fs.existsSync(buildGradlePath)) {
      console.log(`build.gradle not found for ${moduleName}, skipping...`);
      continue;
    }
    
    console.log(`Patching ${moduleName}...`);
    
    const hookDir = path.join(modulePath, 'android', 'gradle');
    const hookPath = path.join(hookDir, 'jvm-fix.gradle');
    if (!fs.existsSync(hookDir)) {
      fs.mkdirSync(hookDir, { recursive: true });
    }
    
    const hookContent = `
import org.gradle.api.tasks.compile.JavaCompile
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

tasks.withType(JavaCompile) {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.withType(KotlinCompile) {
    kotlinOptions {
        jvmTarget = "17"
    }
}

android {
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

println "Applied JVM 17 compatibility fix to \${project.name}"
`;
    fs.writeFileSync(hookPath, hookContent);
    
    let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
    if (!buildGradleContent.includes('jvm-fix.gradle')) {
      buildGradleContent += '\n// Apply JVM compatibility fix\napply from: file("gradle/jvm-fix.gradle")\n';
      fs.writeFileSync(buildGradlePath, buildGradleContent);
    }
    
    console.log(`Successfully patched ${moduleName}`);
  }
  
  console.log('Completed patching Expo modules for JVM compatibility');
  process.exit(0);
} catch (error) {
  console.error('Error while patching Expo modules:', error);
  process.exit(0);
}
