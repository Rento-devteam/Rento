import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  YandexGeocoderResponseError,
  YandexGeocoderResponseOk,
  YandexGeoObject,
} from './yandex-geocoder.types';
import { getYandexGeocoderApiKeyTrimmed } from '../config/yandex-geocoder-api-key';

export type GeocodeResult = {
  addressText: string;
  latitude: number;
  longitude: number;
};

const YANDEX_GEOCODE_URL = 'https://geocode-maps.yandex.ru/v1/';

/**
 * Parse Yandex `Point.pos` — два числа через пробел; в ответах HTTP Геокодера
 * задаётся как «долгота широта» (совпадает с порядком в GeoJSON-кольце Яндекса).
 */
export function parseYandexPos(pos: string): { latitude: number; longitude: number } {
  const parts = pos.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new BadGatewayException('Некорректный ответ геокодера (координаты)');
  }
  const longitude = Number(parts[0]);
  const latitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new BadGatewayException('Некорректный ответ геокодера (координаты)');
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new BadGatewayException('Координаты вне допустимого диапазона');
  }
  return { latitude, longitude };
}

function addressTextFromGeoObject(go: YandexGeoObject): string {
  const meta = go.metaDataProperty?.GeocoderMetaData;
  const fromAddr = meta?.Address?.formatted?.trim();
  const fromText = meta?.text?.trim();
  const text = fromAddr || fromText;
  return text ?? '';
}

@Injectable()
export class GeoService {
  /** Сначала `process.env`, иначе чтение `.env` с диска (см. `yandex-geocoder-api-key`). */
  private getApiKeyTrimmed(): string {
    return getYandexGeocoderApiKeyTrimmed(__dirname);
  }

  assertConfigured(): void {
    if (!this.getApiKeyTrimmed()) {
      throw new ServiceUnavailableException(
        'Геокодирование не настроено: задайте YANDEX_GEOCODER_API_KEY в deploy/.env или packages/backend/.env и перезапустите процесс Nest',
      );
    }
  }

  /** Address / place name → coordinates + normalized text. */
  async geocodeForward(queryRaw: string): Promise<GeocodeResult> {
    this.assertConfigured();
    const apiKey = this.getApiKeyTrimmed();
    const query = queryRaw.trim();
    if (query.length < 2) {
      throw new BadRequestException('Слишком короткий запрос');
    }

    const url = new URL(YANDEX_GEOCODE_URL);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('lang', 'ru_RU');
    url.searchParams.set('results', '1');
    url.searchParams.set('geocode', query);

    return this.fetchAndMapFirst(url);
  }

  /** Coordinates → address text + same coordinates (normalized). */
  async geocodeReverse(
    latitude: number,
    longitude: number,
  ): Promise<GeocodeResult> {
    this.assertConfigured();
    const apiKey = this.getApiKeyTrimmed();
    const geocode = `${longitude},${latitude}`;
    const url = new URL(YANDEX_GEOCODE_URL);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('lang', 'ru_RU');
    url.searchParams.set('results', '1');
    url.searchParams.set('geocode', geocode);

    return this.fetchAndMapFirst(url);
  }

  private async fetchAndMapFirst(url: URL): Promise<GeocodeResult> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);

    let res: Response;
    try {
      res = await fetch(url.toString(), { signal: ctrl.signal });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadGatewayException(`Геокодер недоступен: ${msg}`);
    } finally {
      clearTimeout(t);
    }

    const rawText = await res.text().catch(() => '');
    let json: unknown;
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new BadGatewayException('Некорректный ответ геокодера (не JSON)');
    }

    if (!res.ok) {
      const err = json as YandexGeocoderResponseError;
      const detail = typeof err.message === 'string' ? err.message : res.statusText;
      throw new BadGatewayException(
        `Ответ геокодера ${res.status}${detail ? `: ${detail}` : ''}`,
      );
    }

    if (
      json &&
      typeof json === 'object' &&
      'statusCode' in json &&
      (json as YandexGeocoderResponseError).statusCode != null &&
      typeof (json as YandexGeocoderResponseError).message === 'string'
    ) {
      const err = json as YandexGeocoderResponseError;
      throw new BadGatewayException(
        typeof err.message === 'string' ? err.message : 'Ошибка геокодера',
      );
    }

    const ok = json as YandexGeocoderResponseOk;
    const members = ok.response?.GeoObjectCollection?.featureMember;
    const first = members?.[0]?.GeoObject;
    const pos = first?.Point?.pos;
    if (!first || !pos) {
      throw new BadRequestException('Адрес не найден — уточните формулировку');
    }

    const coords = parseYandexPos(pos);
    const addressText = addressTextFromGeoObject(first);
    if (!addressText) {
      throw new BadGatewayException('Геокодер не вернул текст адреса');
    }

    return {
      addressText,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
  }
}
