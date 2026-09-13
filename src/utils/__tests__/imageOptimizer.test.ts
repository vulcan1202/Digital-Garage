jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openSettings: jest.fn(),
  },
}));

import { optimizeImage } from '../imageOptimizer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => {
  const resizeMock = jest.fn().mockReturnThis();
  const saveAsyncMock = jest.fn().mockResolvedValue({
    uri: 'file://mock-optimized.jpg',
    width: 1920,
    height: 1080,
  });
  const renderAsyncMock = jest.fn().mockResolvedValue({
    saveAsync: saveAsyncMock,
  });

  return {
    ImageManipulator: {
      manipulate: jest.fn(() => ({
        resize: resizeMock,
        renderAsync: renderAsyncMock,
      })),
    },
    SaveFormat: {
      JPEG: 'jpeg',
    },
  };
});

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', canAskAgain: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', canAskAgain: true }),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
  },
}));

describe('imageOptimizer', () => {
  it('應使用現代鏈式 API (ImageManipulator.manipulate) 最佳化圖片，最長邊縮放為 1920px 且以 JPEG 0.8 壓縮', async () => {
    const result = await optimizeImage('file://photo.jpg', 3840, 2160);

    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file://photo.jpg');
    expect(result.uri).toBe('file://mock-optimized.jpg');
    expect(result.width).toBe(1920);
  });
});
