import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extractYandexKeyFromDotenvFile } from './yandex-geocoder-api-key';

describe('extractYandexKeyFromDotenvFile', () => {
  let dir = '';
  let filePath = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rento-geok-'));
    filePath = path.join(dir, '.env');
  });

  afterEach(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      //
    }
  });

  it('parses bare assignment', () => {
    fs.writeFileSync(filePath, `YANDEX_GEOCODER_API_KEY=abc-def-012\n`, 'utf8');
    expect(extractYandexKeyFromDotenvFile(filePath)).toBe('abc-def-012');
  });

  it('parses quoted value', () => {
    fs.writeFileSync(
      filePath,
      `YANDEX_GEOCODER_API_KEY="quoted-key"\r\n`,
      'utf8',
    );
    expect(extractYandexKeyFromDotenvFile(filePath)).toBe('quoted-key');
  });
});
