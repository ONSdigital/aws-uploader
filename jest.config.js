module.exports = {
  testMatch: [
      "**/test/**/*.test.mjs",
      "**/test/**/*.test.js"
  ],
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/test/jest.setup.js"],
  transform: {},
};
