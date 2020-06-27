/* eslint-disable no-magic-numbers */
import * as assert from 'assert';
import {mimeOrDefault, asset} from '../src/github';

describe('github', () => {
  describe('mimeOrDefault', () => {
    it('returns a specific mime for common path', async() => {
      assert.strictEqual(mimeOrDefault('foo.tar.gz'), 'application/gzip');
    });
    it('returns default mime for uncommon path', async() => {
      assert.strictEqual(mimeOrDefault('foo.uncommon'), 'application/octet-stream');
    });
  });

  describe('asset', () => {
    it('derives asset info from a path', async() => {
      const {name, mime, size, file} = asset('tests/data/foo/bar.txt');
      assert.strictEqual(name, 'bar.txt');
      assert.strictEqual(mime, 'text/plain');
      assert.strictEqual(size, 10);
      assert.strictEqual(file.toString(), 'release me');
    });
  });
});
