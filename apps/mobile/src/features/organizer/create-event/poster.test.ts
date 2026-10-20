import { pickPoster } from './poster';

const mockLaunch = jest.fn();
const mockResize = jest.fn();
const mockSave = jest.fn();

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunch(...args),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: (size: unknown) => mockResize(size),
      renderAsync: async () => ({ saveAsync: (options: unknown) => mockSave(options) }),
    }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue({ uri: 'file:///cache/affiche.jpg', width: 1080, height: 1350 });
});

describe('choix de l’affiche', () => {
  it('photo large : réduite à 1080 px et compressée en JPEG', async () => {
    mockLaunch.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photo.heic', width: 3024, height: 3780 }],
    });
    expect(await pickPoster()).toEqual({
      uri: 'file:///cache/affiche.jpg',
      width: 1080,
      height: 1350,
    });
    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5] }),
    );
    expect(mockResize).toHaveBeenCalledWith({ width: 1080 });
    expect(mockSave).toHaveBeenCalledWith({ compress: 0.7, format: 'jpeg' });
  });

  it('image déjà petite : pas agrandie, mais recompressée', async () => {
    mockLaunch.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///petite.png', width: 800, height: 1000 }],
    });
    await pickPoster();
    expect(mockResize).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });

  it('galerie fermée sans choix : null', async () => {
    mockLaunch.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickPoster()).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
  });
});
