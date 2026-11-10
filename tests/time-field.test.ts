import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TimeField } from '@/components/TimeField';

const render = (value: string) =>
  renderToStaticMarkup(createElement(TimeField, { id: 't', name: 'time', value, onChange: () => {}, required: true }));

describe('TimeField', () => {
  it('bruger 24 timer: 00..23 og ingen AM/PM, og sender «HH:MM» i et skjult felt', () => {
    const html = render('19:30');
    expect(html).toContain('<input type="hidden" name="time" value="19:30"/>');
    expect(html).toContain('<option value="00">00</option>');
    expect(html).toContain('<option value="23">23</option>');
    expect(html).not.toMatch(/AM|PM/);
    expect(html).not.toContain('type="time"');
  });
  it('har valgt time og minut', () => {
    const html = render('07:45');
    expect(html).toMatch(/<option value="07" selected/);
    expect(html).toMatch(/<option value="45" selected/);
  });
  it('har tomt felt og deaktiveret minut uden time', () => {
    const html = render('');
    expect(html).toContain('name="time" value=""');
    expect(html).toContain('disabled');
  });
  it('bevarer et minut, der ikke er et multiplum af 5', () => {
    expect(render('18:07')).toContain('<option value="07" selected');
  });
});
