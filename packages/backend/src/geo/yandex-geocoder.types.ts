/** Subset of Yandex Geocoder HTTP JSON (format=json). */
export interface YandexGeoObject {
  metaDataProperty?: {
    GeocoderMetaData?: {
      text?: string;
      Address?: {
        formatted?: string;
      };
    };
  };
  Point?: {
    /** Два числа через пробел: долгота, затем широта. */
    pos?: string;
  };
}

export interface YandexGeocoderResponseOk {
  response?: {
    GeoObjectCollection?: {
      featureMember?: Array<{
        GeoObject?: YandexGeoObject;
      }>;
    };
  };
}

export interface YandexGeocoderResponseError {
  statusCode?: number;
  message?: string;
  error?: string;
}
