import { describe, expect, it } from 'vitest';
import { createI18n, resources } from '.';

type Tree = { [key: string]: string | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [prefix + k] : keys(v, `${prefix}${k}.`),
  );
}

describe('i18n', () => {
  it('defaults to Albanian', () => {
    const i18n = createI18n();
    expect(i18n.t('updatedAt', { time: '21:42' })).toBe('Përditësuar 21:42');
  });

  it('switches to English', () => {
    expect(createI18n('en').t('offline')).toBe('No internet');
  });

  it('has the same keys in every language', () => {
    expect(keys(resources.en.common)).toEqual(keys(resources.sq.common));
  });
});
