import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileOrganizationService } from './file-organization.service';
import { ContentType } from '../../../generated/prisma';

describe('FileOrganizationService', () => {
  let root: string;
  let destination: string;
  let prisma: any;
  let service: FileOrganizationService;

  const write = async (filePath: string, content: string) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  };

  const organize = (originalPath: string) =>
    service.organizeFile({
      contentType: ContentType.TV_SHOW,
      title: 'Severance',
      year: 2022,
      season: 1,
      episode: 1,
      originalPath,
      fileName: path.basename(originalPath),
    });

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'organize-'));
    destination = path.join(root, 'library', 'Severance (2022)', 'Season 01', 'Severance.S01E01.mkv');
    prisma = { organizedFile: { create: jest.fn() } };

    const rules: any = {
      getSettings: jest.fn(async () => ({ extractArchives: false, replaceExistingFiles: true })),
      generateOrganizedPath: jest.fn(async () => ({
        folderPath: path.dirname(destination),
        fileName: path.basename(destination),
        fullPath: destination,
      })),
    };

    service = new FileOrganizationService(prisma, rules);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('leaves a file alone that is already where it belongs', async () => {
    await write(destination, 'episode');

    const result = await organize(destination);

    expect(result.success).toBe(true);
    expect(await fs.readFile(destination, 'utf8')).toBe('episode');
  });

  it('replaces an existing file with the new download', async () => {
    const download = path.join(root, 'downloads', 'Severance.S01E01.mkv');
    await write(destination, 'old');
    await write(download, 'new');

    const result = await organize(download);

    expect(result.success).toBe(true);
    expect(await fs.readFile(destination, 'utf8')).toBe('new');
    await expect(fs.access(download)).rejects.toThrow();
  });

  it('keeps the existing file when the move fails', async () => {
    const download = path.join(root, 'downloads', 'Severance.S01E01.mkv');
    await write(destination, 'old');
    await write(download, 'new');
    const rename = jest.spyOn(fs, 'rename').mockRejectedValueOnce(Object.assign(new Error('EACCES'), { code: 'EACCES' }));

    const result = await organize(download);
    rename.mockRestore();

    expect(result.success).toBe(false);
    expect(await fs.readFile(destination, 'utf8')).toBe('old');
    expect(await fs.readFile(download, 'utf8')).toBe('new');
  });
});
