import { describe, expect, it } from 'vitest';

import { getCompanyBrand, getCompanyInitials } from '../src/lib/company-brand';
import { readFileSync } from 'node:fs';

describe('company brand presentation', () => {
  it('keeps employers usable with a deterministic, logo-free visual identity', () => {
    const first = getCompanyBrand('Kleine Werkstatt GmbH');
    const second = getCompanyBrand('Kleine Werkstatt GmbH');
    expect(first).toEqual(second);
    expect(first.accent).toMatch(/^#[0-9A-F]{6}$/);
    expect(first).not.toHaveProperty('logoUrl');
    expect(first).not.toHaveProperty('domain');
  });

  it('creates compact initials while ignoring legal suffixes', () => {
    expect(getCompanyInitials('Lidl Dienstleistung GmbH & Co. KG')).toBe('LD');
    expect(getCompanyInitials('B/R/K/S Rechtsanwälte.Notare.')).toBe('BR');
  });

  it('renders company marks without remote logo or image dependencies', () => {
    const mark = readFileSync('src/components/company/company-brand-mark.tsx', 'utf8');
    expect(mark).not.toContain("from 'expo-image'");
    expect(mark).not.toContain('logoUrl');
    expect(mark).not.toContain('source={{ uri:');
  });

  it('uses the shared brand mark in discovery and recommendation cards', () => {
    expect(readFileSync('src/components/jobs/job-card.tsx', 'utf8')).toContain('CompanyBrandMark');
    expect(readFileSync('src/components/home/home-job-card.tsx', 'utf8')).toContain('CompanyBrandMark');
  });
});
