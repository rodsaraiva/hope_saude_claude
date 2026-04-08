import { render, toPlainText } from '@react-email/render';
import type { ReactElement } from 'react';

export interface RenderedTemplate {
  html: string;
  text: string;
}

export async function renderTemplate(element: ReactElement): Promise<RenderedTemplate> {
  const html = await render(element, { pretty: false });
  const text = toPlainText(html);
  return { html, text };
}
