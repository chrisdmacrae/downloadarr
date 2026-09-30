import { OrganizationRulesService } from './organization-rules.service';
import { ContentType } from '../../../generated/prisma';

describe('OrganizationRulesService music paths', () => {
  const setup = (rule: Record<string, unknown> | null = null) => {
    const prisma: any = {
      organizationRule: {
        findFirst: jest.fn(async () => rule),
        // No rule saved yet: the default is created and returned.
        create: jest.fn(async ({ data }) => ({ basePath: null, ...data })),
      },
      organizationSettings: {
        findFirst: jest.fn(async () => ({ libraryPath: '/library', musicPath: null })),
      },
    };
    const config: any = { get: (_key: string, fallback: string) => fallback };
    return new OrganizationRulesService(prisma, config);
  };

  const context = (overrides = {}) => ({
    contentType: ContentType.MUSIC,
    title: 'In Rainbows',
    artist: 'Radiohead',
    year: 2007,
    originalPath: '/downloads/music/In Rainbows/01 - 15 Step.flac',
    fileName: '01 - 15 Step.flac',
    ...overrides,
  });

  it('files albums as music/Artist/Album (Year)/track', async () => {
    const result = await setup().generateOrganizedPath(context());
    expect(result.fullPath).toBe('/library/music/Radiohead/In Rainbows (2007)/01 - 15 Step.flac');
  });

  it('keeps disc folders for multi-disc albums', async () => {
    const result = await setup().generateOrganizedPath(context({ subfolder: 'CD2' }));
    expect(result.folderPath).toBe('/library/music/Radiohead/In Rainbows (2007)/CD2');
  });

  it('drops empty parentheses when the year is unknown', async () => {
    const result = await setup().generateOrganizedPath(context({ year: undefined }));
    expect(result.folderPath).toBe('/library/music/Radiohead/In Rainbows');
  });

  it('sanitizes each level on its own', async () => {
    const result = await setup().generateOrganizedPath(context({ artist: 'AC/DC', title: 'Back in Black: Live?' }));
    expect(result.folderPath).toBe('/library/music/AC-DC/Back in Black_ Live (2007)');
  });
});
