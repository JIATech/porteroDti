/**
 * Simple script to modify gradle.properties for JVM compatibility
 * Designed to be run during EAS builds
 */

const fs = require('fs');
const path = require('path');

// Log start
console.log('Fixing JVM compatibility for EAS build...');

try {
  const androidDir = path.join(process.cwd(), 'android');
  const gradlePropsPath = path.join(androidDir, 'gradle.properties');
  
  if (!fs.existsSync(androidDir)) {
    console.log('Android directory not found. Skipping JVM fix.');
    process.exit(0);
  }
  
  if (!fs.existsSync(gradlePropsPath)) {
    console.log('gradle.properties not found. Skipping JVM fix.');
    process.exit(0);
  }

  // Read existing file
  let content = fs.readFileSync(gradlePropsPath, 'utf8');
  
  // Settings to add
  const newSettings = [
    '\n# Added by EAS hook for JVM compatibility',
    'kotlin.jvm.target.validation.mode=warning',
    'android.kotlinOptions.jvmTarget=17',
    'org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m'
  ].join('\n');
  
  // Only add if not already present
  if (!content.includes('kotlin.jvm.target.validation.mode')) {
    content += newSettings;
    fs.writeFileSync(gradlePropsPath, content);
    console.log('Successfully updated gradle.properties with JVM compatibility settings');
  } else {
    console.log('JVM compatibility settings already present in gradle.properties');
  }

  console.log('JVM compatibility fix completed successfully');
} catch (error) {
  console.error('Error running JVM compatibility fix:', error);
  // Exit with success to not break build - better to try to build even if this fails
  process.exit(0);
}
