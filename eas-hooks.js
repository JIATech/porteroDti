#!/usr/bin/env node

// This script is designed to work with EAS, which passes additional arguments
// like --platform android that we need to handle or ignore properly

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('Starting EAS prebuild hook');
console.log('Command arguments:', process.argv);

// Filter out any EAS-specific arguments
const args = process.argv.filter(arg => !arg.startsWith('--platform'));

// Run our JVM compatibility fix
try {
  // Check if android folder exists before proceeding
  const androidDir = path.join(process.cwd(), 'android');
  if (!fs.existsSync(androidDir)) {
    console.log('Android directory not found, skipping JVM compatibility fix');
    process.exit(0);
  }

  // Path to gradle.properties
  const gradlePropertiesPath = path.join(androidDir, 'gradle.properties');
  
  if (!fs.existsSync(gradlePropertiesPath)) {
    console.log(`gradle.properties not found at ${gradlePropertiesPath}, skipping JVM compatibility fix`);
    process.exit(0);
  }

  // Read the current content
  let content = fs.readFileSync(gradlePropertiesPath, 'utf8');
  
  // Add our JVM compatibility settings if they're not already there
  const settings = [
    '\n# Added by EAS prebuild hook',
    'kotlin.jvm.target.validation.mode=warning',
    'android.kotlinOptions.jvmTarget=17',
    'org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m'
  ];
  
  // Only add settings if they don't already exist
  let modified = false;
  for (const setting of settings) {
    const propertyName = setting.split('=')[0].trim();
    if (!content.includes(propertyName) && !propertyName.startsWith('#')) {
      content += setting + '\n';
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(gradlePropertiesPath, content);
    console.log('Added JVM compatibility settings to gradle.properties');
  } else {
    console.log('JVM compatibility settings already exist in gradle.properties');
  }
  
  console.log('EAS prebuild hook completed successfully');
} catch (error) {
  console.error('Error in EAS prebuild hook:', error);
  process.exit(1);
}
