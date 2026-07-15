import { describe, expect, it } from 'vitest';

import { getCompanyBrand, getCompanyInitials } from '../src/lib/company-brand';
import { readFileSync } from 'node:fs';

describe('company brand presentation', () => {
  it('resolves known employers to a logo source', () => {
    expect(getCompanyBrand('Lidl Dienstleistung GmbH & Co. KG').domain).toBe('lidl.de');
    expect(getCompanyBrand('Deutsche Rentenversicherung Rheinland-Pfalz').domain).toBe('deutsche-rentenversicherung.de');
    expect(getCompanyBrand('Tesco Stores Limited').domain).toBe('tesco.com');
  });

  it('keeps unknown employers usable with a deterministic visual identity', () => {
    const first = getCompanyBrand('Kleine Werkstatt GmbH');
    const second = getCompanyBrand('Kleine Werkstatt GmbH');
    expect(first.domain).toBeNull();
    expect(first).toEqual(second);
    expect(first.accent).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('creates compact initials while ignoring legal suffixes', () => {
    expect(getCompanyInitials('Lidl Dienstleistung GmbH & Co. KG')).toBe('LD');
    expect(getCompanyInitials('B/R/K/S Rechtsanwälte.Notare.')).toBe('BR');
  });

  it('uses the shared brand mark in discovery and recommendation cards', () => {
    expect(readFileSync('src/components/jobs/job-card.tsx', 'utf8')).toContain('CompanyBrandMark');
    expect(readFileSync('src/components/home/home-job-card.tsx', 'utf8')).toContain('CompanyBrandMark');
  });
});
