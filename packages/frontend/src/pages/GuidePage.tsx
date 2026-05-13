import { Link } from "react-router-dom";

type GuideStep = {
  id: string;
  title: string;
  text: string;
  icon: "search" | "user" | "listing" | "booking" | "shield";
};

const STEPS: GuideStep[] = [
  {
    id: "catalog",
    title: "Каталог и поиск",
    text: "На главной выберите раздел или введите запрос. «Фильтры» ограничивают цену, сортировку и тип аренды. Карточка ведёт к фото, условиям и календарю доступности.",
    icon: "search",
  },
  {
    id: "account",
    title: "Аккаунт и профиль",
    text: "Войдите или зарегистрируйтесь, чтобы сдавать и арендовать. В профиле укажите контакты и адрес, при необходимости привяжите карту для расчётов с блокировкой средств (escrow).",
    icon: "user",
  },
  {
    id: "listing",
    title: "Объявление",
    text: "Кнопка «+» в шапке открывает форму: категория, цена, период, описание и место выдачи. После черновика загрузите фото и опубликуйте — объявление появится в каталоге.",
    icon: "listing",
  },
  {
    id: "booking",
    title: "Бронирование",
    text: "На странице вещи выберите даты и пройдите шаги бронирования. Перед оплатой изучите условия и типовой договор: просмотр в окне и выгрузка в PDF.",
    icon: "booking",
  },
  {
    id: "safety",
    title: "Безопасность",
    text: "Договаривайтесь ясно, фиксируйте состояние при передаче. Споры решайте по переписке в сервисе и договору; Rento — площадка, а не замена юристу.",
    icon: "shield",
  },
];

function GuideIcon({ kind }: { kind: GuideStep["icon"] }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
  };
  switch (kind) {
    case "search":
      return (
        <svg {...common}>
          <circle
            cx="11"
            cy="11"
            r="6.5"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M20 20l-4.2-4.2"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle
            cx="12"
            cy="9"
            r="3.25"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M6.2 20.2c.9-3.1 3.5-5 5.8-5s4.9 1.9 5.8 5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "listing":
      return (
        <svg {...common}>
          <rect
            x="4.5"
            y="5"
            width="15"
            height="14"
            rx="2.25"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M8 10h8M8 14h5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "booking":
      return (
        <svg {...common}>
          <rect
            x="4"
            y="5"
            width="16"
            height="15"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M4 9.5h16M8 3.5v3M16 3.5v3"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path
            d="M12 21s-6.5-3.8-6.5-9.4V6.3L12 3l6.5 3.3v5.3C18.5 17.2 12 21 12 21z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function GuidePage() {
  return (
    <main className="guide-page">
      <header className="guide-hero">
        <div className="guide-hero__deco" aria-hidden="true">
          <div className="guide-hero__mesh" />
          <div className="guide-hero__orb guide-hero__orb--a" />
          <div className="guide-hero__orb guide-hero__orb--b" />
        </div>

        <div className="container guide-hero__inner">
          <Link to="/" className="guide-page__back">
            <span className="guide-page__back-arrow" aria-hidden>
              ←
            </span>
            На главную
          </Link>

          <div className="guide-hero__header">
            <p className="guide-hero__kicker">Добро пожаловать</p>
            <h1 className="guide-hero__title">Как пользоваться Rento</h1>
            <p className="guide-hero__lead">
              Несколько шагов — от идеи до бронирования. Подсказки адаптированы
              и для узкого экрана телефона, и для широкого монитора.
            </p>
            <div className="guide-hero__chips" role="list">
              <span className="guide-chip" role="listitem">
                Каталог
              </span>
              <span className="guide-chip" role="listitem">
                Профиль
              </span>
              <span className="guide-chip" role="listitem">
                Объявления
              </span>
              <span className="guide-chip" role="listitem">
                Сделки
              </span>
            </div>
          </div>
        </div>
      </header>

      <section
        className="guide-body container"
        aria-labelledby="guide-steps-heading"
      >
        <div className="guide-body__columns">
          <div className="guide-body__main">
            <div className="guide-body__intro">
              <h2 id="guide-steps-heading" className="guide-section-title">
                Шаг за шагом
              </h2>
              <p className="guide-section-sub">
                Карточки ниже можно читать по порядку — каждая отвечает за свой
                этап жизненного цикла аренды.
              </p>
            </div>

            <ol className="guide-grid">
              {STEPS.map((step, index) => (
                <li key={step.id} className="guide-card">
                  <div className="guide-card__accent" aria-hidden />
                  <div className="guide-card__top">
                    <span className="guide-card__num" aria-hidden>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="guide-card__icon-wrap" aria-hidden>
                      <GuideIcon kind={step.icon} />
                    </span>
                  </div>
                  <h3 className="guide-card__title">{step.title}</h3>
                  <p className="guide-card__text">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>

          <aside className="guide-aside">
            <div className="guide-aside__inner">
              <h3 className="guide-aside__title">Правовые условия</h3>
              <p className="guide-aside__text">
                Условия использования платформы и ответственность сторон описаны
                в пользовательском соглашении. Перед регистрацией его нужно
                принять в форме — там же можно открыть полный текст.
              </p>
              <Link to="/terms" className="btn btn--brand guide-aside__btn">
                Открыть соглашение
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
