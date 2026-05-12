export type RentalContractBodyProps = {
  landlordDisplay: string;
  renterDisplay: string;
  subjectTitle: string;
  listingId: string;
  bookingId: string;
  periodText: string;
  rentRubFormatted: string;
  depositRubFormatted: string;
  totalRubFormatted: string;
  docDateRu: string;
};

/**
 * Текст договора ориентирован на положения ГК РФ о найме и аренде (гл. 34),
 * в частности договор аренды движимого имущества (ст. 606 и след.).
 * Не заменяет индивидуальную юридическую работу.
 */
export function RentalContractBody({
  landlordDisplay,
  renterDisplay,
  subjectTitle,
  listingId,
  bookingId,
  periodText,
  rentRubFormatted,
  depositRubFormatted,
  totalRubFormatted,
  docDateRu,
}: RentalContractBodyProps) {
  return (
    <div className="rental-contract">
      <h1 className="rental-contract__title rental-contract__avoid-break">
        Договор аренды вещи (краткая письменная форма)
      </h1>
      <p className="rental-contract__meta">
        г. по месту заключения · {docDateRu} · № {bookingId}
      </p>

      <p className="rental-contract__p">
        <strong>{landlordDisplay}</strong>, именуемый(ая) в дальнейшем
        «Арендодатель», с одной стороны, и <strong>{renterDisplay}</strong>,
        именуемый(ая) в дальнейшем «Арендатор», с другой стороны, совместно
        именуемые «Стороны», заключили настоящий договор (далее — «Договор») о
        нижеследующем.
      </p>

      <section className="rental-contract__section rental-contract__avoid-break">
        <h2 className="rental-contract__h2">1. Предмет и правовая основа</h2>
        <p className="rental-contract__p">
          1.1. Арендодатель передаёт, а Арендатор принимает во временное
          владение и пользование за плату вещь (имущество), указанную в
          объявлении на сервисе Rento: «{subjectTitle}» (идентификатор
          объявления в сервисе: {listingId}).
        </p>
        <p className="rental-contract__p">
          1.2. Отношения Сторон по передаче вещи во временное пользование за
          плату регулируются Гражданским кодексом Российской Федерации, в том
          числе правилами о договоре аренды (ст. 606 и след. ГК РФ) и иными
          применимыми нормами. Договор заключён в простой письменной форме путём
          акцепта условий сделки в интерфейсе Rento и настоящего документа.
        </p>
      </section>

      <section className="rental-contract__section">
        <h2 className="rental-contract__h2">2. Срок аренды</h2>
        <p className="rental-contract__p">
          2.1. Срок пользования вещью: <strong>{periodText}</strong>.
        </p>
        <p className="rental-contract__p">
          2.2. По окончании срока Арендатор обязан вернуть вещь в состоянии с
          учётом нормального износа, обусловленного её использованием по
          назначению, если иное не согласовано Сторонами дополнительно в
          письменной форме (ст. 622 ГК РФ).
        </p>
      </section>

      <section className="rental-contract__section">
        <h2 className="rental-contract__h2">3. Арендная плата и расчёты</h2>
        <p className="rental-contract__p">
          3.1. Размер арендной платы за согласованный период составляет{" "}
          <strong>{rentRubFormatted}</strong> (включая налоги — по соглашению
          Сторон и фактическим условиям платёжного посредника).
        </p>
        <p className="rental-contract__p">
          3.2. Для обеспечения исполнения обязательств по оплате и возврату вещи
          Стороны могут использовать механизм блокировки (холда) средств на
          банковской карте Арендатора через платёжного провайдера, подключённого
          к сервису Rento. Порядок списания, разблокировки и комиссий
          определяется правилами платёжной организации и пользовательским
          соглашением Rento, не противоречащими императивным нормам закона.
        </p>
        <p className="rental-contract__p">
          3.3. Итоговая сумма к блокировке по данной сделке в интерфейсе Rento:{" "}
          <strong>{totalRubFormatted}</strong> (аренда и обеспечительный
          платёж/залог — см. п. 4).
        </p>
      </section>

      <section className="rental-contract__section">
        <h2 className="rental-contract__h2">4. Залог (обеспечение)</h2>
        <p className="rental-contract__p">
          4.1. Сумма залога (обеспечительного платежа) по сделке:{" "}
          <strong>{depositRubFormatted}</strong>.
        </p>
        <p className="rental-contract__p">
          4.2. Залог предназначен для обеспечения возврата вещи и исполнения
          иных обязательств Арендатора. Порядок удержания, зачёта и возврата
          залога определяется соглашением Сторон, правилами платёжного
          посредника и положениями ГК РФ о неустойке и возмещении убытков (ст.
          330, 393 ГК РФ), если применимо.
        </p>
      </section>

      <section className="rental-contract__section">
        <h2 className="rental-contract__h2">
          5. Передача, пользование, возврат
        </h2>
        <p className="rental-contract__p">
          5.1. Факт, место и время передачи вещи Стороны фиксируют
          самостоятельно (в том числе через сообщения в Rento). При передаче
          рекомендуется составлять акт приёма-передачи; при отсутствии акта
          стороны признают фотоматериалы и переписку косвенными доказательствами
          состояния вещи.
        </p>
        <p className="rental-contract__p">
          5.2. Арендатор обязуется использовать вещь по назначению, не
          передавать её третьим лицам без письменного согласия Арендодателя и
          бережно относиться к имуществу (ст. 619 ГК РФ).
        </p>
      </section>

      <section className="rental-contract__section">
        <h2 className="rental-contract__h2">6. Ответственность и форс-мажор</h2>
        <p className="rental-contract__p">
          6.1. За неисполнение или ненадлежащее исполнение обязательств Стороны
          несут ответственность в соответствии с законом и настоящим Договором
          (ст. 393, 401 ГК РФ).
        </p>
        <p className="rental-contract__p">
          6.2. Сторона освобождается от ответственности за частичное или полное
          неисполнение обязательств, если это явилось следствием обстоятельств
          непреодолимой силы (ст. 401 ГК РФ), при условии своевременного
          уведомления другой Стороны.
        </p>
      </section>

      <section className="rental-contract__section">
        <h2 className="rental-contract__h2">7. Персональные данные</h2>
        <p className="rental-contract__p">
          7.1. Обработка персональных данных Сторон в связи с исполнением
          Договора осуществляется в объёме, необходимом для работы сервиса
          Rento, в соответствии с Федеральным законом № 152-ФЗ «О персональных
          данных» и политикой конфиденциальности оператора сервиса.
        </p>
      </section>

      <section className="rental-contract__section">
        <h2 className="rental-contract__h2">8. Разрешение споров</h2>
        <p className="rental-contract__p">
          8.1. Споры и разногласия Стороны стремятся урегулировать путём
          переговоров. При недостижении согласия спор подлежит рассмотрению в
          суде по правилам подсудности, установленным гражданским процессуальным
          законодательством РФ (ст. 28, 29 ГПК РФ — при необходимости с учётом
          императивных норм о защите прав потребителей).
        </p>
      </section>

      <section className="rental-contract__section">
        <h2 className="rental-contract__h2">9. Заключительные положения</h2>
        <p className="rental-contract__p">
          9.1. Договор вступает в силу с момента, когда Стороны подтвердили
          условия сделки в Rento и наступили обстоятельства, указанные в
          интерфейсе (включая успешную блокировку средств, если применимо).
        </p>
        <p className="rental-contract__p">
          9.2. Изменения и дополнения к Договору действительны при их письменном
          оформлении (в том числе электронном документе, подписанном усиленной
          квалифицированной электронной подписью — при использовании Сторонами
          такой формы).
        </p>
        <p className="rental-contract__p">
          9.3. Rento выступает информационным посредником и не является стороной
          настоящего Договора, за исключением случаев, прямо предусмотренных
          отдельным соглашением с оператором сервиса.
        </p>
      </section>

      <section className="rental-contract__section rental-contract__signatures">
        <h2 className="rental-contract__h2">10. Подписи сторон</h2>
        <div className="rental-contract__sig-grid">
          <div>
            <p className="rental-contract__p">
              <strong>Арендодатель:</strong>
            </p>
            <p className="rental-contract__p">{landlordDisplay}</p>
            <p className="rental-contract__sig-line">
              ________________ / ________________ /
            </p>
          </div>
          <div>
            <p className="rental-contract__p">
              <strong>Арендатор:</strong>
            </p>
            <p className="rental-contract__p">{renterDisplay}</p>
            <p className="rental-contract__sig-line">
              ________________ / ________________ /
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
