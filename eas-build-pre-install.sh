#!/bin/bash

# Log the start of our custom script
echo "Running custom pre-install script to fix JVM compatibility..."

# Path to gradle.properties in the EAS build environment
GRADLE_PROPERTIES_PATH="./android/gradle.properties"

# Add JVM compatibility settings to gradle.properties
echo "# Added by pre-install script" >> $GRADLE_PROPERTIES_PATH
echo "kotlin.jvm.target.validation.mode=warning" >> $GRADLE_PROPERTIES_PATH
echo "android.kotlinOptions.jvmTarget=17" >> $GRADLE_PROPERTIES_PATH
echo "org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m" >> $GRADLE_PROPERTIES_PATH

echo "Added JVM compatibility settings to gradle.properties"

# Make all Kotlin plugins use Java 17
# This targets specific expo modules that might have hardcoded JVM targets
echo "Setting up project.ext in build.gradle files..."

find ./node_modules -name "build.gradle" -type f -exec grep -l "kotlin" {} \; | while read -r file; do
  if ! grep -q "project.ext.javaVersion" "$file"; then
    sed -i.bak '1s/^/project.ext.javaVersion = JavaVersion.VERSION_17\n/' "$file"
    echo "Modified $file to include Java version"
  fi
done

echo "Pre-install script completed successfully"
