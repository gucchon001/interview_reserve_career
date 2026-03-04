# メンバーフィルタ 仕様レビュー（ステップバイステップ確認）

## 1. 初期化フロー

### 1.1 起動時
| ステップ | 状態 | 確認 |
|---------|------|------|
| 1 | visibleMemberIds = {} | OK |
| 2 | interviewers = [] | OK |
| 3 | watch(interviewers) immediate実行 → list=[] でスキップ | OK |
| 4 | fetchAdminData 完了 | - |
| 5 | interviewers = data.interviewers (4人) | OK |
| 6 | watch(interviewers) 発火 → next={id1:true, id2:true, id3:true, id4:true} | OK |
| 7 | visibleMemberIds 更新 | OK |

### 1.2 発見した問題
- **初期表示のタイミング**: initCalendar が fetchAdminData より先に実行される。events コールバック初回呼び出し時、filteredEvents は allEvents=[] なので空配列を返す。これは正しい。

## 2. 選択人数の算出

### 2.1 現在のロジック
```javascript
const selectedIds = new Set(
  Object.keys(visible)
    .filter(id => visible[id])
    .map(id => normalizeId(id))
    .filter(id => id)
);
const allSelected = selectedIds.size === interviewers.value.length && interviewers.value.length > 0;
```

### 2.2 潜在的な問題
| 問題 | 詳細 | 影響 |
|------|------|------|
| **visible の key が interviewers と同期していない** | fetchAdminData で interviewers が更新されるが、watch が同期的に visibleMemberIds を更新。fetchAdminData の successHandler 内で interviewers を先に代入し、その直後に watch が発火する。Vue の watch は次の tick で実行されるため、calendarApi.refetchEvents() の時点では visibleMemberIds がまだ古い可能性？ | 要確認 |
| **interviewers が空の状態** | interviewers=[] のとき selectedIds.size=0, allSelected=false。チーム枠は非表示、個人枠も evInterviewerId があれば selectedIds.has() で false。interviewerId なしのイベントは allSelected=false で非表示。 | OK |

### 2.3 選択人数が読み取れない問題
- selectedIds は Object.keys(visible).filter(id => visible[id]) から算出。visible の key は interviewer.id。
- **問題**: visible に interviewer.id がキーとして存在しない場合、そのメンバーは Object.keys に出てこない。watch で next[i.id] を設定するので、通常は全員分のキーがある。
- **エッジケース**: watch が実行される前にユーザーがチェックボックスを操作した場合。初回、interviewers=[] でチェックボックスはまだ描画されていない。fetchAdminData 完了後、interviewers と visibleMemberIds が同時に更新される。テンプレートが再描画され、v-model でバインド。この時 visibleMemberIds には全員分のキーがあり、全て true。問題なさそう。

## 3. watch の実行順序とキャッシュ

### 3.1 データ更新フロー
1. fetchAdminData 成功
2. allEvents, interviewers 等を更新
3. Vue のリアクティブシステムが watch(interviewers) をスケジュール
4. calendarApi.refetchEvents() が同期的に実行
5. events コールバックが呼ばれ、filteredEvents.value を返す
6. この時点で filteredEvents は allEvents と visibleMemberIds に依存。interviewers の watch はまだ実行されていない可能性あり。

### 3.2 問題: 更新順序
fetchAdminData の successHandler で:
```javascript
interviewers.value = data.interviewers;  // これで watch(interviewers) がキューに
// ...
if (calendarApi) calendarApi.refetchEvents();  // 同期的に実行
```
Vue の watch は同じ tick 内では同期的に実行されない（マイクロタスクとしてスケジュール）。なので refetchEvents が呼ばれる時点では、watch(interviewers) はまだ実行されていない可能性がある。
しかし、fetchAdminData で interviewers を**新規代入**する場合、watch が発火して visibleMemberIds を更新する。visibleMemberIds の更新は「既存の next をベースに、新規 id を true で追加」するだけ。fetchAdminData の前からユーザーが選択を変更していた場合、next = {...visibleMemberIds.value} でその選択が保持される。そして list の各 id について next[i.id] === undefined のときだけ true をセット。なので、新しい面談官が追加された場合のみ新しいキーが true になる。既存の選択は保持される。OK。

### 3.3 選択を外す順序とキャッシュ
- ユーザーが A を外す → visibleMemberIds 更新 → watch(visibleMemberIds) 発火 → refetchEvents
- ユーザーが B を外す → 同様
- 順序は関係ない。毎回 filteredEvents が再計算され、最新の visibleMemberIds に基づく。キャッシュの問題はなさそう。
- **想定**: FullCalendar の refetchEvents が、 events コールバックの戻り値をキャッシュしている？コールバックは毎回 filteredEvents.value を返す。filteredEvents は computed なので、依存が変われば再計算される。refetchEvents のたびにコールバックが呼ばれる。問題なさそう。

## 4. その他の潜在的問題

### 4.1 全解除後の「全選択」
deselectAllMembers で全員オフ。selectAllMembers で全員ON。動作は正しい。

### 4.2 ポーリング時の選択状態保持
refreshData(true) → fetchAdminData(..., silent: true) → success で interviewers.value = data.interviewers。watch(interviewers) 発火。next = {...visibleMemberIds.value} で現在の選択をコピー。新規 id が next にない場合は true で追加。既存の id は next に既にあるのでその値が保持される。OK。

### 4.3 オブジェクト参照の同一性
selectAllMembers で visibleMemberIds.value = next。next は新しいオブジェクト。Vue は ref の .value の変更を検知する。OK。
deselectAllMembers も同様。

## 5. 実施した修正

1. **refetchEvents のタイミング**: fetchAdminData 成功後、`nextTick()` で watch(interviewers) による visibleMemberIds 更新を待ってから refetchEvents を実行するよう変更。
2. **選択人数の表示**: UI に「○人中○人を表示」を追加。selectedMemberCount は `Object.keys(visible).filter(id => visible[id]).length` で算出。
3. **list.find → list.some**: watch 内の存在チェックを `list.some(i => i.id === id)` に変更（意味は同じだが意図が明確）。
