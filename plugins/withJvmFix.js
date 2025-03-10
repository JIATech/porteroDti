const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to fix JVM target compatibility issues in Android builds
 * by configuring Kotlin compilation options using literal values.
 */
const withJvmFix = (config) => {
  return {
    ...config,
    mods: {
      ...config.mods,
      android: {
        ...(config.mods?.android || {}),
        // This function runs after the Android project is created during prebuild
        async postBuild(_, { modRequest }) {
          const { projectRoot } = modRequest;
          console.log('Running JVM fix for Expo modules...');
          
          // Create standard kotlin-ext.gradle with literal values
          const kotlinExtGradlePath = path.join(projectRoot, 'android', 'kotlin-ext.gradle');
          const kotlinExtGradleContent = `// Force JVM targets to be consistent across all modules
allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions { jvmTarget = "17" }
    }
    afterEvaluate {
        android { compileOptions { sourceCompatibility = "17"; targetCompatibility = "17" } }
    }
}`;
          
          fs.writeFileSync(kotlinExtGradlePath, kotlinExtGradleContent);
          
          // Create an aggressive kotlin-jvm-fix.gradle using literal "17"
          const kotlinJvmFixPath = path.join(projectRoot, 'android', 'kotlin-jvm-fix.gradle');
          const kotlinJvmFixContent = `// Force consistent JVM target for all modules including Expo modules
gradle.projectsEvaluated {
    rootProject.allprojects { project ->
        // Force all Kotlin compile tasks to use JVM target "17"
        project.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
            kotlinOptions { jvmTarget = "17" }
        }
        
        // Force all Java compile tasks to use source & target compatibility "17"
        project.tasks.withType(JavaCompile).configureEach {
            sourceCompatibility = "17"
            targetCompatibility = "17"
        }
        
        // For Android projects, also patch compileOptions (using literal values)
        if (project.hasProperty('android')) {
            project.android {
                compileOptions { sourceCompatibility "17"; targetCompatibility "17" }
            }
        }
        
        println "Applied JVM 17 targets to project: ${project.name}"
    }
}`;
          
          fs.writeFileSync(kotlinJvmFixPath, kotlinJvmFixContent);
          
          // Patch the root build.gradle to include our gradle files
          const rootBuildGradlePath = path.join(projectRoot, 'android', 'build.gradle');
          let rootBuildGradleContent = fs.readFileSync(rootBuildGradlePath, 'utf8');
          
          if (!rootBuildGradleContent.includes('kotlin-ext.gradle')) {
            // Insert after the line with the root project plugin
            const applyPluginLine = 'apply plugin: "com.facebook.react.rootproject"';
            const insertPoint = rootBuildGradleContent.indexOf(applyPluginLine) + applyPluginLine.length;
            rootBuildGradleContent = 
              rootBuildGradleContent.substring(0, insertPoint) + 
              '\n// Apply our custom Kotlin JVM configuration\napply from: file("kotlin-ext.gradle")' +
              rootBuildGradleContent.substring(insertPoint);
          }
          
          if (!rootBuildGradleContent.includes('kotlin-jvm-fix.gradle')) {
            // Append our JVM fix at the very end
            rootBuildGradleContent += '\n// Apply our JVM fix after all projects are evaluated\napply from: file("kotlin-jvm-fix.gradle")\n';
          }
          
          fs.writeFileSync(rootBuildGradlePath, rootBuildGradleContent);
          
          // Update gradle.properties with plain values (if needed)
          const gradlePropertiesPath = path.join(projectRoot, 'android', 'gradle.properties');
          let gradleProperties = fs.readFileSync(gradlePropertiesPath, 'utf8');
          
          const settings = [
            '\n# Added by Expo config plugin for JVM compatibility',
            'kotlin.jvm.target.validation.mode=warning',
            'android.kotlinOptions.jvmTarget=17',
            'org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m'
          ].join('\n');
          
          if (!gradleProperties.includes('kotlin.jvm.target.validation.mode')) {
            gradleProperties += settings;
            fs.writeFileSync(gradlePropertiesPath, gradleProperties);
          }
          
          console.log('Successfully applied JVM compatibility fixes');
        }
      }
    }
  };
};

module.exports = withJvmFix;
