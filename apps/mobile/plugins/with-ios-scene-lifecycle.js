const {
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
  IOSConfig,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SCENE_DELEGATE_SOURCE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

/**
 * Adopt UIKit scene lifecycle required by the iOS 27 SDK (TN3187).
 * Expo SDK 57.0.24 ships ExpoAppSceneDelegate; the published prebuild
 * template still boots RN from AppDelegate, which SIGTRAPs on device.
 */
function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
      const appDir = path.join(projectRoot, projectName);

      const scenePath = path.join(appDir, 'SceneDelegate.swift');
      fs.writeFileSync(scenePath, SCENE_DELEGATE_SOURCE);

      const appDelegatePath = path.join(appDir, 'AppDelegate.swift');
      if (fs.existsSync(appDelegatePath)) {
        let src = fs.readFileSync(appDelegatePath, 'utf8');
        if (!src.includes('ExpoReactNativeFactoryProvider')) {
          src = src.replace(
            'class AppDelegate: ExpoAppDelegate {',
            'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
          );
        }
        // Remove AppDelegate window/RN startup; SceneDelegate owns it on iOS 27+.
        src = src.replace(
          /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)\s*#endif\s*/m,
          '// Window + React Native start in SceneDelegate (iOS 27 scene lifecycle).\n    ',
        );
        fs.writeFileSync(appDelegatePath, src);
      }

      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const filePath = `${projectName}/SceneDelegate.swift`;
    const already = project.hasFile?.(filePath) || JSON.stringify(project).includes('SceneDelegate.swift');
    if (!already) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: filePath,
        groupName: projectName,
        project,
      });
    }
    return cfg;
  });

  return config;
}

module.exports = withIosSceneLifecycle;
