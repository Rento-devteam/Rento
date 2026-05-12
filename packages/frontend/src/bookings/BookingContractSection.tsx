import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { BookingDetail } from "./bookingsApi";
import { downloadRentalContractPdf } from "./downloadRentalContractPdf";
import { RentalContractBody } from "./RentalContractBody";

function formatMoneyRub(n: number): string {
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}

function formatPeriod(booking: BookingDetail): string {
  if (booking.startAt && booking.endAt) {
    return `${new Date(booking.startAt).toLocaleString("ru-RU")} — ${new Date(booking.endAt).toLocaleString("ru-RU")}`;
  }
  return `${booking.startDate} — ${booking.endDate}`;
}

function formatDocDateRu(): string {
  return new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildContractProps(
  booking: BookingDetail,
  currentUserDisplay: string,
) {
  const landlordDisplay =
    booking.role === "landlord"
      ? currentUserDisplay
      : (booking.landlordLabel ?? "Арендодатель (по данным Rento)");
  const renterDisplay =
    booking.role === "renter"
      ? currentUserDisplay
      : (booking.renterLabel ?? "Арендатор (по данным Rento)");

  return {
    landlordDisplay,
    renterDisplay,
    subjectTitle: booking.listingTitle,
    listingId: booking.listingId,
    bookingId: booking.id,
    periodText: formatPeriod(booking),
    rentRubFormatted: formatMoneyRub(booking.rentAmount),
    depositRubFormatted: formatMoneyRub(booking.depositAmount),
    totalRubFormatted: formatMoneyRub(booking.totalAmount),
    docDateRu: formatDocDateRu(),
  };
}

interface BookingContractSectionProps {
  booking: BookingDetail;
  currentUserDisplay: string;
  /** Открыть модальное окно один раз (например, после перехода с ?contract=1). */
  initialModalOpen?: boolean;
  onInitialModalOpenHandled?: () => void;
}

export function BookingContractSection({
  booking,
  currentUserDisplay,
  initialModalOpen,
  onInitialModalOpenHandled,
}: BookingContractSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const sectionTitleId = useId();
  const modalTitleId = useId();

  const props = useMemo(
    () => buildContractProps(booking, currentUserDisplay),
    [booking, currentUserDisplay],
  );

  useEffect(() => {
    if (!initialModalOpen) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setModalOpen(true);
      onInitialModalOpenHandled?.();
    });
    return () => {
      cancelled = true;
    };
  }, [initialModalOpen, onInitialModalOpenHandled]);

  const handleDownload = useCallback(async () => {
    setPdfBusy(true);
    try {
      const safe = booking.id.replace(/[^\w-]+/g, "").slice(0, 24);
      await downloadRentalContractPdf(
        props,
        `dogovor-arendy-${safe || "sdelka"}.pdf`,
      );
    } finally {
      setPdfBusy(false);
    }
  }, [booking.id, props]);

  return (
    <>
      <section
        className="bookings-page__panel"
        aria-labelledby={sectionTitleId}
      >
        <h2 id={sectionTitleId} className="bookings-page__panel-title">
          Договор аренды (PDF)
        </h2>
        <p className="bookings-page__fineprint">
          Письменная форма по правилам ГК РФ; текст носит типовой характер. При
          спорных ситуациях обращайтесь к юристу.
        </p>
        <div className="booking-contract__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setModalOpen(true)}
          >
            Просмотреть
          </button>
          <button
            type="button"
            className="btn btn--brand"
            disabled={pdfBusy}
            onClick={() => void handleDownload()}
          >
            {pdfBusy ? "Формируем PDF…" : "Скачать PDF"}
          </button>
        </div>
      </section>

      {modalOpen ? (
        <div
          className="modal"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="modal__dialog modal__dialog--wide booking-contract__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
          >
            <button
              type="button"
              className="modal__close"
              aria-label="Закрыть"
              onClick={() => setModalOpen(false)}
            >
              ×
            </button>
            <h2
              id={modalTitleId}
              className="modal__title"
              style={{ marginTop: 0 }}
            >
              Договор аренды
            </h2>
            <div className="booking-contract__scroll">
              <RentalContractBody {...props} />
            </div>
            <div className="booking-contract__modal-footer">
              <button
                type="button"
                className="btn btn--ghost-solid"
                onClick={() => setModalOpen(false)}
              >
                Закрыть
              </button>
              <button
                type="button"
                className="btn btn--brand"
                disabled={pdfBusy}
                onClick={() => void handleDownload()}
              >
                {pdfBusy ? "Формируем…" : "Скачать PDF"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
