import { RulesEngine } from './rules.engine';

describe('RulesEngine', () => {
  const engine = new RulesEngine();

  it('flags long random Latin without vowels as gibberish', () => {
    const title = 'Rent item';
    const description =
      'qxkpmnvtrzwbdhjlsfgqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm';
    const r = engine.evaluate(title, description);
    expect(r.flags.gibberish).toBe(true);
    expect(r.severity).toBe('warn');
  });

  it('flags single-token keyboard mash', () => {
    const r = engine.evaluate('Tool', 'asdfasdfasdfasdfasdfasdfasdfasdfasdfasdf');
    expect(r.flags.gibberish).toBe(true);
  });

  it('allows normal Russian description', () => {
    const r = engine.evaluate(
      'Дрель Bosch',
      'Аккумуляторная дрель в хорошем состоянии. Самовывоз у метро.',
    );
    expect(r.flags.gibberish).toBe(false);
    expect(r.flags.profanity).toBe(false);
  });

  it('flags Cyrillic mash with structured description prefixes', () => {
    const r = engine.evaluate(
      'кпквиафыипапаупыав',
      'Бренд: вфаыпвпиааыпвп. Год: 1234. Состояние: Новое. ваипвваипвппвыаипв',
    );
    expect(r.flags.gibberish).toBe(true);
    expect(r.severity).toBe('warn');
  });

  it('flags Russian consonant mash tokens as gibberish', () => {
    const desc =
      'птклнмж впртмнк трлнмкп джзклвп штвмкп впртмнк трлнмкп джзклвп штвмкп впртмнк трлнмкп джзклвп штвмкп впртмнк трлнмкп джзклвп штвмкп';
    const r = engine.evaluate('Инструмент', desc);
    expect(r.flags.gibberish).toBe(true);
    expect(r.severity).toBe('warn');
  });
});
