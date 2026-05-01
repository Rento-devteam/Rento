import { BadGatewayException } from '@nestjs/common';
import { parseYandexPos } from './geo.service';

describe('parseYandexPos', () => {
  it('parses longitude then latitude', () => {
    expect(parseYandexPos('37.618423 55.751244')).toEqual({
      longitude: 37.618423,
      latitude: 55.751244,
    });
  });

  it('rejects malformed pos', () => {
    expect(() => parseYandexPos('')).toThrow(BadGatewayException);
    expect(() => parseYandexPos('55.75')).toThrow(BadGatewayException);
    expect(() => parseYandexPos('x y')).toThrow(BadGatewayException);
  });

  it('rejects coordinates out of WGS84 range', () => {
    expect(() => parseYandexPos('200 0')).toThrow(BadGatewayException);
    expect(() => parseYandexPos('0 100')).toThrow(BadGatewayException);
  });
});
