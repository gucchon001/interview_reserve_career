"""TimeRex APIドキュメントをスクレイピングして保存するスクリプト"""

import sys
import io
from pathlib import Path
from datetime import datetime
from typing import Optional

# Windowsコンソールのエンコーディング問題を回避
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    print("警告: playwrightがインストールされていません。pip install playwright を実行してください。")

# スクレイピング対象のURL
URLS = {
    "api_reference": "https://developers.timerex.net/ja/api/reference/6vmzg8z1h2tjg-api",
    "calendar_widget": "https://developers.timerex.net/ja/widget/nreference/1bbc771ccab48-calendar-widget-embed",
    "webhook_reference": "https://developers.timerex.net/ja/webhook/reference/d25add815131b-english",
}

OUTPUT_DIR = Path("docs/timerex")

# TimeRexドキュメントのベースURL
TIMEREX_BASE_URL = "https://developers.timerex.net"

# 再帰的に取得する最大深さ（0 = 初期ページのみ、1 = 1階層下まで、など）
MAX_DEPTH = 2

# 取得対象とするURLパターン
INCLUDE_PATTERNS = [
    "/ja/api/reference/",
    "/ja/webhook/reference/",
    "/ja/widget/",
    "/api/reference/",
    "/webhook/reference/",
    "/widget/",
]

# 除外するURLパターン
EXCLUDE_PATTERNS = [
    "/blog/",
    "/support/",
    "/contact/",
    "#",  # アンカーリンク
    "mailto:",  # メールリンク
    "javascript:",  # JavaScriptリンク
]


def fetch_page_content(page: object, url: str) -> Optional[str]:
    """Playwrightを使用してURLからHTMLコンテンツを取得"""
    try:
        print(f"  ページにアクセス中: {url}")
        page.goto(url, wait_until="networkidle", timeout=60000)
        
        # 追加の読み込み待機（JavaScriptの実行を待つ）
        page.wait_for_timeout(2000)
        
        # HTMLコンテンツを取得
        html_content = page.content()
        return html_content
    except Exception as e:
        print(f"  エラー: {url} の取得に失敗しました: {e}")
        return None


def should_include_url(url: str) -> bool:
    """URLが取得対象かどうかを判定"""
    # 除外パターンをチェック
    for exclude_pattern in EXCLUDE_PATTERNS:
        if exclude_pattern in url:
            return False
    
    # 含めるパターンをチェック
    for include_pattern in INCLUDE_PATTERNS:
        if include_pattern in url:
            return True
    
    return False


def normalize_url(url: str, base_url: str) -> str:
    """URLを正規化（アンカーやクエリパラメータを除去）"""
    from urllib.parse import urlparse, urlunparse
    
    # アンカーを除去
    if "#" in url:
        url = url.split("#")[0]
    
    # 相対URLを絶対URLに変換
    if url.startswith("/"):
        full_url = TIMEREX_BASE_URL + url
    elif url.startswith("http"):
        # 既に絶対URLの場合
        if "developers.timerex.net" not in url:
            return None
        full_url = url
    else:
        # 相対URLの場合、ベースURLを使用
        from urllib.parse import urljoin
        full_url = urljoin(base_url, url)
        if "developers.timerex.net" not in full_url:
            return None
    
    # URLを正規化（パースして再構築）
    parsed = urlparse(full_url)
    normalized = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        "",  # クエリパラメータを除去（必要に応じて保持も可能）
        ""   # フラグメントを除去
    ))
    
    return normalized


def extract_links_from_page(html_content: str, base_url: str) -> list[str]:
    """HTMLコンテンツからTimeRexドキュメントのリンクを抽出"""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, "html.parser")
        links = []
        
        # developers.timerex.netのドキュメントへのリンクを抽出
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            if not href:
                continue
            
            # URLを正規化
            normalized_url = normalize_url(href, base_url)
            if not normalized_url:
                continue
            
            # 取得対象かチェック
            if not should_include_url(normalized_url):
                continue
            
            # 重複を避ける
            if normalized_url not in links and normalized_url != base_url:
                links.append(normalized_url)
        
        return links
    except ImportError:
        print("警告: BeautifulSoup4がインストールされていません。リンク抽出をスキップします。")
        return []
    except Exception as e:
        print(f"警告: リンク抽出エラー: {e}")
        return []


def save_html(content: str, filename: str, encoding: str = "utf-8") -> None:
    """HTMLコンテンツをファイルに保存"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filepath = OUTPUT_DIR / filename
    
    try:
        filepath.write_text(content, encoding=encoding)
        print(f"[OK] 保存完了: {filepath}")
    except Exception as e:
        print(f"[ERROR] 保存エラー: {filepath}: {e}")


def extract_text_content(html_content: str) -> str:
    """HTMLからテキストコンテンツを抽出（簡易版）"""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, "html.parser")
        
        # script、style、nav、footerなどの不要な要素を削除
        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.decompose()
        
        # メインコンテンツを取得
        main_content = soup.find("main") or soup.find("article") or soup.find("body")
        if main_content:
            return main_content.get_text(separator="\n", strip=True)
        return soup.get_text(separator="\n", strip=True)
    except ImportError:
        print("警告: BeautifulSoup4がインストールされていません。HTMLをそのまま保存します。")
        return html_content
    except Exception as e:
        print(f"警告: テキスト抽出エラー: {e}")
        return html_content


def save_markdown(content: str, filename: str) -> None:
    """Markdownファイルとして保存"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filepath = OUTPUT_DIR / filename
    
    try:
        filepath.write_text(content, encoding="utf-8")
        print(f"[OK] Markdown保存完了: {filepath}")
    except Exception as e:
        print(f"[ERROR] Markdown保存エラー: {filepath}: {e}")


def generate_file_key(url: str, depth: int = 0) -> str:
    """URLからファイルキーを生成"""
    from urllib.parse import urlparse
    
    parsed = urlparse(url)
    path_parts = [p for p in parsed.path.split("/") if p]
    
    if not path_parts:
        return f"page_{depth}"
    
    # パス部分からキーを生成
    # 最後の2-3つのパス部分を使用（より具体的なキーを生成）
    key_parts = path_parts[-2:] if len(path_parts) >= 2 else path_parts
    key = "_".join(key_parts).replace("-", "_")
    
    # 深さを考慮（必要に応じて）
    if depth > 0:
        key = f"{depth}_{key}"
    
    return key


def main() -> None:
    """メイン処理"""
    if not PLAYWRIGHT_AVAILABLE:
        print("エラー: playwrightがインストールされていません。")
        print("以下のコマンドでインストールしてください:")
        print("  pip install playwright")
        print("  playwright install chromium")
        return
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    print(f"TimeRex APIドキュメントのスクレイピングを開始します...")
    print(f"最大深さ: {MAX_DEPTH}\n")
    
    # 処理済みURLを記録（重複を避ける）
    processed_urls = set()
    # URLと深さを記録: [(key, url, depth), ...]
    urls_to_process = [(key, url, 0) for key, url in URLS.items()]
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            while urls_to_process:
                key, url, depth = urls_to_process.pop(0)
                
                # URLを正規化して重複チェック
                normalized_url = normalize_url(url, url)
                if normalized_url in processed_urls:
                    continue
                
                # 深さ制限をチェック
                if depth > MAX_DEPTH:
                    print(f"  スキップ（深さ制限）: {url} (深さ: {depth})")
                    continue
                
                processed_urls.add(normalized_url)
                indent = "  " * depth
                print(f"{indent}[深さ {depth}] 処理中: {key} ({normalized_url})")
                
                html_content = fetch_page_content(page, normalized_url)
                
                if html_content:
                    # HTMLとして保存
                    file_key = generate_file_key(normalized_url, depth)
                    html_filename = f"{file_key}_{timestamp}.html"
                    save_html(html_content, html_filename, "utf-8")
                    
                    # Markdownとしても保存（テキスト抽出）
                    try:
                        from bs4 import BeautifulSoup
                        text_content = extract_text_content(html_content)
                        md_filename = f"{file_key}_{timestamp}.md"
                        
                        # Markdownヘッダーを追加
                        md_content = f"""# {key.replace('_', ' ').title()}

URL: {normalized_url}
取得日時: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
深さ: {depth}

---

{text_content}
"""
                        save_markdown(md_content, md_filename)
                        
                        # 次の深さのページがある場合、リンクを抽出
                        if depth < MAX_DEPTH:
                            links = extract_links_from_page(html_content, normalized_url)
                            new_links_count = 0
                            for link in links:
                                if link not in processed_urls:
                                    link_key = generate_file_key(link, depth + 1)
                                    # 同じキーとURLの組み合わせが既にキューにあるかチェック
                                    if not any(k == link_key and u == link for k, u, d in urls_to_process):
                                        urls_to_process.append((link_key, link, depth + 1))
                                        new_links_count += 1
                                        if new_links_count <= 5:  # 最初の5件のみ表示
                                            print(f"{indent}  → 追加URLを発見: {link_key} ({link})")
                            if new_links_count > 5:
                                print(f"{indent}  → ...他{new_links_count - 5}件のURLを追加")
                        
                    except ImportError:
                        print("  BeautifulSoup4がインストールされていないため、Markdown変換とリンク抽出をスキップします。")
                else:
                    print(f"{indent}  エラー: ページの取得に失敗しました")
                
                print()
        finally:
            browser.close()
    
    print(f"スクレイピング完了！合計{len(processed_urls)}ページを処理しました。")


if __name__ == "__main__":
    main()

