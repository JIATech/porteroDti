const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

const withWebRTC = (config) => {
  // Add Android permissions
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Ensure permissions exist
    if (!androidManifest.manifest.uses-permission) {
      androidManifest.manifest['uses-permission'] = [];
    }
    
    // Add required permissions
    const permissions = [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.CHANGE_NETWORK_STATE',
      'android.permission.MODIFY_AUDIO_SETTINGS',
    ];
    
    permissions.forEach(permission => {
      if (!androidManifest.manifest['uses-permission'].find(p => p.$['android:name'] === permission)) {
        androidManifest.manifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    });
    
    return config;
  });
  
  // Add iOS permissions
  config = withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    
    // Ensure camera and microphone permissions
    infoPlist.NSCameraUsageDescription = infoPlist.NSCameraUsageDescription || 
      'Esta aplicación necesita acceso a la cámara para realizar videollamadas';
    infoPlist.NSMicrophoneUsageDescription = infoPlist.NSMicrophoneUsageDescription || 
      'Esta aplicación necesita acceso al micrófono para realizar videollamadas';
      
    return config;
  });
  
  return config;
};

module.exports = withWebRTC;
