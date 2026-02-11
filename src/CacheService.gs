/**
 * キャッシュサービス
 * GASのCacheServiceとグローバルスコープキャッシュを活用したキャッシュ管理
 * 
 * 注意: GASのCacheServiceは100KB制限があるため、大きなデータには適さない
 * グローバルスコープキャッシュは実行スコープ内でのみ有効（実行が終了するとクリアされる）
 */

const CacheService_Internal = {
  // グローバルスコープキャッシュ（実行スコープ内でのみ有効）
  _memoryCache: {},

  /**
   * キャッシュキーを生成
   * @param {string} prefix - プレフィックス
   * @param {string|Object} key - キー（オブジェクトの場合はJSON.stringifyされる）
   * @return {string} キャッシュキー
   */
  _generateKey(prefix, key) {
    const keyStr = typeof key === 'string' ? key : JSON.stringify(key);
    return `${prefix}_${keyStr}`;
  },

  /**
   * メモリキャッシュから値を取得
   * @param {string} key - キャッシュキー
   * @return {*} キャッシュされた値（存在しない場合はnull）
   */
  _getFromMemory(key) {
    if (this._memoryCache[key]) {
      const cached = this._memoryCache[key];
      // TTLチェック
      if (cached.expiresAt && cached.expiresAt < new Date().getTime()) {
        delete this._memoryCache[key];
        return null;
      }
      return cached.value;
    }
    return null;
  },

  /**
   * メモリキャッシュに値を設定
   * @param {string} key - キャッシュキー
   * @param {*} value - キャッシュする値
   * @param {number} ttlSeconds - TTL（秒）
   */
  _setToMemory(key, value, ttlSeconds) {
    const expiresAt = ttlSeconds ? new Date().getTime() + (ttlSeconds * 1000) : null;
    this._memoryCache[key] = {
      value: value,
      expiresAt: expiresAt
    };
  },

  /**
   * キャッシュから値を取得
   * @param {string} prefix - プレフィックス
   * @param {string|Object} key - キー
   * @param {boolean} useMemoryOnly - メモリキャッシュのみ使用（デフォルト: false）
   * @return {*} キャッシュされた値（存在しない場合はnull）
   */
  get(prefix, key, useMemoryOnly = false) {
    const cacheKey = this._generateKey(prefix, key);

    // メモリキャッシュから取得を試みる
    const memoryValue = this._getFromMemory(cacheKey);
    if (memoryValue !== null) {
      return memoryValue;
    }

    if (useMemoryOnly) {
      return null;
    }

    // CacheServiceから取得を試みる（小さいデータのみ）
    try {
      const cache = CacheService.getScriptCache();
      const cached = cache.get(cacheKey);
      if (cached) {
        const parsed = Utils.safeJsonParse(cached);
        if (parsed) {
          // メモリキャッシュにも保存
          this._setToMemory(cacheKey, parsed, 300); // 5分間メモリキャッシュ
          return parsed;
        }
      }
    } catch (error) {
      Utils.logError('CacheService.get', error, { prefix, key });
    }

    return null;
  },

  /**
   * キャッシュに値を設定
   * @param {string} prefix - プレフィックス
   * @param {string|Object} key - キー
   * @param {*} value - キャッシュする値
   * @param {number} ttlSeconds - TTL（秒、デフォルト: 300 = 5分）
   * @param {boolean} useMemoryOnly - メモリキャッシュのみ使用（デフォルト: false）
   */
  set(prefix, key, value, ttlSeconds = 300, useMemoryOnly = false) {
    const cacheKey = this._generateKey(prefix, key);

    // メモリキャッシュに保存
    this._setToMemory(cacheKey, value, ttlSeconds);

    if (useMemoryOnly) {
      return;
    }

    // CacheServiceに保存（100KB制限のため、小さいデータのみ）
    try {
      const valueStr = JSON.stringify(value);
      // 100KB制限をチェック（約100,000文字）
      if (valueStr.length > 90000) {
        Utils.log('CacheService.set', 'Value too large for CacheService, using memory cache only', {
          prefix,
          key,
          size: valueStr.length
        });
        return;
      }

      const cache = CacheService.getScriptCache();
      cache.put(cacheKey, valueStr, ttlSeconds);
    } catch (error) {
      Utils.logError('CacheService.set', error, { prefix, key });
    }
  },

  /**
   * キャッシュから値を削除
   * @param {string} prefix - プレフィックス
   * @param {string|Object} key - キー
   */
  remove(prefix, key) {
    const cacheKey = this._generateKey(prefix, key);

    // メモリキャッシュから削除
    delete this._memoryCache[cacheKey];

    // CacheServiceから削除
    try {
      const cache = CacheService.getScriptCache();
      cache.remove(cacheKey);
    } catch (error) {
      Utils.logError('CacheService.remove', error, { prefix, key });
    }
  },

  /**
   * プレフィックスに一致する全てのキャッシュをクリア（メモリキャッシュのみ）
   * 注意: CacheServiceには一括削除APIがないため、メモリキャッシュのみクリア
   * @param {string} prefix - プレフィックス
   */
  clearByPrefix(prefix) {
    const prefixKey = `${prefix}_`;
    Object.keys(this._memoryCache).forEach(key => {
      if (key.startsWith(prefixKey)) {
        delete this._memoryCache[key];
      }
    });
  }
};

// グローバルスコープでキャッシュを初期化（複数実行で共有されないように）
if (typeof globalCacheService === 'undefined') {
  var globalCacheService = CacheService_Internal;
}

