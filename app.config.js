require("dotenv").config();

module.exports = ({ config }) => {
  config.android = config.android || {};
  config.android.config = config.android.config || {};
  config.android.config.googleMaps = {
    apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
  };

  return config;
};
