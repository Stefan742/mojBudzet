const { withEntitlementsPlist } = require("expo/config-plugins");

/**
 * Removes the push-notification entitlement (`aps-environment`) that
 * expo-notifications always adds on iOS.
 *
 * The app only schedules local reminders on the device, which iOS allows
 * without it. Without the entitlement the App Store provisioning profile does
 * not need the Push Notifications capability, so the existing profile signs
 * the app. Remove this plugin if the app ever uses remote (push) notifications.
 *
 * Keep it FIRST in app.json's plugins: Expo runs entitlement mods in reverse
 * order, so it has to be listed before expo-notifications to run after it.
 */
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["aps-environment"];
    return mod;
  });
};
