import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hnchs.neurolearnx",
  appName: "NeuroLearn-X",
  webDir: "dist",
  backgroundColor: "#071b34",
  android: {
    allowMixedContent: false,
    backgroundColor: "#071b34",
    androidScheme: "https",
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    CapacitorCookies: {
      enabled: true,
    },
  },
};

export default config;
