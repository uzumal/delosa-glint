// Jest test setup
// Add global test utilities and mocks here

// Mock chrome APIs for testing
Object.assign(global, {
  chrome: {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn(),
      },
    },
    runtime: {
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
      },
      onInstalled: {
        addListener: jest.fn(),
      },
      onStartup: {
        addListener: jest.fn(),
      },
    },
    alarms: {
      create: jest.fn(),
      onAlarm: {
        addListener: jest.fn(),
      },
    },
  },
});
