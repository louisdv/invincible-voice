import fs from 'node:fs';
import path from 'node:path';

const LEGACY_TERMS = ['Invincible', 'Kyutai', 'Unmute', 'Gradium'];
const LOCALES = ['fr', 'en', 'es', 'pt', 'de'] as const;

describe('i18n messages — no legacy brand references', () => {
  for (const locale of LOCALES) {
    it(`messages/${locale}.json contains no legacy brand term`, () => {
      const filePath = path.join(__dirname, '..', `${locale}.json`);
      const raw = fs.readFileSync(filePath, 'utf-8');
      for (const term of LEGACY_TERMS) {
        expect(raw).not.toMatch(new RegExp(term, 'i'));
      }
    });
  }
});
