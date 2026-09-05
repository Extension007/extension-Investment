const {
  xmlEscape,
  toLastmod,
  pageCount,
  buildSitemapXml,
  buildRobotsTxt
} = require('../../services/sitemapService');
const { getPublicOrigin, absoluteUrl } = require('../../utils/siteUrl');

describe('sitemapService', () => {
  test('xmlEscape encodes markup', () => {
    expect(xmlEscape(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&apos;&amp;');
  });

  test('toLastmod formats ISO date', () => {
    expect(toLastmod('2026-09-02T10:15:00.000Z')).toBe('2026-09-02');
    expect(toLastmod('not-a-date')).toBe('');
  });

  test('pageCount caps and defaults', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(24)).toBe(1);
    expect(pageCount(25)).toBe(2);
    expect(pageCount(5000)).toBe(50);
  });

  test('buildSitemapXml includes public pages and buy/sell catalog', () => {
    const xml = buildSitemapXml({
      origin: 'https://www.albamount.xyz',
      productCount: 50,
      lastmod: '2026-09-02T00:00:00.000Z'
    });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://www.albamount.xyz/</loc>');
    expect(xml).toContain('<loc>https://www.albamount.xyz/ad</loc>');
    expect(xml).toContain('<loc>https://www.albamount.xyz/services</loc>');
    expect(xml).toContain('<loc>https://www.albamount.xyz/contacts</loc>');
    expect(xml).toContain('<loc>https://www.albamount.xyz/faq</loc>');
    expect(xml).not.toContain('/?page=');
    expect(xml).toContain('<lastmod>2026-09-02</lastmod>');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('/cabinet');
  });

  test('buildRobotsTxt points to sitemap and blocks private paths', () => {
    const txt = buildRobotsTxt('https://www.albamount.xyz');
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Disallow: /admin');
    expect(txt).toContain('Disallow: /cabinet');
    expect(txt).toContain('Sitemap: https://www.albamount.xyz/sitemap.xml');
  });
});

describe('siteUrl', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.BASE_URL = prev.BASE_URL;
    process.env.PUBLIC_URL = prev.PUBLIC_URL;
    process.env.NODE_ENV = prev.NODE_ENV;
    process.env.VERCEL = prev.VERCEL;
  });

  test('prefers BASE_URL', () => {
    process.env.BASE_URL = 'https://www.albamount.xyz/';
    expect(getPublicOrigin()).toBe('https://www.albamount.xyz');
    expect(absoluteUrl('/services')).toBe('https://www.albamount.xyz/services');
  });
});
