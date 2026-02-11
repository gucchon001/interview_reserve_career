# TimeRexウィジェットカスタマイズガイド

## 概要

TimeRexカレンダーウィジェットは、様々なカスタマイズオプションを提供しています。現在の実装状況と、後で追加可能な項目を説明します。

## 現在実装済みのカスタマイズ

### 1. 言語設定
- **パラメータ**: `locale`
- **現在の設定**: `'ja'`（日本語）
- **変更可能**: `'en'`（英語）に変更可能

### 2. フォーム項目の自動入力
- **guest_name**: ユーザー名を自動入力
- **guest_email**: メールアドレスを自動入力
- **url_params**: LINEユーザーIDなどのパラメータを渡す

### 3. コールバック関数
- **onLoad**: ウィジェット読み込み完了時
- **onFormOpen**: 予約フォーム表示時
- **onBookingComplete**: 予約完了時

### 4. ロゴの非表示（Premiumプラン）
- **パラメータ**: `disable_logo`
- **現在の設定**: `'true'`（ロゴを非表示）
- **実装場所**: `src/Booking.html` の `widgetConfig`

### 5. カラーカスタマイズ（Premiumプラン）
- **パラメータ**: `primary_color`
- **現在の設定**: `'#3472D1'`（ロゴのメインカラーに合わせて設定）
- **実装場所**: `src/Booking.html` の `widgetConfig`

## 後で追加可能なカスタマイズ（Premiumプラン）

### 1. カラーカスタマイズ（✅ 実装済み）
- **パラメータ**: `primary_color`
- **説明**: ウィジェットのキーカラーを指定
- **形式**: カラーコード（`#3472D1`、`#000000`、`000000`など）
- **現在の設定**: `'#3472D1'`（ロゴのメインカラーに合わせて設定）
- **実装場所**: `src/Booking.html` の `widgetConfig`

```javascript
config['primary_color'] = '#3472D1'; // ロゴの色（青）に設定（実装済み）
```

### 2. ロゴの非表示（✅ 実装済み）
- **パラメータ**: `disable_logo`
- **説明**: TimeRexロゴを非表示にする
- **値**: `'true'` または `'false'`
- **現在の設定**: `'true'`（ロゴを非表示）
- **実装場所**: `src/Booking.html` の `widgetConfig`

```javascript
config['disable_logo'] = 'true'; // ロゴを非表示（実装済み）
```

### 3. タイトルハイパーリンクの無効化
- **パラメータ**: `disable_title_hyperlink`
- **説明**: カレンダー名のハイパーリンクを無効化
- **値**: `'true'` または `'false'`
- **実装場所**: `src/Booking.html` の `widgetConfig` に追加

```javascript
config['disable_title_hyperlink'] = 'true'; // ハイパーリンクを無効化
```

### 4. カスタムフォーム項目の自動入力
- **パラメータ**: `<custom_form_field_id>`
- **説明**: TimeRex側で設定したカスタムフォーム項目に値を自動入力
- **実装場所**: `src/Booking.html` の `widgetConfig` に追加

```javascript
// 例: カスタムフォーム項目IDが '1234567890abc_1' の場合
config['1234567890abc_1'] = '自動入力する値';
```

## 実装方法

### 基本的なカスタマイズの追加

`src/Booking.html` の `widgetConfig` セクションに、以下のように追加します：

```javascript
const widgetConfig = computed(() => {
  const config = {
    'locale': 'ja',
    'url_params': {},
    // 以下を追加
    'primary_color': '#10B981',           // カラーカスタマイズ
    'disable_logo': 'true',               // ロゴ非表示
    'disable_title_hyperlink': 'true'     // ハイパーリンク無効化
  };
  
  // ... 既存のコード ...
  
  return config;
});
```

### カスタマイズ設定をGAS側から制御する場合

GAS側のスクリプトプロパティに設定を追加し、テンプレートに渡すことも可能です：

1. **スクリプトプロパティに追加**:
```javascript
setScriptProperties({
  TIMEREX_WIDGET_PRIMARY_COLOR: '#10B981',
  TIMEREX_WIDGET_DISABLE_LOGO: 'true'
});
```

2. **Code.gs でテンプレートに渡す**:
```javascript
template.widgetPrimaryColor = PropertiesService.getScriptProperties()
  .getProperty('TIMEREX_WIDGET_PRIMARY_COLOR') || '#10B981';
```

3. **Booking.html で使用**:
```javascript
const timerexBaseUrl = '<?= timerexBaseUrl ?>';
const widgetPrimaryColor = '<?= widgetPrimaryColor ?>';

// widgetConfig内で使用
config['primary_color'] = widgetPrimaryColor;
```

## モバイル表示されない事象について（TimeRexは無関係）

**重要: モバイル表示されない事象は TimeRex ウィジェットとは一切関係ありません。**

**原因（確定）:** **LSTEP の Webhook 外部連携 URL を設定した場合、その経路で開かれたリンクが LINE 内で PC 表示になる。** Webhook 外部連携 URL を設定していない GAS／リンクではモバイル表示になる。本プロジェクトは Webhook 転送で UID 取得しているため、この条件に該当する。詳細は **docs/GAS_CONFIG_MOBILE_CHECK.md** の「原因（確定）」を参照。

2025年時点の調査で、TimeRex ウィジェットを読み込まない状態（カレンダー領域をプレースホルダーに差し替えた状態）にしても、LSTEP経由・外部ブラウザのいずれでもモバイル表示にはならず、挙動に変化はありませんでした。原因は当システムの配信環境（GAS / script.google.com）やブラウザ・WebView 側にあり、TimeRex の埋め込みは本件の要因ではないことを確認済みです。

**補足:** 他の GAS プロジェクトでは同じ端末・ブラウザで普通にモバイル表示されるため、事象は **本プロジェクト固有** と考えられます。GAS 全体の制約というより、本アプリのデプロイ方法・URL経路（LSTEP リダイレクト経由など）・HTML/スクリプトの構成のいずれかが関与している可能性があります。

**構成の詳細な確認:** 本プロジェクトの GAS 構成がモバイル表示に与える要因をステップごとに整理したチェックリストを **docs/GAS_CONFIG_MOBILE_CHECK.md** に記載しています。特に **setXFrameOptionsMode(ALLOWALL)** により iframe 埋め込みが許可されており、LINE が iframe で開いた場合に親の幅で描画される可能性があります。

### User-Agent（UA）の可能性

**モバイル表示されない原因の一つとして、User-Agent（UA）やブラウザの「PC版表示」設定が関与している可能性があります。**

- **想定される要因**
  - LINE のアプリ内ブラウザや、端末のブラウザが **デスクトップ用の User-Agent** を送っている
  - ユーザーがブラウザの **「PC版表示」「デスクトップサイト」** をオンにしている
  - 上記により、レンダリング幅が広く扱われ、モバイル用レイアウトにならない

- **GAS 側の制約**
  - **doGet(e) の `e` には HTTP ヘッダー（User-Agent など）が含まれません。** クエリパラメータのみ取得可能です。
  - そのため、**サーバ側で UA を見てモバイル用 HTML を出し分けることはできません。** 常に同じ HTML を返しています。
  - クライアント（Booking.html）では `navigator.userAgent` を参照可能で、`?debug=1` でデバッグ表示に含めています。

- **利用者に案内できる対策**
  - ブラウザのメニューで **「PC版表示」「デスクトップサイト」をオフ** にする
  - リンクを **「ブラウザで開く」** で外部ブラウザで開き、そのブラウザで上記設定を確認する

---

## 注意事項

1. **Premiumプランが必要**: `primary_color`、`disable_logo`、`disable_title_hyperlink` はPremiumプランでのみ利用可能です
2. **カスタムフォーム項目ID**: カスタムフォーム項目の自動入力には、TimeRex側で設定した項目IDが必要です
3. **url_paramsの制限**: `url_params` は最大25個まで設定可能です

## 参考リンク

- [TimeRex カレンダーウィジェット埋め込みドキュメント](https://developers.timerex.net/ja/widget/nreference/1bbc771ccab48-calendar-widget-embed)

