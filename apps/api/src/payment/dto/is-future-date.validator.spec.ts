import { validate } from 'class-validator';
import { IsFutureDate } from './is-future-date.validator';

class Sample {
  @IsFutureDate()
  date!: string;
}

describe('IsFutureDate', () => {
  it('aceita data ISO no futuro', async () => {
    const s = new Sample();
    s.date = new Date(Date.now() + 60_000).toISOString();
    const errors = await validate(s);
    expect(errors).toHaveLength(0);
  });

  it('rejeita data no passado', async () => {
    const s = new Sample();
    s.date = new Date(Date.now() - 60_000).toISOString();
    const errors = await validate(s);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isFutureDate).toBeDefined();
  });

  it('rejeita valor não-data', async () => {
    const s = new Sample();
    s.date = 'não é data';
    const errors = await validate(s);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isFutureDate).toBeDefined();
  });
});
