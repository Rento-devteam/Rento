# Настройка S3 (Yandex Object Storage)

Этот гайд нужен для подключения S3-совместимого хранилища в Yandex Cloud для frontend/backend сценариев (например, загрузка вложений для Escrow).

## 1) Создайте бакет

1. Откройте Yandex Cloud Console -> Object Storage.
2. Создайте bucket, например `rento-escrow-files`.
3. Выберите регион (например, `ru-central1`).
4. Для приватных файлов оставьте **Private** (рекомендуется для Escrow-документов).

## 2) Создайте сервисный аккаунт и права

1. В IAM создайте Service Account, например `rento-s3-sa`.
2. Выдайте роль минимум `storage.editor` на каталог/бакет.
3. Создайте статический access key:
   - `Access key ID`
   - `Secret access key`

## 3) Сохраните переменные окружения

Пример для backend:

```env
S3_ENDPOINT=https://storage.yandexcloud.net
S3_REGION=ru-central1
S3_BUCKET=rento-escrow-files
S3_ACCESS_KEY_ID=your_access_key_id
S3_SECRET_ACCESS_KEY=your_secret_access_key
S3_FORCE_PATH_STYLE=false
```

## 4) Настройте CORS бакета (если frontend грузит напрямую)

Добавьте CORS-конфиг для вашего домена frontend:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://your-frontend-domain"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## 5) Выберите схему загрузки

- Рекомендуется: frontend запрашивает у backend `presigned URL`, затем загружает файл напрямую в S3.
- Backend хранит в БД только ключ объекта (`objectKey`) и метаданные.

## 6) Проверка подключения

1. Сгенерируйте presigned URL на backend.
2. Выполните загрузку тестового файла (`PUT`).
3. Убедитесь, что объект появился в bucket.
4. Проверьте чтение/доступ по вашей политике (private/public/signed).

## 7) Безопасность для production

- Не храните секретный ключ в frontend.
- Используйте отдельные бакеты/префиксы для `dev`/`prod`.
- Ограничьте IAM права (по принципу минимально необходимых).
- Добавьте lifecycle policy для временных/черновых файлов.
