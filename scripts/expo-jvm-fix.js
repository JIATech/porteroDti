#!/usr/bin/env node
// This is an Expo CLI plugin to fix JVM compatibility issues in Expo modules

/**
 * This script follows Expo CLI plugin format to be compatible with EAS
 * and properly handle the --platform argument that EAS passes
 */

// Extract the platform from args (EAS will pass --platform android)
const args = process.argv.slice(2);
const platformIndex = args.indexOf('--platform');
const platform = platformIndex >= 0 && platformIndex < args.length - 1 ? args[platformIndex + 1] : null;

// Only proceed if platform is android or not specified
if (platform && platform !== 'android') {
  console.log(`Platform ${platform} doesn't need JVM compatibility fixes, skipping.`);
  process.exit(0);
}

// Since we're continuing, proceed with the actual patching
console.log('Starting JVM compatibility fixes for Expo modules...');

const fs = require('fs');
const path = require('path');

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
    
    // Path to module's build.gradle
    const buildGradlePath = path.join(modulePath, 'android', 'build.gradle');
    if (!fs.existsSync(buildGradlePath)) {
      console.log(`build.gradle not found for ${moduleName}, skipping...`);
      continue;
    }
    
    console.log(`Patching ${moduleName}...`);
    
    // Create direct hook script for this module
    const hookDir = path.join(modulePath, 'android', 'gradle');
    const hookPath = path.join(hookDir, 'jvm-fix.gradle');
    
    // Ensure hook directory exists
    if (!fs.existsSync(hookDir)) {
      fs.mkdirSync(hookDir, { recursive: true });
    }
    
    // Create hook script content
    const hookContent = `
// Direct JVM target fix for ${moduleName}
import org.gradle.api.tasks.compile.JavaCompile
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

// Force Java 17 for all compile tasks in this module
tasks.withType(JavaCompile) {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

// Force JVM target 17 for all Kotlin compile tasks in this module
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
    
    // Write the hook file
    fs.writeFileSync(hookPath, hookContent);
    
    // Now modify the build.gradle to apply our hook
    let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
    
    // Check if our hook is already applied
    if (!buildGradleContent.includes('jvm-fix.gradle')) {
      // Add the apply statement at the end of the file
      buildGradleContent += '\n// Apply JVM compatibility fix\napply from: file("gradle/jvm-fix.gradle")\n';
      fs.writeFileSync(buildGradlePath, buildGradleContent);
    }
    
    console.log(`Successfully patched ${moduleName}`);
  }
  
  console.log('Completed patching Expo modules for JVM compatibility');
  process.exit(0);
} catch (error) {
  console.error('Error while patching Expo modules:', error);
  // Exit with success code to not break the build
  process.exit(0);
}
