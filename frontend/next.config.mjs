/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // @metamask/sdk pulls in React Native deps that don't exist in a browser build
    config.resolve.alias["@react-native-async-storage/async-storage"] = false;
    // pino optionally requires pino-pretty which isn't installed
    config.resolve.alias["pino-pretty"] = false;
    return config;
  },
};

export default nextConfig;
