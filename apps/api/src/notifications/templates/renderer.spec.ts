import * as React from 'react';
import { renderTemplate } from './renderer';
import { BaseLayout } from './base-layout';

describe('renderTemplate', () => {
  it('devolve html e text não-vazios', async () => {
    const element = React.createElement(
      BaseLayout,
      { preview: 'oi' },
      React.createElement('p', null, 'conteudo teste'),
    );
    const out = await renderTemplate(element);
    expect(out.html).toContain('conteudo teste');
    expect(out.html).toContain('<html');
    expect(out.text).toContain('conteudo teste');
    expect(out.text.length).toBeGreaterThan(0);
  });
});
