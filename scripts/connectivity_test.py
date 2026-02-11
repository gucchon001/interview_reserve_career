#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
L-step / TimeRex 疎通確認スクリプト（切り分け用）

環境変数または .env で LSTEP_API_TOKEN を設定し、Python から API に到達できるか確認します。
GAS と同じトークン・URL で試すことで、問題が GAS 側かネットワーク・認証側かを切り分けできます。

使い方:
  cd scripts
  python -m venv .venv
  .venv\\Scripts\\activate   # Windows
  pip install -r requirements.txt
  copy .env.example .env  # 編集して LSTEP_API_TOKEN を設定
  python connectivity_test.py
"""

import os
import sys
from pathlib import Path

# Windows でコンソールに日本語を出すため
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# プロジェクトルートまたは scripts の .env を読む
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
    else:
        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

import requests

# 設定（環境変数またはデフォルト）
LSTEP_API_BASE = "https://api.lineml.jp/v1"
LSTEP_TRIGGER_URL_DEFAULT = "https://api.lineml.jp/v1/api-codes/690/triggers/c4faddc7-b837-4637-b481-eaab5777af2a"
TIMEREX_API_BASE = "https://timerex.net/api/beta"

TEST_UID = "U6e967fdb7f0aaf99375946cad8744fad"
TEST_FRIEND_ID = "204179348"


def get_lstep_token():
    t = os.environ.get("LSTEP_API_TOKEN", "").strip()
    return t if t else None


def get_trigger_url():
    u = os.environ.get("LSTEP_TRIGGER_URL", "").strip()
    return u or LSTEP_TRIGGER_URL_DEFAULT


def get_timerex_key():
    k = os.environ.get("TIMEREX_API_KEY", "").strip()
    return k if k else None


def test_lstep_minimal():
    """L-step: GET で認証・サーバー到達のみ確認（GAS runLStepApiConnectivityTestMinimal 相当）"""
    print("\n--- [1] L-step 最低限の疎通（GET） ---")
    token = get_lstep_token()
    if not token:
        print("  [NG] LSTEP_API_TOKEN が未設定です。.env または環境変数を設定してください。")
        return False
    url = f"{LSTEP_API_BASE}/"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    try:
        r = requests.get(url, headers=headers, timeout=15)
        print(f"  GET {url}")
        print(f"  HTTP {r.status_code}")
        if r.text and len(r.text) <= 300:
            print(f"  body: {r.text[:300]}")
        if r.status_code in (200, 201, 204):
            print("  [OK] 疎通成功（2xx）")
            return True
        if r.status_code == 404:
            print("  [OK] 疎通成功（サーバー到達、GET / は 404）")
            return True
        print(f"  [NG] 失敗: HTTP {r.status_code}")
        return False
    except requests.RequestException as e:
        print(f"  [NG] 送信失敗: {e}")
        return False


def test_lstep_trigger(use_uid=True):
    """L-step: トリガーURL へ POST（uid または friend_id）"""
    label = "UID" if use_uid else "friend_id"
    value = TEST_UID if use_uid else TEST_FRIEND_ID
    print(f"\n--- [2] L-step トリガーURL へ POST（{label}） ---")
    token = get_lstep_token()
    if not token:
        print("  [NG] LSTEP_API_TOKEN が未設定です。")
        return False
    url = get_trigger_url()
    payload = {"uid": value} if use_uid else {"friend_id": value}
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    print(f"  POST {url}")
    print(f"  body: {payload}")
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=15)
        print(f"  HTTP {r.status_code}")
        if r.text and len(r.text) <= 400:
            print(f"  body: {r.text[:400]}")
        if 200 <= r.status_code < 300:
            print(f"  [OK] 疎通成功（{label} でトリガー実行）")
            return True
        if r.status_code == 404:
            try:
                j = r.json()
                msg = j.get("title") or str(j.get("errors", []))
                if "友だち" in str(msg):
                    print("  [NG] 404: 友だちが見つかりません（アカウント不一致の可能性）")
                else:
                    print("  [NG] 404: トリガーURL 無効の可能性")
            except Exception:
                print("  [NG] 404")
            return False
        print(f"  [NG] 失敗: HTTP {r.status_code}")
        return False
    except requests.RequestException as e:
        print(f"  [NG] 送信失敗: {e}")
        return False


def test_timerex_key():
    """TimeRex: API キーが設定されていれば GET /user/me/teams を試行"""
    print("\n--- [3] TimeRex API キー（任意） ---")
    key = get_timerex_key()
    if not key:
        print("  （スキップ: TIMEREX_API_KEY 未設定）")
        return None
    url = f"{TIMEREX_API_BASE}/user/me/teams"
    headers = {"x-api-key": key, "Accept": "application/json"}
    try:
        r = requests.get(url, headers=headers, timeout=15)
        print(f"  GET {url}")
        print(f"  HTTP {r.status_code}")
        if 200 <= r.status_code < 300:
            print("  [OK] 疎通成功")
            return True
        print(f"  [NG] 失敗: HTTP {r.status_code}")
        return False
    except requests.RequestException as e:
        print(f"  [NG] 送信失敗: {e}")
        return False


def main():
    print("========================================")
    print("L-step / TimeRex 疎通確認（Python）")
    print("========================================")
    print("LSTEP_API_TOKEN:", "設定済み" if get_lstep_token() else "未設定")
    print("LSTEP_TRIGGER_URL:", get_trigger_url()[:60] + "..." if len(get_trigger_url()) > 60 else get_trigger_url())

    r1 = test_lstep_minimal()
    r2_uid = test_lstep_trigger(use_uid=True)
    r2_friend = test_lstep_trigger(use_uid=False)
    r3 = test_timerex_key()

    print("\n========================================")
    print("結果サマリー")
    print("========================================")
    print(f"  L-step GET（認証）:     {'[OK]' if r1 else '[NG]'}")
    print(f"  L-step トリガー(UID):  {'[OK]' if r2_uid else '[NG]'}")
    print(f"  L-step トリガー(friend_id): {'[OK]' if r2_friend else '[NG]'}")
    if r3 is not None:
        print(f"  TimeRex API:            {'[OK]' if r3 else '[NG]'}")
    else:
        print("  TimeRex API:            （スキップ）")

    # 切り分けの結論
    print("\n--- 切り分けの目安 ---")
    if not r1:
        print("  L-step トークン未設定または GET 失敗 → .env の LSTEP_API_TOKEN を確認")
    elif r2_uid and r2_friend:
        print("  Python からは UID / friend_id どちらも成功 → 問題は GAS 側の可能性")
    elif r2_friend and not r2_uid:
        print("  friend_id のみ成功 → UID が別LINE公式アカウントの友だちの可能性")
    elif r2_uid and not r2_friend:
        print("  UID のみ成功 → friend_id 204179348 が別アカウントの可能性")
    else:
        print("  トリガーが両方失敗 → トリガーURL または アカウント・友だち一覧を確認")

    return 0 if r1 else 1


if __name__ == "__main__":
    sys.exit(main())
