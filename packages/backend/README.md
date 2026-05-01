<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Local database (demo seed)

Содержимое таблиц после `TRUNCATE` или удаления **не восстановить** без бэкапа. Чтобы снова завести **минимальный демо-набор** (категория, пользователь, черновик объявления), из каталога `packages/backend` выполните:

```bash
npm run seed:demo-listing
```

В консоль выводятся `demoEmail` и `demoPassword`.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Search (Elasticsearch, UC-09)

Local stack includes Elasticsearch on port **9200** (`docker compose -f docker-compose.dev.yml up -d`). Set `ELASTICSEARCH_NODE` in `.env` (see `.env.example`). The app creates index `rento-listings` (override with `ELASTICSEARCH_LISTINGS_INDEX`) on startup.

**HTTP**

- `GET /search` — query params: `q`, `page`, `limit`, `categoryId`, `minPrice`, `maxPrice`, `lat`, `lon`, `distanceKm`, `sort` (`relevance` | `price_asc` | `price_desc` | `newest`). Response: `results`, `totalCount`, `emptyResults`, `suggestion`, `relaxedMatch`, `popularCategories` (when empty).
- `GET /search/autocomplete?q=…&limit=…` — JSON array of title strings.

Active listings are indexed when published (`POST /listings/:id/publish`). Backfill: `npm run search:reindex`.

**E2E tests** stub `ListingSearchIndexService`, so they do not require a running Elasticsearch node. To exercise search against a real cluster, run ES locally and hit the HTTP endpoints manually with `ELASTICSEARCH_NODE` set.

## Геокодирование (Yandex, только бэкенд)

Ключ **не** отдаётся в браузер: фронт вызывает защищённые JWT-эндпоинты, бэкенд ходит в [HTTP Геокодер](https://yandex.ru/maps-api/docs/geocoder-api/index.html).

**Регистрация ключа**

1. [Кабинет разработчика Яндекс](https://developer.tech.yandex.ru/) (или облачная консоль для продуктов карт — актуальный раздел «JavaScript API и HTTP Геокодер» / API-ключи карт).
2. Создайте ключ с доступом к **HTTP Геокодеру** (отдельно от ключа для JS API на фронте).
3. В проде и локально задайте переменную **`YANDEX_GEOCODER_API_KEY`** (например в `deploy/.env`, файл подключается к сервису `backend` в `deploy/docker-compose.yml`).

Без ключа методы возвращают `503 Service Unavailable` с пояснением.

**HTTP (нужен `Authorization: Bearer …`)**

- `POST /geo/geocode` — тело `{ "query": "Москва, Тверская 1" }` → `{ addressText, latitude, longitude }`.
- `POST /geo/reverse-geocode` — тело `{ "latitude": …, "longitude": … }` → то же самое.

Сохранение в профиль / объявление: поля приходят с фронта после ответа геокодера — `PATCH /users/me` (`addressText`, пара `addressLatitude` / `addressLongitude`, очистка координат — оба `null`) и создание/редактирование объявления (`addressText`, `latitude`, `longitude`).

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
